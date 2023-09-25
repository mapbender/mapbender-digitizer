<?php


namespace Mapbender\DataSourceBundle\Component;


use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Query\QueryBuilder;
use Mapbender\DataSourceBundle\Component\Drivers\DoctrineBaseDriver;
use Mapbender\DataSourceBundle\Component\Drivers\Interfaces\Geographic;

class FeatureQueryBuilder extends QueryBuilder
{
    /** @var DoctrineBaseDriver */
    protected $driver;
    /** @var int|string|null */
    protected $sourceSrid;
    /** @var bool */
    protected $isSelect = false;
    /** @var string[] */
    protected $geomNames = array();
    /** @var int|string|null */
    protected $targetSrid;

    /**
     * @param Connection $connection
     * @param DoctrineBaseDriver $driver
     * @param int|string|null $sourceSrid
     */
    public function __construct(Connection $connection, DoctrineBaseDriver $driver, $sourceSrid)
    {
        parent::__construct($connection);
        $this->driver = $driver;
        $this->sourceSrid = $sourceSrid;
    }

    /**
     * @return int|string|null
     */
    public function getSourceSrid()
    {
        return $this->sourceSrid;
    }

    /**
     * @return int|string|null
     */
    public function getTargetSrid()
    {
        return $this->targetSrid ?: $this->sourceSrid;
    }

    /**
     * @param int|string|null $targetSrid
     */
    public function setTargetSrid($targetSrid)
    {
        $this->targetSrid = $targetSrid;
    }

    public function select($select = null)
    {
        $this->isSelect = true;
        return parent::select($select);
    }

    public function addSelect($select = null)
    {
        $this->isSelect = true;
        return parent::addSelect($select);
    }

    public function addGeomSelect($columnName)
    {
        $this->geomNames[] = $columnName;
    }

    public function getSQL()
    {
        if ($this->isSelect && $this->geomNames) {
            if ($this->driver instanceof Geographic) {
                $sridTo = $this->getTargetSrid();
                foreach ($this->geomNames as $geomName) {
                    $geomReference = $this->getConnection()->quoteIdentifier($geomName);
                    $geomSql = $this->driver->getColumnToEwktSql($geomReference, \intval($sridTo))
                             . ' AS ' . $this->getConnection()->quoteIdentifier($geomName);
                    parent::addSelect($geomSql);
                }
            } else {
                // Uh-oh
                foreach ($this->geomNames as $geomName) {
                    parent::addSelect($geomName);
                }
            }
            // Only do this once (parent buffers getSql result)
            $this->geomNames = array();
        }
        return parent::getSQL();
    }
}
