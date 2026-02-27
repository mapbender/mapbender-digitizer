<?php

namespace Mapbender\DataSourceBundle\Component\PropertyAdapter;

/**
 * Abstracts how feature/item properties are stored in database tables.
 *
 * Two implementations:
 * - DiscreteColumnAdapter: each property is a separate table column (classic mode)
 * - JsonColumnAdapter: all properties stored in a single JSONB column
 */
interface PropertyAdapterInterface
{
    /**
     * Returns the column names (or expressions) to include in SELECT queries.
     * Does NOT include the uniqueId or geometry columns — those are handled
     * by DataStore / FeatureType directly.
     *
     * @return string[]
     */
    public function getSelectColumns(): array;

    /**
     * Extracts property key-value pairs from a raw database row.
     * Must NOT include uniqueId or geometry values.
     *
     * @param array $row Raw row from database query result
     * @return array Associative array of property key => value
     */
    public function extractProperties(array $row): array;

    /**
     * Converts property key-value pairs into column => value data
     * suitable for INSERT or UPDATE.
     * Must NOT include uniqueId or geometry columns.
     *
     * @param array $properties Associative array of property key => value
     * @return array Column => value pairs for database storage
     */
    public function prepareStorageData(array $properties): array;
}
