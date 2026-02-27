<?php

namespace Mapbender\DataSourceBundle\Component;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\PropertyAdapter\DiscreteColumnAdapter;
use Mapbender\DataSourceBundle\Component\PropertyAdapter\JsonColumnAdapter;
use Mapbender\DataSourceBundle\Component\PropertyAdapter\PropertyAdapterInterface;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Repository for non-spatial database table rows.
 *
 * Supports two property storage modes:
 * - "columns" (default): each property is a separate table column
 * - "json": all properties in a single JSONB column
 *
 * Configuration array keys:
 *   connection       string   Doctrine DBAL connection name (default: "default")
 *   table            string   Table name, required (supports "schema"."table")
 *   uniqueId         string   Primary key column (default: "id")
 *   fields           array    Explicit column list, or null for auto-detect (columns mode)
 *   filter           string   Permanent SQL WHERE fragment (supports :userName placeholder)
 *   propertyStorage  string   "columns" or "json" (default: "columns")
 *   propertyColumn   string   JSONB column name when propertyStorage="json" (default: "properties")
 *   events           array    DEPRECATED, accepted but ignored
 */
class DataStore
{
    /**
     * Event hook names from the removed eval-based EventProcessor.
     * Used only to detect and warn about deprecated configuration.
     */
    private const DEPRECATED_EVENT_HOOKS = [
        'onBeforeSave', 'onAfterSave', 'onBeforeUpdate', 'onAfterUpdate',
        'onBeforeInsert', 'onAfterInsert', 'onBeforeRemove', 'onAfterRemove',
        'onBeforeSearch', 'onAfterSearch',
    ];

    private const DEPRECATED_EVENTS_WARNING =
        'DEPRECATED [DataSourceBundle] The "events" configuration key (table: %s, hooks: %s) is no longer '
        . 'supported and will be silently ignored. The eval-based event system (EventProcessor) was removed '
        . 'because it allowed arbitrary PHP code execution from YAML/database configuration — a significant '
        . 'security risk. Use database triggers, Symfony EventDispatcher, or DataStore subclass overrides '
        . 'instead. See EVENT-MIGRATION.md for a complete migration guide.';

    protected Connection $connection;
    protected TokenStorageInterface $tokenStorage;
    protected PropertyAdapterInterface $propertyAdapter;
    protected string $tableName;
    protected string $uniqueId;
    protected ?string $filter;

    /**
     * @param Connection $connection
     * @param TokenStorageInterface $tokenStorage
     * @param mixed $eventProcessorOrConfig EventProcessor (deprecated, ignored) or config array
     * @param array $config Configuration array (when 3rd arg is EventProcessor)
     */
    public function __construct(
        Connection $connection,
        TokenStorageInterface $tokenStorage,
        $eventProcessorOrConfig = [],
        $config = [],
    ) {
        $this->connection = $connection;
        $this->tokenStorage = $tokenStorage;

        // Backward compatibility: old signature passed EventProcessor as 3rd arg, config as 4th
        if (is_array($eventProcessorOrConfig)) {
            $config = $eventProcessorOrConfig;
        }
        // else: $eventProcessorOrConfig is EventProcessor (ignored), $config is 4th arg

        $this->tableName = $config['table'] ?? '';
        $this->uniqueId = $config['uniqueId'] ?? 'id';
        $filter = !empty($config['filter']) ? $config['filter'] : null;
        $this->filter = $this->sanitizeFilter($filter);

        // Warn when deprecated eval-based events are configured but will not be executed
        if (!empty($config['events'])) {
            $eventNames = implode(', ', array_intersect(
                array_keys($config['events']),
                self::DEPRECATED_EVENT_HOOKS
            ));
            if ($eventNames) {
                $table = $this->tableName ?: '(unknown)';
                @trigger_error(sprintf(
                    self::DEPRECATED_EVENTS_WARNING,
                    $table, $eventNames
                ), E_USER_DEPRECATED);
            }
        }

        $this->propertyAdapter = $this->createPropertyAdapter($config);
    }

    /**
     * @return PropertyAdapterInterface
     */
    public function getPropertyAdapter(): PropertyAdapterInterface
    {
        return $this->propertyAdapter;
    }

    /**
     * @return Connection
     */
    public function getConnection(): Connection
    {
        return $this->connection;
    }

    /**
     * @return string Quoted table name
     */
    public function getTableName(): string
    {
        return $this->quoteTableName($this->tableName);
    }

    /**
     * @return string Unquoted table name
     */
    public function getTableNameUnquoted(): string
    {
        return str_replace('"', '', $this->tableName);
    }

    /**
     * @return string Primary key column name
     */
    public function getUniqueId(): string
    {
        return $this->uniqueId;
    }

    /**
     * @return string[]
     */
    public function getFields(): array
    {
        return array_merge([$this->uniqueId], $this->propertyAdapter->getSelectColumns());
    }

    /**
     * @return string Database platform name (e.g. "postgresql")
     */
    public function getPlatformName(): string
    {
        return $this->connection->getDatabasePlatform()->getName();
    }

    /**
     * Create an empty DataItem.
     *
     * @return DataItem
     */
    public function itemFactory(): DataItem
    {
        return new DataItem([], $this->uniqueId);
    }

    /**
     * Create a DataItem pre-populated with attributes.
     *
     * @param array $attributes
     * @return DataItem
     */
    public function itemFromArray(array $attributes): DataItem
    {
        return new DataItem($attributes, $this->uniqueId);
    }

    /**
     * @param mixed $id
     * @return DataItem|null
     */
    public function getById($id): ?DataItem
    {
        $qb = $this->createSelectQueryBuilder([]);
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
     * @param array $criteria Supported keys: maxResults, where
     * @return DataItem[]
     */
    public function search(array $criteria = []): array
    {
        $qb = $this->createSelectQueryBuilder($criteria);
        $this->addFilters($qb, $criteria);
        $this->bindUserName($qb);

        $rows = $qb->executeQuery()->fetchAllAssociative();
        return $this->prepareResults($rows);
    }

    /**
     * @param array $criteria Supported keys: where
     * @return int
     */
    public function count(array $criteria = []): int
    {
        $qb = $this->connection->createQueryBuilder();
        $qb->select('COUNT(*)');
        $qb->from($this->getTableName());
        $this->addFilters($qb, $criteria);
        $this->bindUserName($qb);

        return (int) $qb->executeQuery()->fetchOne();
    }

    /**
     * Save a data item: insert if new, update if existing.
     *
     * @param DataItem|array $itemOrData
     * @return DataItem
     */
    public function save($itemOrData): DataItem
    {
        $item = $this->normalizeItem($itemOrData);
        if ($item->getId()) {
            return $this->updateItem($item);
        } else {
            return $this->insertItem($item);
        }
    }

    /**
     * @param DataItem|array $itemOrData
     * @return DataItem
     */
    public function insert($itemOrData): DataItem
    {
        return $this->insertItem($this->normalizeItem($itemOrData));
    }

    /**
     * @param DataItem|array $itemOrData
     * @return DataItem
     */
    public function update($itemOrData): DataItem
    {
        return $this->updateItem($this->normalizeItem($itemOrData));
    }

    /**
     * @param mixed $itemOrId DataItem or integer ID
     * @return int|null Number of deleted rows
     */
    public function remove($itemOrId)
    {
        $id = ($itemOrId instanceof DataItem) ? $itemOrId->getId() : $itemOrId;
        return $this->connection->delete(
            $this->getTableNameUnquoted(),
            [$this->uniqueId => $id],
        );
    }

    /**
     * Create a DBAL QueryBuilder.
     *
     * @return \Doctrine\DBAL\Query\QueryBuilder
     */
    public function createQueryBuilder(): \Doctrine\DBAL\Query\QueryBuilder
    {
        return $this->connection->createQueryBuilder();
    }

    // ---------------------------------------------------------------
    // Protected methods (override points for FeatureType)
    // ---------------------------------------------------------------

    /**
     * Build the SELECT query with all columns.
     *
     * @param array $criteria
     * @return \Doctrine\DBAL\Query\QueryBuilder
     */
    protected function createSelectQueryBuilder(array $criteria): \Doctrine\DBAL\Query\QueryBuilder
    {
        $qb = $this->connection->createQueryBuilder();
        $qb->from($this->getTableName());

        // Always select the primary key
        $qb->addSelect($this->qi($this->uniqueId));

        // Property columns
        foreach ($this->propertyAdapter->getSelectColumns() as $col) {
            $qb->addSelect($this->qi($col));
        }

        if (!empty($criteria['maxResults'])) {
            $qb->setMaxResults((int) $criteria['maxResults']);
        }

        return $qb;
    }

    /**
     * Add WHERE clauses from permanent filter and criteria.
     *
     * @param \Doctrine\DBAL\Query\QueryBuilder $qb
     * @param array $criteria
     */
    protected function addFilters(\Doctrine\DBAL\Query\QueryBuilder $qb, array $criteria): void
    {
        if ($this->filter) {
            $qb->andWhere($this->filter);
        }
        if (!empty($criteria['where'])) {
            $qb->andWhere($criteria['where']);
        }
    }

    /**
     * Insert a DataItem and return the reloaded version.
     *
     * @param DataItem $item
     * @return DataItem
     */
    protected function insertItem(DataItem $item): DataItem
    {
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
     * Update a DataItem and return the reloaded version.
     *
     * @param DataItem $item
     * @return DataItem
     */
    protected function updateItem(DataItem $item): DataItem
    {
        $allProperties = $this->getItemPropertiesForStorage($item);
        $storageData = $this->propertyAdapter->prepareStorageData($allProperties);

        if (!empty($storageData)) {
            $setClauses = [];
            $params = [];

            foreach ($storageData as $col => $value) {
                $setClauses[] = $this->qi($col) . ' = ?';
                $params[] = $value;
            }

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
     * Convert raw database rows to DataItem array.
     *
     * @param array $rows
     * @return DataItem[]
     */
    protected function prepareResults(array $rows): array
    {
        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->itemFromRow($row);
        }
        return $items;
    }

    /**
     * Build a DataItem from a raw database row.
     *
     * @param array $row
     * @return DataItem
     */
    protected function itemFromRow(array $row): DataItem
    {
        $properties = $this->propertyAdapter->extractProperties($row);
        $properties[$this->uniqueId] = $row[$this->uniqueId];
        return $this->itemFromArray($properties);
    }

    /**
     * Reload an item from the database by its ID.
     *
     * @param DataItem $item
     * @return DataItem|null
     */
    protected function reloadItem(DataItem $item): ?DataItem
    {
        return $this->getById($item->getId());
    }

    /**
     * Quote an identifier (column/table name).
     */
    protected function qi(string $identifier): string
    {
        return $this->connection->quoteIdentifier($identifier);
    }

    /**
     * Quote a table name, handling schema-qualified names.
     */
    protected function quoteTableName(string $tableName): string
    {
        $unquoted = str_replace('"', '', $tableName);
        $parts = explode('.', $unquoted);
        return implode('.', array_map(fn($p) => $this->qi($p), $parts));
    }

    /**
     * Bind the :userName parameter if present in any WHERE clause.
     */
    protected function bindUserName(\Doctrine\DBAL\Query\QueryBuilder $qb): void
    {
        if ($this->filter && str_contains($this->filter, ':userName')) {
            $qb->setParameter('userName', $this->getUserName());
        }
    }

    /**
     * Get the current user's name from the security token.
     */
    protected function getUserName(): string
    {
        $token = $this->tokenStorage->getToken();
        if ($token && method_exists($token, 'getUserIdentifier')) {
            return $token->getUserIdentifier() ?? '';
        }
        return '';
    }

    /**
     * Convert input to a DataItem, accepting arrays or DataItem objects.
     */
    protected function normalizeItem($itemOrData): DataItem
    {
        if ($itemOrData instanceof DataItem) {
            return $itemOrData;
        }
        if (is_array($itemOrData)) {
            return $this->itemFromArray($itemOrData);
        }
        throw new \InvalidArgumentException('Expected DataItem or array, got ' . get_debug_type($itemOrData));
    }

    /**
     * Extract the properties from a DataItem for storage,
     * excluding the uniqueId (handled separately).
     *
     * @param DataItem $item
     * @return array
     */
    protected function getItemPropertiesForStorage(DataItem $item): array
    {
        $attrs = $item->toArray();
        unset($attrs[$this->uniqueId]);
        return $attrs;
    }

    /**
     * Create the appropriate PropertyAdapter based on config.
     */
    protected function createPropertyAdapter(array $config): PropertyAdapterInterface
    {
        $storage = $config['propertyStorage'] ?? 'columns';

        if ($storage === 'json') {
            $jsonColumn = $config['propertyColumn'] ?? 'properties';
            return new JsonColumnAdapter($jsonColumn);
        }

        return new DiscreteColumnAdapter(
            $this->connection,
            $this->tableName,
            $config['fields'] ?? null,
            $this->uniqueId,
        );
    }

    /**
     * Remove quotes around parameter placeholders in filter SQL.
     * Legacy configs may have ':userName' instead of :userName.
     */
    private function sanitizeFilter(?string $filter): ?string
    {
        if (!$filter) {
            return null;
        }
        return preg_replace('#([\\\'"])(:[\w\d_]+)(\\1)#', '\\2', $filter);
    }
}
