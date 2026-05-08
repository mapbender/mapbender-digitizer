<?php

namespace Mapbender\DataSourceBundle\Component\PropertyAdapter;

use Doctrine\DBAL\Connection;

/**
 * Classic property storage: each property is a separate table column.
 *
 * If no field list is configured, columns are auto-detected from the
 * database schema. The uniqueId and geometry columns are always
 * excluded from the property set (handled separately by the repository).
 */
class DiscreteColumnAdapter implements PropertyAdapterInterface
{
    /** @var string[] */
    private array $columns;

    /**
     * @param Connection $connection DBAL connection for schema introspection
     * @param string $tableName Table name (may be schema-qualified: "schema"."table")
     * @param string[]|null $configuredFields Explicit field list, or null to auto-detect
     * @param string $uniqueId Primary key column name (excluded from properties)
     * @param string|null $geomField Geometry column name (excluded from properties)
     */
    public function __construct(
        Connection $connection,
        string $tableName,
        ?array $configuredFields,
        string $uniqueId,
        ?string $geomField = null,
    ) {
        $allColumns = $configuredFields ?? $this->introspectColumns($connection, $tableName);
        $exclude = array_filter([$uniqueId, $geomField]);
        $this->columns = array_values(array_diff($allColumns, $exclude));
    }

    public function getSelectColumns(): array
    {
        return $this->columns;
    }

    public function extractProperties(array $row): array
    {
        $props = [];
        foreach ($this->columns as $col) {
            if (array_key_exists($col, $row)) {
                $props[$col] = $row[$col];
            }
        }
        return $props;
    }

    public function prepareStorageData(array $properties): array
    {
        $known = array_flip($this->columns);
        return array_intersect_key($properties, $known);
    }

    /**
     * Auto-detect column names from the database table schema.
     *
     * @return string[]
     */
    private function introspectColumns(Connection $connection, string $tableName): array
    {
        $unquoted = str_replace('"', '', $tableName);
        $schemaManager = method_exists($connection, 'createSchemaManager')
            ? $connection->createSchemaManager()
            : $connection->getSchemaManager();

        $columns = $schemaManager->listTableColumns($unquoted);
        return array_map(
            fn($col) => $col->getName(),
            array_values($columns),
        );
    }
}
