<?php

namespace Mapbender\DataSourceBundle\Component\PropertyAdapter;

/**
 * JSON property storage: all properties in a single JSONB column.
 *
 * The table structure is:
 *   id (serial/int), geom (geometry), properties (jsonb)
 *
 * Properties are stored as a JSON object and transparently
 * encoded/decoded on read/write.
 */
class JsonColumnAdapter implements PropertyAdapterInterface
{
    private string $jsonColumn;

    /**
     * @param string $jsonColumn Name of the JSONB column (default: "properties")
     */
    public function __construct(string $jsonColumn = 'properties')
    {
        $this->jsonColumn = $jsonColumn;
    }

    public function getSelectColumns(): array
    {
        return [$this->jsonColumn];
    }

    public function extractProperties(array $row): array
    {
        $raw = $row[$this->jsonColumn] ?? null;
        if ($raw === null || $raw === '') {
            return [];
        }
        if (is_string($raw)) {
            return json_decode($raw, true) ?: [];
        }
        // Already decoded (e.g. by PDO)
        return is_array($raw) ? $raw : [];
    }

    public function prepareStorageData(array $properties): array
    {
        return [
            $this->jsonColumn => json_encode($properties, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        ];
    }

    public function getJsonColumn(): string
    {
        return $this->jsonColumn;
    }
}
