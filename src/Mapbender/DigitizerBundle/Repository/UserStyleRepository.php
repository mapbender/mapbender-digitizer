<?php

declare(strict_types=1);

namespace Mapbender\DigitizerBundle\Repository;

use Mapbender\DigitizerBundle\Entity\UserStyle;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ConnectionRegistry;

/**
 * Repository for UserStyle entities using DBAL.
 * Uses a configurable database connection and table name.
 *
 * NOTE: The database table must exist. Run the migration at:
 * Resources/sql/user_styles_migration.sql
 */
class UserStyleRepository
{
    private ConnectionRegistry $connectionRegistry;
    private ?string $connectionName = null;
    private ?string $tableName = null;

    /**
     * @param ConnectionRegistry $connectionRegistry The Doctrine connection registry
     */
    public function __construct(ConnectionRegistry $connectionRegistry)
    {
        $this->connectionRegistry = $connectionRegistry;
    }

    /**
     * Resolve the DBAL connection from the registry.
     */
    private function getConnection(): Connection
    {
        if ($this->connectionName === null) {
            throw new \RuntimeException('No database connection configured for user styles. Please set the connection in the Digitizer element backend configuration.');
        }
        /** @var Connection $connection */
        $connection = $this->connectionRegistry->getConnection($this->connectionName);
        return $connection;
    }

    /**
     * Override the table name at runtime (e.g. from element configuration).
     */
    public function setTableName(string $tableName): void
    {
        $this->tableName = $tableName;
    }

    public function getTableName(): string
    {
        return $this->tableName;
    }

    /**
     * Override the connection name at runtime (e.g. from element configuration).
     */
    public function setConnectionName(string $connectionName): void
    {
        $this->connectionName = $connectionName;
    }

    public function getConnectionName(): string
    {
        return $this->connectionName;
    }

    /**
     * Check whether the configured table exists in the database.
     * Returns false if connection or table name is not configured.
     */
    public function tableExists(): bool
    {
        if ($this->connectionName === null || $this->tableName === null) {
            return false;
        }
        try {
            $connection = $this->getConnection();
            $schemaManager = $connection->createSchemaManager();
            $parts = explode('.', $this->tableName);
            if (count($parts) === 2) {
                // schema.table format — Doctrine's tablesExist() does not handle
                // qualified names, so we check schema existence separately and
                // then look up only the bare table name.
                $schemas = $schemaManager->listSchemaNames();
                if (!in_array($parts[0], $schemas, true)) {
                    return false;
                }
                return $schemaManager->tablesExist([$parts[1]]);
            }
            return $schemaManager->tablesExist([$this->tableName]);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Convert a database row to a UserStyle entity.
     */
    private function rowToEntity(array $row): UserStyle
    {
        $style = new UserStyle();
        $style->setId((int) $row['id']);
        $style->setUserId($row['user_id']);
        $style->setName($row['name']);
        $style->setStyleConfig(json_decode($row['style_config'], true));
        if (isset($row['created_at'])) {
            $style->setCreatedAt(new \DateTime($row['created_at']));
        }
        if (isset($row['updated_at'])) {
            $style->setUpdatedAt(new \DateTime($row['updated_at']));
        }
        return $style;
    }

    /**
     * Find all styles for a specific user, ordered by most recently updated.
     *
     * @param string $userId
     * @return UserStyle[]
     */
    public function findByUser(string $userId): array
    {
        $sql = 'SELECT id, user_id, name, style_config, created_at, updated_at
                FROM ' . $this->tableName . '
                WHERE user_id = :userId
                ORDER BY updated_at DESC';

        $rows = $this->getConnection()->fetchAllAssociative($sql, ['userId' => $userId]);
        return array_map(fn($row) => $this->rowToEntity($row), $rows);
    }

    /**
     * Find all styles from all users, with the current user's styles first.
     *
     * @param string $currentUserId The current user's ID to prioritize
     * @return UserStyle[]
     */
    public function findAllSortedByUser(string $currentUserId): array
    {
        $sql = 'SELECT id, user_id, name, style_config, created_at, updated_at
                FROM ' . $this->tableName . '
                ORDER BY CASE WHEN user_id = :userId THEN 0 ELSE 1 END ASC, updated_at DESC';

        $rows = $this->getConnection()->fetchAllAssociative($sql, ['userId' => $currentUserId]);
        return array_map(fn($row) => $this->rowToEntity($row), $rows);
    }

    /**
     * Find a style by user and ID.
     *
     * @param string $userId
     * @param int $styleId
     * @return UserStyle|null
     */
    public function findOneByUserAndId(string $userId, int $styleId): ?UserStyle
    {
        $sql = 'SELECT id, user_id, name, style_config, created_at, updated_at
                FROM ' . $this->tableName . '
                WHERE user_id = :userId AND id = :id';

        $row = $this->getConnection()->fetchAssociative($sql, [
            'userId' => $userId,
            'id' => $styleId,
        ]);

        return $row ? $this->rowToEntity($row) : null;
    }

    /**
     * Find a style by ID (for delete permission check).
     *
     * @param int $styleId
     * @return UserStyle|null
     */
    public function findOneById(int $styleId): ?UserStyle
    {
        $sql = 'SELECT id, user_id, name, style_config, created_at, updated_at
                FROM ' . $this->tableName . '
                WHERE id = :id';

        $row = $this->getConnection()->fetchAssociative($sql, ['id' => $styleId]);

        return $row ? $this->rowToEntity($row) : null;
    }

    /**
     * Create and persist a new user style.
     *
     * @param string $userId
     * @param string $name
     * @param array $styleConfig
     * @return UserStyle
     */
    public function create(string $userId, string $name, array $styleConfig): UserStyle
    {
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        $this->getConnection()->insert($this->tableName, [
            'user_id' => $userId,
            'name' => $name,
            'style_config' => json_encode($styleConfig),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $id = (int) $this->getConnection()->lastInsertId();

        $style = new UserStyle();
        $style->setId($id);
        $style->setUserId($userId);
        $style->setName($name);
        $style->setStyleConfig($styleConfig);
        $style->setCreatedAt(new \DateTime($now));
        $style->setUpdatedAt(new \DateTime($now));

        return $style;
    }

    /**
     * Update an existing user style.
     *
     * @param string $userId
     * @param int $id
     * @param string $name
     * @param array $styleConfig
     * @return UserStyle|null
     */
    public function update(string $userId, int $id, string $name, array $styleConfig): ?UserStyle
    {
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        $affected = $this->getConnection()->update($this->tableName, [
            'name' => $name,
            'style_config' => json_encode($styleConfig),
            'updated_at' => $now,
        ], [
            'id' => $id,
            'user_id' => $userId,
        ]);

        if ($affected === 0) {
            return null;
        }

        return $this->findOneByUserAndId($userId, $id);
    }

    /**
     * Delete a user style.
     *
     * @param string $userId
     * @param int $id
     * @return bool
     */
    public function delete(string $userId, int $id): bool
    {
        $affected = $this->getConnection()->delete($this->tableName, [
            'id' => $id,
            'user_id' => $userId,
        ]);

        return $affected > 0;
    }
}
