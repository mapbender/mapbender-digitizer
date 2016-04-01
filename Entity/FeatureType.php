<?php
namespace Mapbender\DigitizerBundle\Entity;

use Doctrine\DBAL\Query\QueryBuilder;
use Doctrine\DBAL\Statement;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\ORM\Query;
use Mapbender\CoreBundle\Component\Application as AppComponent;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\Drivers\Geographic;
use Mapbender\DataSourceBundle\Component\Drivers\PostgreSQL;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Finder\Finder;
use Symfony\Component\Security\Acl\Exception\Exception;

/**
 * Class FeatureType handles Feature objects.
 *
 * Main goal of the handler is, to get manage GeoJSON Features
 * for communication between OpenLayers and databases
 * with spatial abilities like Oracle or PostgreSQL.
 *
 *
 * @package   Mapbender\CoreBundle\Entity
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 2015 by WhereGroup GmbH & Co. KG
 * @link      https://github.com/mapbender/mapbender-digitizer
 */
class FeatureType extends DataStore
{
    const UPLOAD_DIR_NAME = "featureTypes";

    /**
     *  Default max results by search
     */
    const MAX_RESULTS = 5000;

    /**
     * @var string Geometry field name
     */
    protected $geomField = 'geom';

    /**
     * @var int SRID to get geometry converted to
     */
    protected $srid = null;

    /**
     * @var string SQL where filter
     */
    protected $sqlFilter;

    /**
     * @var array file info list
     */
    protected $filesInfo = array();

    /**
     * @param ContainerInterface $container
     * @param null               $args
     */
    public function __construct(ContainerInterface $container, $args = null)
    {
        $hasFields = isset($args["fields"]) && is_array($args["fields"]);

        parent::__construct($container, $args);

        // if no fields defined, but geomField, find it all and remove geo field from the list
        if (!$hasFields && isset($args["geomField"])) {
            $fields = $this->getDriver()->getStoreFields();
            unset($fields[array_search($args["geomField"], $fields, false)]);
            $this->setFields($fields);
        }
    }

    /**
     * @param string $geomField
     */
    public function setGeomField($geomField)
    {
        $this->geomField = $geomField;
    }

    /**
     * @param int $srid
     */
    public function setSrid($srid)
    {
        $this->srid = $srid;
    }

    /**
     * @param array $fields
     * @return array
     */
    public function setFields(array $fields)
    {
        return $this->driver->setFields($fields);
    }

    /**
     * Get feature by ID and SRID
     *
     * @param int $id
     * @param int $srid SRID
     * @return Feature
     */
    public function getById($id, $srid = null)
    {
        $rows = $this->getSelectQueryBuilder($srid)
            ->where($this->getUniqueId() . " = :id")
            ->setParameter('id', $id)
            ->execute()
            ->fetchAll();
        $this->prepareResults($rows, $srid);
        return reset($rows);
    }

    /**
     * Save feature
     *
     * @param array|Feature|DataItem $featureData
     * @param bool                   $autoUpdate update instead of insert if ID given
     * @return DataItem|Feature
     * @throws \Exception
     */
    public function save($featureData, $autoUpdate = true)
    {
        if (!is_array($featureData) && !is_object($featureData)) {
            throw new \Exception("Feature data given isn't compatible to save into the table: " . $this->getTableName());
        }


        $feature         = $this->create($featureData);
        $event           = array(
            'item'    => &$featureData,
            'feature' => $feature
        );
        $this->allowSave = true;

        try {
            if (isset($this->events['onBeforeSave'])) {
                $this->secureEval($this->events['onBeforeSave'], $event);
            }

            if ($this->allowSave) {
                // Insert if no ID given
                if (!$autoUpdate || !$feature->hasId()) {
                    $feature = $this->insert($feature);
                } // Replace if has ID
                else {
                    $feature = $this->update($feature);
                }
            }

            if (isset($this->events['onAfterSave'])) {
                $this->secureEval($this->events['onAfterSave'], $event);
            }

            // Get complete feature data
            $result = $this->getById($feature->getId(), $feature->getSrid());
        } catch (Exception $e) {
            $result = array(
                "exception"   => $e,
                "feature"     => $feature,
                "featureData" => $featureData
            );
        }

        return $result;
    }

    /**
     * Insert feature
     *
     * @param array|Feature $featureData
     * @return Feature
     */
    public function insert($featureData)
    {
        /** @var Feature $feature */
        $tableName                     = $this->getTableName();
        $feature                       = $this->create($featureData);
        $data                          = $this->cleanFeatureData($feature->toArray());
        $connection                    = $this->getConnection();
        $data[ $this->getGeomField() ] = $this->transformEwkt($data[ $this->getGeomField() ], $this->getSrid());
        $result                        = $connection->insert($tableName, $data);
        $lastId                        = $connection->lastInsertId();

        if ($lastId < 1) {
            switch ($connection->getDatabasePlatform()->getName()) {
                case self::POSTGRESQL_PLATFORM:
                    $sql    = "SELECT currval(pg_get_serial_sequence('" . $tableName . "','" . $this->getUniqueId() . "'))";
                    $lastId = $connection->fetchColumn($sql);
                    break;
            }
        }
        $feature->setId($lastId);
        return $feature;
    }

    /**
     * @param      $wkt
     * @param null $srid
     * @return bool|string
     * @throws \Doctrine\DBAL\DBALException
     */
    public function transformEwkt($wkt, $srid = null)
    {
        $srid       = $srid ? $srid : $this->getSrid();
        $sql        = null;
        $connection = $this->getConnection();
        switch ($this->getPlatformName()) {
            case self::POSTGRESQL_PLATFORM:
                $type = $this->getGeomType($this->getTableName());
                if ($type) {
                    $wktType = self::getWktType($wkt);
                    if ($wktType != $type) {
                        if ($type == "MULTIPOLYGON" || $type == "MULTILINESTRING" || $type == "MULTIPOINT") {
                            if ($wktType == "POLYGON" || $wktType == "LINESTRING" || $wktType == "POINT") {
                                $wkt = 'SRID=' . $srid . ';' . $connection->fetchColumn("SELECT ST_ASTEXT(ST_TRANSFORM(ST_MULTI(" . $connection->quote($wkt) . "),$srid))");
                            }
                        }
                    }
                }
                $sql    = "SELECT ST_TRANSFORM(ST_GEOMFROMTEXT('$wkt'), $srid)";
                break;
            case self::ORACLE_PLATFORM:
                $sql = "SELECT SDO_CS.TRANSFORM(SDO_UTIL.TO_WKBGEOMETRY('$wkt'), $srid)";
                break;
        }

        return $connection->fetchColumn($sql);
    }

    /**
     * Update
     *
     * @param $featureData
     * @return Feature
     * @throws \Exception
     * @internal param array $criteria
     */
    public function update($featureData)
    {
        /** @var Feature $feature */
        $feature                     = $this->create($featureData);
        $data                        = $this->cleanFeatureData($feature->toArray());
        $connection                  = $this->getConnection();
        $data[$this->getGeomField()] = $this->transformEwkt($data[$this->getGeomField()]);
        unset($data[$this->getUniqueId()]);

        if (empty($data)) {
            throw new \Exception("Feature can't be updated without criteria");
        }

        $tableName = $this->getTableName();
        $connection->update($tableName, $data, array($this->getUniqueId() => $feature->getId()));
        return $feature;
    }

    /**
     * Search feature by criteria
     *
     * @param array $criteria
     * @return Feature[]
     */
    public function search(array $criteria = array())
    {
        /** @var Statement $statement */
        /** @var Feature $feature */
        $maxResults   = isset($criteria['maxResults']) ? intval($criteria['maxResults']) : self::MAX_RESULTS;
        $intersect    = isset($criteria['intersectGeometry']) ? $criteria['intersectGeometry'] : null;
        $returnType   = isset($criteria['returnType']) ? $criteria['returnType'] : null;
        $srid         = isset($criteria['srid']) ? $criteria['srid'] : $this->getSrid();
        $where        = isset($criteria['where']) ? $criteria['where'] : null;
        $queryBuilder = $this->getSelectQueryBuilder($srid);
        $connection   = $queryBuilder->getConnection();

        // add GEOM where condition
        if ($intersect) {
            $geometry = self::roundGeometry($intersect, 2);
            $queryBuilder->andWhere(self::genIntersectCondition($this->getPlatformName(), $geometry, $this->geomField, $srid, $this->getSrid()));
        }

        // add filter (https://trac.wheregroup.com/cp/issues/3733)
        if (!empty($this->sqlFilter)) {
            $queryBuilder->andWhere($this->sqlFilter);
        }

        // add second filter (https://trac.wheregroup.com/cp/issues/4643)
        if ($where) {
            $queryBuilder->andWhere($where);
        }

        if (isset($criteria["source"]) && isset($criteria["distance"])) {
            $queryBuilder->andWhere("ST_DWithin(t." . $this->getGeomField() . ","
                . $connection->quote($criteria["source"])
                . "," . $criteria['distance'].')');
        }

        $queryBuilder->setMaxResults($maxResults);
        // $queryBuilder->setParameters($params);
        // $sql = $queryBuilder->getSQL();

        $statement  = $queryBuilder->execute();
        $rows       = $statement->fetchAll();
        $hasResults = count($rows) > 0;

        // Convert to Feature object
        if ($hasResults) {
            $this->prepareResults($rows, $srid);
        }

        if ($returnType == "FeatureCollection") {
            $rows = $this->toFeatureCollection($rows);
        }

        return $rows;
    }

    /**
     * Get unique ID
     *
     * @return mixed unique ID
     */
    public function getUniqueId()
    {
        return $this->driver->getUniqueId();
    }

    /**
     * @return string
     */
    public function getTableName()
    {
        return $this->driver->getTableName();
    }

    /**
     * @return string
     */
    public function getGeomField()
    {
        return $this->geomField;
    }

    /**
     * @return array
     */
    public function getFields()
    {
        return $this->getDriver()->getFields();
    }

    /**
     * Transform result column names from lower case to upper
     *
     * @param        $rows         array Two dimensional array link
     * @param string $functionName function name to call for each field name
     */
    public static function transformColumnNames(&$rows, $functionName = "strtolower")
    {
        $columnNames = array_keys(current($rows));
        foreach ($rows as &$row) {
            foreach ($columnNames as $name) {
                $row[$functionName($name)] = &$row[$name];
                unset($row[$name]);
            }
        }
    }

    /**
     * Generate intersect where condition
     *
     * @param $platformName
     * @param $geometry
     * @param $geometryAttribute
     * @param $srid   string SRID from
     * @param $sridTo string SRID to
     * @return null|string
     */
    public static function genIntersectCondition($platformName, $geometry, $geometryAttribute, $srid, $sridTo)
    {
        $sql = null;
        switch ($platformName) {
            case self::POSTGRESQL_PLATFORM:
                $sql = "ST_INTERSECTS(ST_TRANSFORM(ST_GEOMFROMTEXT('$geometry',$srid),$sridTo),$geometryAttribute)";
                break;
            case self::ORACLE_PLATFORM:
                $sql = "SDO_RELATE($geometryAttribute ,SDO_GEOMETRY(SDO_CS.TRANSFORM('$geometry',$srid),$sridTo), 'mask=ANYINTERACT querytype=WINDOW') = 'TRUE'";
                break;
        }
        return $sql;
    }


    /**
     * Get geometry attribute
     *
     * @param $platformName
     * @param $geometryAttribute
     * @param $sridTo
     * @return null|string
     */
    public static function getGeomAttribute($platformName, $geometryAttribute, $sridTo)
    {
        $sql = null;
        switch ($platformName) {
            case self::POSTGRESQL_PLATFORM:
                $sql = "ST_ASTEXT(ST_TRANSFORM($geometryAttribute, $sridTo)) AS $geometryAttribute";
                break;
            case self::ORACLE_PLATFORM:
                $sql = "SDO_UTIL.TO_WKTGEOMETRY(SDO_CS.TRANSFORM($geometryAttribute, $sridTo)) AS $geometryAttribute";
                break;
        }
        return $sql ? $sql : $geometryAttribute;
    }


    /**
     *
     * Round geometry up to $round parameter.
     *
     * Default: geometry round = 0.2
     *
     * @param string $geometry WKT
     * @return string WKT
     */
    public static function roundGeometry($geometry, $round = 2)
    {
        return preg_replace("/(\\d+)\\.(\\d{$round})\\d+/", '$1.$2', $geometry);
    }

    /**
     * Convert results to Feature objects
     *
     * @param Feature[] $rows
     * @param null      $srid
     * @return Feature[]
     */
    public function prepareResults(&$rows, $srid = null)
    {
        $hasSrid = $srid != null;
        // Transform Oracle result column names from upper to lower case
        if ($this->isOracle()) {
            self::transformColumnNames($rows, "strtolower");
        }

        foreach ($rows as $key => &$row) {
            $row = $this->create($row);
            if ($hasSrid) {
                $row->setSrid($srid);
            }
        }

        return $rows;
    }

    /**
     * Get query builder prepared to select from the source table
     *
     * @param null $srid
     * @return QueryBuilder
     */
    public function getSelectQueryBuilder($srid = null)
    {
        $connection         = $this->getConnection();
        $geomFieldCondition = self::getGeomAttribute($this->getPlatformName(), $this->geomField, $srid ? $srid : $this->getSrid());
        $spatialFields      = array($this->getUniqueId(), $geomFieldCondition);
        $attributes         = array_merge($spatialFields, $this->getFields());
        $queryBuilder       = $connection->createQueryBuilder()->select($attributes)->from($this->getTableName(), 't');
        return $queryBuilder;
    }

    /**
     * Cast feature by $args
     *
     * @param $args
     * @return Feature
     */
    public function create($args)
    {
        $feature = null;
        if (is_object($args)) {
            if ($args instanceof Feature) {
                $feature = $args;
            } else {
                $args = get_object_vars($args);
            }
        } elseif (is_numeric($args)) {
            $args = array($this->getUniqueId() => intval($args));
        }
        return $feature && $feature instanceof Feature ? $feature : new Feature($args, $this->getSrid(), $this->getUniqueId(), $this->getGeomField());
    }

    /**
     * Get SRID
     *
     * @return int
     */
    public function getSrid()
    {
        if (!$this->srid) {
            $connection = $this->getConnection();
            $tableName  = $this->getTableName();
            switch ($this->getPlatformName()) {
                case self::POSTGRESQL_PLATFORM:
                    $this->srid = $connection->fetchColumn("SELECT Find_SRID(concat(current_schema()), '" . $tableName . "', '$this->geomField')");
                    break;
                // TODO: not tested
                case self::ORACLE_PLATFORM:
                    $this->srid = $connection->fetchColumn("SELECT {$tableName}.{$this->geomField}.SDO_SRID FROM TABLE " . $tableName);
                    break;
            }
        }
        return $this->srid;
    }

    /**
     * Convert Features[] to FeatureCollection
     *
     * @param Feature[] $rows
     * @return array FeatureCollection
     */
    public function toFeatureCollection($rows)
    {
        /** @var Feature $feature */
        foreach ($rows as $k => $feature) {
            $rows[$k] = $feature->toGeoJson(true);
        }
        return array("type"     => "FeatureCollection",
                     "features" => $rows);
    }

    /**
     * Clean data this can't be saved into db table from data array
     *
     * @param array $data
     * @return array
     */
    private function cleanFeatureData($data)
    {
        $fields = array_merge($this->getFields(), array($this->getUniqueId(), $this->getGeomField()));

        // clean data from feature
        foreach ($data as $fieldName => $value) {
            if (isset($fields[$fieldName])) {
                unset($data[$fieldName]);
            }
        }
        return $data;
    }

    /**
     * Add geometry column
     *
     * @param string $tableName
     * @param string $type
     * @param string $srid
     * @param string $geomFieldName
     * @param string $schemaName
     * @param int    $dimensions
     * @return bool
     * @throws \Doctrine\DBAL\DBALException
     */
    public function addGeometryColumn($tableName,
        $type,
        $srid,
        $geomFieldName = "geom",
        $schemaName = "public",
        $dimensions = 2)
    {
        $r = false;
        if ($this->driver instanceof Geographic) {
            /** @var Geographic $driver */
            $driver = $this->getDriver();
            $driver->addGeometryColumn($tableName, $type, $srid, $geomFieldName, $schemaName, $dimensions);
            $r = true;
        }
        return $r;
    }

    /**
     * Set FeatureType permanent SQL filter used by $this->search()
     * https://trac.wheregroup.com/cp/issues/3733
     *
     * @see $this->search()
     * @param $sqlFilter
     */
    protected function setFilter($sqlFilter)
    {
        $this->sqlFilter = $sqlFilter;
    }

    /**
     * Get sequence name
     *
     * @return string sequence name
     * @throws \Doctrine\DBAL\DBALException
     */
    public function getTableSequenceName()
    {
        $connection = $this->getConnection();
        $result     = $connection->fetchColumn("SELECT column_default from information_schema.columns where table_name='" . $this->getTableName() . "' and column_name='" . $this->getUniqueId() . "'");
        $result     = explode("'", $result);
        return $result[0];
    }

    /**
     * Repair table sequence.
     * Set sequence next ID to (highest ID + 1) in the table
     *
     * @return int last insert ID
     * @throws \Doctrine\DBAL\DBALException
     */
    public function repairTableSequence()
    {
        return $this->getConnection()->fetchColumn("SELECT setval('" . $this->getTableSequenceName() . "', (SELECT MAX(" . $this->getUniqueId() . ") FROM " . $this->getTableName() . "))");
    }

    /**
     * Get files directory, relative to base upload directory
     *
     * @param null $fieldName
     * @return string
     */
    public function getFileUri($fieldName = null)
    {
        $path = self::UPLOAD_DIR_NAME . "/" . $this->getTableName();

        if ($fieldName) {
            $path .= "/" . $fieldName;
        }

        foreach ($this->getFileInfo() as $fileInfo) {
            if (isset($fileInfo["field"]) && isset($fileInfo["uri"]) && $fieldName == $fileInfo["field"]) {
                $path = $fileInfo["uri"];
                break;
            }
        }

        return $path;
    }

    /**
     * Get files base path
     *
     * @param null $fieldName  file field name
     * @param bool $createPath check and create path?
     * @return string
     */
    public function getFilePath($fieldName = null, $createPath = true)
    {
        $path = realpath(AppComponent::getUploadsDir($this->container)) . "/" . $this->getFileUri($fieldName);

        foreach ($this->getFileInfo() as $fileInfo) {
            if (isset($fileInfo["field"]) && isset($fileInfo["path"]) && $fieldName == $fileInfo["field"]) {
                $path = $fileInfo["path"];
                break;
            }
        }

        if ($createPath && !is_dir($path)) {
            mkdir($path, 0775, true);
        }

        return $path;
    }

    /**
     * @param string $fieldName
     * @return string
     */
    public function getFileUrl($fieldName = "")
    {
        $baseUrl   = AppComponent::getBaseUrl($this->container);
        $uploadDir = AppComponent::getUploadsDir($this->container, true) . "/";

        foreach ($this->getFileInfo() as $fileInfo) {
            if (isset($fileInfo["field"]) && isset($fileInfo["uri"]) && $fieldName == $fileInfo["field"]) {
                $uploadDir = "";
                break;
            }
        }

        $fileUri = $this->getFileUri($fieldName);
        $url     = strpos($fileUri, "/") === 0 ? $fileUri : $baseUrl . '/' . $uploadDir . $fileUri;
        return $url;
    }

    /**
     * Generate unique file name for a field.
     *
     * @param null $fieldName Field
     * @return string
     * @internal param string $extension File extension
     */
    public function genFilePath($fieldName = null)
    {
        $id   = $this->countFiles($fieldName) + 1;
        $src  = null;
        $path = null;

        while (1) {
            $path = $id; //. "-" . System::generatePassword(12) ;
            $src  = $this->getFilePath($fieldName) . "/" . $path;
            if (!file_exists($src)) {
                break;
            }
            $id++;
        }

        return array(
            "src"  => $src,
            "path" => $path
        );
    }

    /**
     * Count files in the field directory
     *
     * @param null $fieldName
     * @return int
     */
    private function countFiles($fieldName = null)
    {
        $finder = new Finder();
        $finder->files()->in($this->getFilePath($fieldName));
        return count($finder);
    }

    /**
     * @param $fileInfo
     * @internal param $fileInfos
     */
    public function setFiles($fileInfo)
    {
        $this->filesInfo = $fileInfo;
    }

    /**
     * @return array
     */
    public function getFileInfo()
    {
        return $this->filesInfo;
    }

    /**
     * @param        $tableName
     * @param string $schema
     * @return mixed|null
     */
    public function getGeomType($tableName, $schema = null)
    {
        $driver = $this->getDriver();
        $type   = null;
        if($driver instanceof Geographic){
            /** @var Geographic|PostgreSQL $driver */
            $type = $driver->getTableGeomType($tableName,$schema);
        }
        return $type;
    }

    /**
     * Detect (E)WKT geometry type
     *
     * @param $wkt
     * @return string
     */
    public static function getWktType($wkt)
    {
        $isEwkt = strpos($wkt, 'SRID') === 0;
        if ($isEwkt) {
            $wkt = substr($wkt, strpos($wkt, ';') + 1);
        }
        return substr($wkt, 0, strpos($wkt, '('));
    }
}