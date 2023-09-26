<?php


namespace Mapbender\DataSourceBundle\Component;


use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Query\QueryBuilder;
use Mapbender\DataSourceBundle\Component\Drivers\DoctrineBaseDriver;
use Mapbender\DataSourceBundle\Component\Drivers\Oracle;
use Mapbender\DataSourceBundle\Component\Drivers\PostgreSQL;
use Mapbender\DataSourceBundle\Component\Drivers\SQLite;
use Mapbender\DataSourceBundle\Component\Meta\TableMeta;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Container-unaware portions (Symfony 4+) of DataStore / FeatureType
 * @since 0.1.22
 */
class DataRepository
{
    /** @var Connection */
    protected $connection;
    /** @var TokenStorageInterface */
    protected $tokenStorage;
    /** @var string */
    protected $tableName;
    /** @var DoctrineBaseDriver */
    protected $driver;
    /** @var string */
    protected $uniqueIdFieldName;
    /** @var TableMeta|null */
    protected $tableMetaData;
    /** @var string[] */
    protected $fields;
    /** @var string|null SQL expression */
    protected $sqlFilter;

    /**
     * DataRepository constructor.
     * @param Connection $connection
     * @param TokenStorageInterface $tokenStorage
     * @param string $tableName
     * @param string $idColumnName
     * @param string[]|null $fields
     * @param string|null $filter
     * @throws \Doctrine\DBAL\Exception
     */
    public function __construct(Connection $connection, TokenStorageInterface $tokenStorage, $tableName, $idColumnName, $fields, $filter)
    {
        $this->connection = $connection;
        $this->tokenStorage = $tokenStorage;
        $this->tableName = $tableName;
        $this->uniqueIdFieldName = $idColumnName;
        $this->sqlFilter = $filter;
        $this->driver = $this->driverFactory($connection);
        $this->fields = $fields !== null ? $fields : $this->detectFields();
    }

    /**
     * @return Connection
     */
    public function getConnection()
    {
        return $this->connection;
    }

    /**
     * @return string
     */
    public function getTableName()
    {
        return $this->tableName;
    }

    /**
     * Create empty item
     *
     * @return DataItem
     * @since 0.1.16.2
     */
    public function itemFactory()
    {
        return $this->itemFromArray(array());
    }

    /**
     * @param integer|string $id
     * @return DataItem|null
     */
    public function getById($id)
    {
        $qb = $this->createQueryBuilder();
        $this->configureSelect($qb, false, array());
        return $this->getByIdInternal($id, $qb);
    }

    protected function getByIdInternal($id, QueryBuilder $qb)
    {
        $qb
            ->setMaxResults(1)
            ->where($this->getUniqueId() . " = :id")
            ->setParameter('id', $id)
        ;
        $row = $qb->execute()->fetchAssociative();
        if ($row) {
            $items = $this->prepareResults(array($row));
            return $items[0];
        } else {
            return null;
        }
    }

    /**
     * Search feature by criteria
     *
     * @param array $criteria
     * @return DataItem[]
     */
    public function search(array $criteria = array())
    {
        $queryBuilder = $this->createQueryBuilder();
        $this->configureSelect($queryBuilder, true, $criteria);
        return $this->prepareResults($queryBuilder->execute()->fetchAllAssociative());
    }

    /**
     * Returns number of matched rows.
     *
     * @param array $criteria same as supported by search, minus "maxResults"
     * @return int
     * @since 0.1.22
     */
    public function count(array $criteria)
    {
        $qb = $this->createQueryBuilder();
        $this->configureCount($qb, true, $criteria);
        return \intval($qb->execute()->fetchOne());
    }

    /**
     * Get by ID list
     *
     * @param mixed[] $ids
     * @return DataItem[]
     */
    public function getByIds($ids)
    {
        $queryBuilder = $this->createQueryBuilder();
        $this->configureSelect($queryBuilder, false, array());
        $connection   = $queryBuilder->getConnection();
        $condition = $queryBuilder->expr()->in($this->uniqueIdFieldName, array_map(array($connection, 'quote'), $ids));
        $queryBuilder->where($condition);
        $results = $this->prepareResults($queryBuilder->execute()->fetchAllAssociative());
        return $results;
    }

    /**
     * @param DataItem $item
     * @return DataItem
     */
    public function insertItem(DataItem $item)
    {
        $values = $this->prepareStoreValues($item);
        unset($values[$this->uniqueIdFieldName]);
        $values = $this->getTableMetaData()->prepareInsertData($values);
        $id = $this->driver->insert($this->connection, $this->getTableName(), $values, $this->uniqueIdFieldName);
        // Reload (fully populate, renormalize geometry etc)
        // Use reload to support FeatureType in maintaining srs in = srs out
        /** @see FeatureType::reloadItem */
        $tempItem = clone $item;
        $tempItem->setId($id);
        return $this->reloadItem($tempItem);
    }

    public function updateItem(DataItem $item)
    {
        $values = $this->prepareStoreValues($item);
        $identifier = $this->idToIdentifier($item->getId());
        $values = $this->getTableMetaData()->prepareUpdateData($values);
        $this->driver->update($this->connection, $this->getTableName(), $values, $identifier);
        return $this->reloadItem($item);
    }

    /**
     * @param DataItem $item
     * @return DataItem|null
     */
    protected function reloadItem($item)
    {
        return $this->getById($item->getId());
    }

    /**
     * @return TableMeta
     */
    protected function getTableMetaData()
    {
        if (!$this->tableMetaData) {
            $this->tableMetaData = $this->driver->loadTableMeta($this->connection, $this->tableName);
        }
        return $this->tableMetaData;
    }

    /**
     * Get unique ID field name
     *
     * @return string
     */
    public function getUniqueId()
    {
        return $this->uniqueIdFieldName;
    }

    /**
     * @return string[]
     */
    public function getFields()
    {
        return $this->fields;
    }

    /**
     * @return QueryBuilder
     */
    public function createQueryBuilder()
    {
        return $this->connection->createQueryBuilder();
    }

    /**
     * @param Connection $connection
     * @return DoctrineBaseDriver
     * @throws \Doctrine\DBAL\Exception
     * @throws \RuntimeException on incompatible platform
     */
    protected function driverFactory(Connection $connection)
    {
        $platformName = $connection->getDatabasePlatform()->getName();
        switch ($platformName) {
            case 'sqlite';
                $driver = new SQLite();
                break;
            case 'postgresql';
                $driver = new PostgreSQL();
                break;
            case 'oracle';
                $driver = new Oracle();
                break;
            default:
                throw new \RuntimeException("Unsupported DBAL platform " . print_r($platformName, true));
        }
        return $driver;
    }

    /**
     * @param mixed $id
     * @return array
     */
    protected function idToIdentifier($id)
    {
        $uniqueId = $this->uniqueIdFieldName;
        return array($uniqueId => $id);
    }

    protected function prepareStoreValues(DataItem $item)
    {
        $meta = $this->getTableMetaData();
        $values = array();
        foreach ($item->getAttributes() as $name => $value) {
            $values[$meta->getRealColumnName($name)] = $value;
        }
        return $values;
    }

    /**
     * Convert database rows to DataItem objects
     *
     * @param mixed[][] $rows
     * @return DataItem[]
     */
    protected function prepareResults(array $rows)
    {
        $items = array();
        foreach ($rows as $row) {
            $items[] = $this->itemFromArray($this->attributesFromRow($row));
        }
        return $items;
    }

    /**
     * @param mixed[] $values
     * @return mixed[]
     */
    protected function attributesFromRow(array $values)
    {
        $attributes = array();
        $meta = $this->getTableMetaData();
        foreach ($this->fields as $fieldName) {
            $attributes[$fieldName] = $values[$meta->getRealColumnName($fieldName)];
        }
        return $attributes;
    }

    /**
     * Create preinitialized item
     *
     * @param array $attributes
     * @return DataItem
     * @since 0.1.16.2
     */
    public function itemFromArray(array $attributes)
    {
        return new DataItem($attributes, $this->uniqueIdFieldName);
    }

    protected function configureSelect(QueryBuilder $queryBuilder, $includeDefaultFilter, array $params)
    {
        $queryBuilder->from($this->getTableName(), 't');
        $connection = $queryBuilder->getConnection();
        $meta = $this->getTableMetaData();
        foreach ($this->fields as $fieldName) {
            $columnName = $meta->getRealColumnName($fieldName);
            $queryBuilder->addSelect($connection->quoteIdentifier($columnName));
        }
        if (!empty($params['maxResults'])) {
            $queryBuilder->setMaxResults($params['maxResults']);
        }
        $this->addQueryFilters($queryBuilder, $includeDefaultFilter, $params);
    }

    protected function configureCount(QueryBuilder $queryBuilder, $includeDefaultFilter, array $params)
    {
        $queryBuilder->from($this->getTableName(), 't');
        $queryBuilder->select('count(*)');
        $this->addQueryFilters($queryBuilder, $includeDefaultFilter, $params);
    }

    protected function addQueryFilters(QueryBuilder $queryBuilder, $includeDefaultFilter, $params)
    {
        $setUserParam = false;
        $userNamePattern = '#:userName([^_\w\d]|$)#';
        if ($includeDefaultFilter && !empty($this->sqlFilter)) {
            $setUserParam = !!preg_match($userNamePattern, $this->sqlFilter);
            $queryBuilder->andWhere($this->sqlFilter);
        }
        if (!empty($params['where'])) {
            $setUserParam = $setUserParam || preg_match($userNamePattern, $params['where']);
            $queryBuilder->andWhere($params['where']);
        }
        if ($setUserParam) {
            $queryBuilder->setParameter(':userName', $this->tokenStorage->getToken()->getUsername());
        }
    }

    /**
     * @return string[]
     */
    protected function detectFields()
    {
        $fields = array();
        foreach ($this->getTableMetaData()->getColumNames() as $columnName) {
            $fields[] = \strtolower($columnName);
        }
        return $fields;
    }
}
