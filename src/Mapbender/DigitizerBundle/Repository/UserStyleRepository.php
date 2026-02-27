<?php

declare(strict_types=1);

namespace Mapbender\DigitizerBundle\Repository;

use Mapbender\DigitizerBundle\Entity\UserStyle;
use Doctrine\DBAL\Connection;

/**
 * Repository for UserStyle entities using DBAL.
 * Uses a configurable database connection and table name.
 *
 * NOTE: The database table must exist. Run the migration at:
 * Resources/sql/user_styles_migration.sql
 */
class UserStyleRepository
{
    private Connection $connection;
    private string $tableName;

    /**
     * @param Connection $connection The DBAL connection to use
     * @param string $tableName The fully qualified table name (e.g. 'digi.user_styles')
     */
    public function __construct(Connection $connection, string $tableName = 'digi.user_styles')
    {
        $this->connection = $connection;
        $this->tableName = $tableName;
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

        $rows = $this->connection->fetchAllAssociative($sql, ['userId' => $userId]);
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

        $rows = $this->connection->fetchAllAssociative($sql, ['userId' => $currentUserId]);
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

        $row = $this->connection->fetchAssociative($sql, [
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

        $row = $this->connection->fetchAssociative($sql, ['id' => $styleId]);

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

        $this->connection->insert($this->tableName, [
            'user_id' => $userId,
            'name' => $name,
            'style_config' => json_encode($styleConfig),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $id = (int) $this->connection->lastInsertId();

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

        $affected = $this->connection->update($this->tableName, [
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
        $affected = $this->connection->delete($this->tableName, [
            'id' => $id,
            'user_id' => $userId,
        ]);

        return $affected > 0;
    }
}
