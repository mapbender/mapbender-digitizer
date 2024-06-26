<?php
namespace Mapbender\DataSourceBundle\Component;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Query\QueryBuilder;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DataSourceBundle\Utils\WktUtility;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Loads and stores Features (DataItem with geometry).
 *
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 2015 by WhereGroup GmbH & Co. KG
 * @link      https://github.com/mapbender/mapbender-digitizer
 *
 * @method Feature save(Feature|array $feature)
 * @method Feature[] search(array $criteria)
 * @method Feature insertItem(Feature $item)
 * @method Feature updateItem(Feature $item)
 * @method Feature update($itemOrData)
 * @method Feature insert($itemOrData)
 * @method Feature[] getByIds(array $ids)
 * @method Feature itemFactory()
 * @method Feature[] prepareResults(array $rows)
 * @method Feature getByIdInternal($id, QueryBuilder $qb)
 */
class FeatureType extends DataStore
{
    /**
     * @var string Geometry field name
     */
    protected $geomField;

    /** @var int|null fallback source srid used only if detection fails (e.g. materialized views) */
    protected $configuredSrid;

    /**
     * @var int SRID to get geometry converted to
     */
    protected $srid;

    public function __construct(Connection $connection, TokenStorageInterface $tokenStorage, EventProcessor $eventProcessor, $args = array())
    {
        $this->geomField = $args['geomField'];
        parent::__construct($connection, $tokenStorage, $eventProcessor, $args);
        if ($this->geomField && false !== ($key = \array_search($this->geomField, $this->fields))) {
            unset($this->fields[$key]);
        }
        if (!empty($args['srid'])) {
            $this->configuredSrid = \intval($args['srid']) ?: null;
        }
    }

    public function getFields()
    {
        return array_merge(parent::getFields(), array($this->geomField));
    }

    /**
     * Get feature by ID and SRID
     *
     * @param int $id
     * @param int $srid SRID
     * @return Feature|null
     */
    public function getById($id, $srid = null)
    {
        $qb = $this->createQueryBuilder();
        $this->configureSelect($qb, false, array(
            'srid' => $srid,
        ));
        return $this->getByIdInternal($id, $qb);
    }

    /**
     * @param Feature $feature
     * @return Feature|null
     */
    protected function reloadItem($feature)
    {
        return $this->getById($feature->getId(), $feature->getSrid());
    }

    /**
     * @param DataItem $feature
     * @return mixed[]
     */
    protected function prepareStoreValues(DataItem $feature)
    {
        $data = parent::prepareStoreValues($feature);
        /** @var Feature $feature */
        $ewkt = $feature->getEwkt();
        $meta = $this->getTableMetaData();
        $geomColumnName = $meta->getRealColumnName($this->geomField);
        if ($ewkt) {
            $tableSrid = $this->getSrid();
            $geomSql = $this->driver->getReadEwktSql($this->connection->quote($ewkt));
            $geomSql = $this->driver->getTransformSql($geomSql, $tableSrid);
            if ($this->checkPromoteToCollection($ewkt, $geomColumnName)) {
                $geomSql = $this->driver->getPromoteToCollectionSql($geomSql);
            }
            $data[$geomColumnName] = new Expression($geomSql);
        } else {
            $data[$geomColumnName] = null;
        }
        return $data;
    }

    /**
     * @param string $ewkt
     * @param string|null $columnName
     * @return boolean
     */
    protected function checkPromoteToCollection($ewkt, $columnName)
    {
        $tableType = $this->getTableMetaData()->getColumn($columnName)->getGeometryType();
        $wktType = WktUtility::getGeometryType($ewkt);

        // @todo: document why we would want to promote to collection, and why we only have a Postgis implementation
        return $tableType && $wktType != $tableType
            && strtoupper($tableType) !== 'GEOMETRY'
            && preg_match('#^MULTI#i', $tableType)
            && !preg_match('#^MULTI#i', $wktType)
        ;
    }

    /**
     * @return string
     */
    public function getGeomField()
    {
        return $this->geomField;
    }

    /**
     * Create preinitialized item
     *
     * @param array $values
     * @return Feature
     * @since 0.1.16.2
     */
    public function itemFromArray(array $values)
    {
        return new Feature($values, $this->uniqueIdFieldName, $this->geomField);
    }

    /**
     * Get SRID
     *
     * @return int
     */
    public function getSrid()
    {
        $this->srid = $this->srid ?: $this->getTableMetaData()->getColumn($this->geomField)->getSrid() ?: $this->configuredSrid;
        if (!$this->srid) {
            # Throw a decently helpful exception now instead of throwing a
            # hard to parse one ("Invalid sridTo 0") later.
            throw new \RuntimeException("SRID detection failure on {$this->tableName}.{$this->geomField}; must supply an 'srid' value in your featuretype configuration");
        }
        return $this->srid;
    }

    /**
     * @return FeatureQueryBuilder
     */
    public function createQueryBuilder()
    {
        return new FeatureQueryBuilder($this->connection, $this->driver, $this->getSrid());
    }

    protected function attributesFromRow(array $values)
    {
        $attributes = parent::attributesFromRow($values);
        if ($this->geomField && !\array_key_exists($this->geomField, $attributes)) {
            $meta = $this->getTableMetaData();
            $attributes[$this->geomField] = $values[$meta->getRealColumnName($this->geomField)];
        }
        return $attributes;
    }

    protected function configureSelect(QueryBuilder $queryBuilder, $includeDefaultFilter, array $params)
    {
        /** @var FeatureQueryBuilder $queryBuilder */
        parent::configureSelect($queryBuilder, $includeDefaultFilter, $params);
        $queryBuilder->addGeomSelect($this->geomField);
        if (!empty($params['srid'])) {
            $queryBuilder->setTargetSrid($params['srid']);
        }
    }

    protected function addQueryFilters(QueryBuilder $queryBuilder, $includeDefaultFilter, $params)
    {
        parent::addQueryFilters($queryBuilder, $includeDefaultFilter, $params);
        // add bounding geometry condition
        if (!empty($params['intersect'])) {
            $clipWkt = $params['intersect'];
            if (!($srid = WktUtility::getEwktSrid($clipWkt))) {
                if (!empty($params['srid'])) {
                    $clipSrid = $params['srid'];
                } else {
                    $clipSrid = $this->getSrid();
                }
                $clipWkt = "SRID={$clipSrid};$clipWkt";
            }
            $connection = $queryBuilder->getConnection();
            $clipGeomExpression = $this->driver->getReadEwktSql($connection->quote($clipWkt));
            $clipGeomExpression = $this->driver->getTransformSql($clipGeomExpression, $this->getSrid());
            $columnReference = $connection->quoteIdentifier($this->geomField);
            $queryBuilder->andWhere($this->driver->getIntersectCondition($columnReference, $clipGeomExpression));
        }
    }
}
