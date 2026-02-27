<?php

namespace Mapbender\DataSourceBundle\Component;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\PropertyAdapter\DiscreteColumnAdapter;
use Mapbender\DataSourceBundle\Component\PropertyAdapter\PropertyAdapterInterface;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DataSourceBundle\Utils\WktUtility;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Repository for spatial database features (DataItem with PostGIS geometry).
 *
 * Extends DataStore with geometry handling: spatial SELECT (ST_AsEWKT),
 * spatial INSERT/UPDATE (ST_GeomFromEWKT, ST_MakeValid, ST_Transform),
 * and spatial filtering (ST_Intersects).
 *
 * Additional configuration keys (on top of DataStore):
 *   geomField   string   Geometry column name (default: "geom")
 *   srid        int      Storage SRID; auto-detected from geometry_columns if omitted
 *
 * @method Feature save(Feature|array $feature)
 * @method Feature[] search(array $criteria)
 * @method Feature insert($itemOrData)
 * @method Feature update($itemOrData)
 * @method Feature itemFactory()
 */
class FeatureType extends DataStore
{
    protected string $geomField;
    protected ?int $configuredSrid;
    protected ?int $detectedSrid = null;

    public function __construct(
        Connection $connection,
        TokenStorageInterface $tokenStorage,
        $eventProcessorOrConfig = [],
        $config = [],
    ) {
        // Resolve config (same backward-compat as DataStore)
        if (is_array($eventProcessorOrConfig)) {
            $config = $eventProcessorOrConfig;
        }

        $this->geomField = $config['geomField'] ?? 'geom';
        $this->configuredSrid = !empty($config['srid']) ? (int) $config['srid'] : null;

        parent::__construct($connection, $tokenStorage, $eventProcessorOrConfig, $config);
    }

    /**
     * @return string Geometry column name
     */
    public function getGeomField(): string
    {
        return $this->geomField;
    }

    /**
     * Get the storage SRID. Auto-detects from geometry_columns if not configured.
     *
     * @return int
     * @throws \RuntimeException if SRID cannot be determined
     */
    public function getSrid(): int
    {
        if ($this->detectedSrid !== null) {
            return $this->detectedSrid;
        }
        if ($this->configuredSrid) {
            $this->detectedSrid = $this->configuredSrid;
            return $this->detectedSrid;
        }

        $this->detectedSrid = $this->detectSridFromGeometryColumns();
        if (!$this->detectedSrid) {
            throw new \RuntimeException(
                "SRID detection failure on {$this->tableName}.{$this->geomField}; "
                . "supply an 'srid' value in your featureType configuration",
            );
        }
        return $this->detectedSrid;
    }

    /**
     * @return string[]
     */
    public function getFields(): array
    {
        return array_merge(parent::getFields(), [$this->geomField]);
    }

    /**
     * Get feature by ID, optionally transforming geometry to a target SRID.
     *
     * @param mixed $id
     * @param int|null $srid Target SRID for returned geometry (null = storage SRID)
     * @return Feature|null
     */
    public function getById($id, $srid = null): ?Feature
    {
        $criteria = [];
        if ($srid) {
            $criteria['srid'] = $srid;
        }
        $qb = $this->createSelectQueryBuilder($criteria);
        $qb->andWhere($this->qi($this->uniqueId) . ' = :pkId');
        $qb->setParameter('pkId', $id);
        $this->bindUserName($qb);

        $row = $qb->executeQuery()->fetchAssociative();
        if (!$row) {
            return null;
        }
        return $this->itemFromRow($row);
    }

    /**
     * @return Feature
     */
    public function itemFactory(): Feature
    {
        return new Feature([], $this->uniqueId, $this->geomField);
    }

    /**
     * @param array $attributes
     * @return Feature
     */
    public function itemFromArray(array $attributes): Feature
    {
        return new Feature($attributes, $this->uniqueId, $this->geomField);
    }

    // ---------------------------------------------------------------
    // Protected overrides
    // ---------------------------------------------------------------

    /**
     * @inheritDoc
     * Adds geometry as EWKT to the SELECT.
     */
    protected function createSelectQueryBuilder(array $criteria): \Doctrine\DBAL\Query\QueryBuilder
    {
        $qb = parent::createSelectQueryBuilder($criteria);

        $targetSrid = !empty($criteria['srid']) ? (int) $criteria['srid'] : $this->getSrid();
        $geomRef = $this->qi($this->geomField);

        // Select geometry as EWKT, transformed to target SRID
        $qb->addSelect(
            "ST_AsEWKT(ST_Transform({$geomRef}, {$targetSrid})) AS {$geomRef}",
        );

        return $qb;
    }

    /**
     * @inheritDoc
     * Adds spatial intersection filter.
     */
    protected function addFilters(\Doctrine\DBAL\Query\QueryBuilder $qb, array $criteria): void
    {
        parent::addFilters($qb, $criteria);

        if (!empty($criteria['intersect'])) {
            $clipWkt = $criteria['intersect'];
            $geomRef = $this->qi($this->geomField);

            // Determine SRID for the clip geometry
            $clipSrid = WktUtility::getEwktSrid($clipWkt);
            if (!$clipSrid) {
                $clipSrid = !empty($criteria['srid']) ? (int) $criteria['srid'] : $this->getSrid();
                $clipWkt = "SRID={$clipSrid};{$clipWkt}";
            }

            // Transform clip geometry to storage SRID and intersect
            $storageSrid = $this->getSrid();
            $qb->andWhere(
                "ST_Intersects({$geomRef}, ST_Transform(ST_GeomFromEWKT(:intersectGeom), {$storageSrid}))",
            );
            $qb->setParameter('intersectGeom', $clipWkt);
        }
    }

    /**
     * @inheritDoc
     * Adds geometry column with PostGIS INSERT.
     */
    protected function insertItem(DataItem $item): DataItem
    {
        /** @var Feature $item */
        $allProperties = $this->getItemPropertiesForStorage($item);
        $storageData = $this->propertyAdapter->prepareStorageData($allProperties);

        $columns = [];
        $placeholders = [];
        $params = [];

        foreach ($storageData as $col => $value) {
            $columns[] = $this->qi($col);
            $placeholders[] = '?';
            $params[] = $value;
        }

        // Add geometry
        $geomSql = $this->buildGeomInsertExpression($item);
        if ($geomSql !== null) {
            $columns[] = $this->qi($this->geomField);
            $placeholders[] = $geomSql['expression'];
            $params = array_merge($params, $geomSql['params']);
        }

        if (empty($columns)) {
            $sql = sprintf(
                'INSERT INTO %s DEFAULT VALUES RETURNING %s',
                $this->getTableName(),
                $this->qi($this->uniqueId),
            );
        } else {
            $sql = sprintf(
                'INSERT INTO %s (%s) VALUES (%s) RETURNING %s',
                $this->getTableName(),
                implode(', ', $columns),
                implode(', ', $placeholders),
                $this->qi($this->uniqueId),
            );
        }

        $stmt = $this->connection->prepare($sql);
        $result = $stmt->executeQuery($params);
        $id = $result->fetchOne();
        $item->setId($id);

        return $this->reloadItem($item) ?? $item;
    }

    /**
     * @inheritDoc
     * Adds geometry column with PostGIS UPDATE.
     */
    protected function updateItem(DataItem $item): DataItem
    {
        /** @var Feature $item */
        $allProperties = $this->getItemPropertiesForStorage($item);
        $storageData = $this->propertyAdapter->prepareStorageData($allProperties);

        $setClauses = [];
        $params = [];

        foreach ($storageData as $col => $value) {
            $setClauses[] = $this->qi($col) . ' = ?';
            $params[] = $value;
        }

        // Geometry SET clause
        $geomSql = $this->buildGeomInsertExpression($item);
        if ($geomSql !== null) {
            $setClauses[] = $this->qi($this->geomField) . ' = ' . $geomSql['expression'];
            $params = array_merge($params, $geomSql['params']);
        } else {
            // Explicitly set geometry to NULL if empty
            $setClauses[] = $this->qi($this->geomField) . ' = NULL';
        }

        if (!empty($setClauses)) {
            $params[] = $item->getId();

            $sql = sprintf(
                'UPDATE %s SET %s WHERE %s = ?',
                $this->getTableName(),
                implode(', ', $setClauses),
                $this->qi($this->uniqueId),
            );

            $this->connection->executeStatement($sql, $params);
        }

        return $this->reloadItem($item) ?? $item;
    }

    /**
     * @inheritDoc
     * Includes geometry in the Feature attributes.
     */
    protected function itemFromRow(array $row): Feature
    {
        $properties = $this->propertyAdapter->extractProperties($row);
        $properties[$this->uniqueId] = $row[$this->uniqueId];
        $properties[$this->geomField] = $row[$this->geomField] ?? null;
        return $this->itemFromArray($properties);
    }

    /**
     * @inheritDoc
     * Preserves SRID when reloading.
     */
    protected function reloadItem(DataItem $item): ?Feature
    {
        /** @var Feature $item */
        $srid = $item->getSrid();
        return $this->getById($item->getId(), $srid);
    }

    /**
     * @inheritDoc
     * Exclude geometry from the properties passed to the adapter.
     */
    protected function getItemPropertiesForStorage(DataItem $item): array
    {
        $attrs = parent::getItemPropertiesForStorage($item);
        unset($attrs[$this->geomField]);
        return $attrs;
    }

    /**
     * @inheritDoc
     * Exclude geometry column from the property adapter.
     */
    protected function createPropertyAdapter(array $config): PropertyAdapterInterface
    {
        $storage = $config['propertyStorage'] ?? 'columns';

        if ($storage === 'json') {
            $jsonColumn = $config['propertyColumn'] ?? 'properties';
            return new \Mapbender\DataSourceBundle\Component\PropertyAdapter\JsonColumnAdapter($jsonColumn);
        }

        return new DiscreteColumnAdapter(
            $this->connection,
            $config['table'] ?? '',
            $config['fields'] ?? null,
            $config['uniqueId'] ?? 'id',
            $this->geomField,
        );
    }

    // ---------------------------------------------------------------
    // PostGIS SQL helpers
    // ---------------------------------------------------------------

    /**
     * Build the SQL expression and parameters for inserting/updating geometry.
     *
     * @param Feature $feature
     * @return array{expression: string, params: array}|null
     */
    private function buildGeomInsertExpression(Feature $feature): ?array
    {
        $ewkt = $feature->getEwkt();
        if (!$ewkt) {
            return null;
        }

        $storageSrid = $this->getSrid();
        $geomType = $this->detectGeometryColumnType();

        // Build: ST_MakeValid(ST_Transform(ST_GeomFromEWKT(?), storageSrid))
        $expr = 'ST_GeomFromEWKT(?)';
        $params = [$ewkt];

        // Always transform to storage SRID
        $expr = "ST_Transform({$expr}, {$storageSrid})";

        // Promote to multi-geometry if needed
        if ($this->shouldPromoteToMulti($ewkt, $geomType)) {
            $expr = "ST_Multi({$expr})";
        }

        // Always validate
        $expr = "ST_MakeValid({$expr})";

        return ['expression' => $expr, 'params' => $params];
    }

    /**
     * Check if incoming geometry needs promotion to MULTI variant.
     */
    private function shouldPromoteToMulti(string $ewkt, ?string $columnType): bool
    {
        if (!$columnType) {
            return false;
        }
        $upperType = strtoupper($columnType);
        if ($upperType === 'GEOMETRY') {
            return false;
        }
        $wktType = WktUtility::getGeometryType($ewkt);
        if (!$wktType) {
            return false;
        }
        return preg_match('#^MULTI#i', $columnType)
            && !preg_match('#^MULTI#i', $wktType);
    }

    /**
     * Auto-detect geometry column type from geometry_columns.
     *
     * @return string|null e.g. "MULTIPOLYGON", "POINT", "GEOMETRY"
     */
    private function detectGeometryColumnType(): ?string
    {
        $parsed = $this->parseTableName();
        try {
            $sql = 'SELECT type FROM geometry_columns WHERE f_table_name = ? AND f_table_schema = ?';
            $result = $this->connection->fetchOne($sql, [$parsed['table'], $parsed['schema']]);
            return $result ?: null;
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Auto-detect SRID from the geometry_columns system table.
     *
     * @return int|null
     */
    private function detectSridFromGeometryColumns(): ?int
    {
        $parsed = $this->parseTableName();
        try {
            $sql = 'SELECT srid FROM geometry_columns WHERE f_table_name = ? AND f_table_schema = ? AND f_geometry_column = ?';
            $result = $this->connection->fetchOne($sql, [
                $parsed['table'],
                $parsed['schema'],
                $this->geomField,
            ]);
            return $result ? (int) $result : null;
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Parse table name into schema + table components.
     *
     * @return array{schema: string, table: string}
     */
    private function parseTableName(): array
    {
        $unquoted = str_replace('"', '', $this->tableName);
        $parts = explode('.', $unquoted);
        if (count($parts) === 2) {
            return ['schema' => $parts[0], 'table' => $parts[1]];
        }
        return ['schema' => 'public', 'table' => $parts[0]];
    }
}
