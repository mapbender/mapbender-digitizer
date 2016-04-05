<?php
namespace Mapbender\DigitizerBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Mapbender\DataSourceBundle\Entity\DataItem;

/**
 * Class Feature
 *
 * @package   Mapbender\CoreBundle\Entity
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 */
class Feature extends DataItem
{
    const TYPE_POINT              = 'POINT';
    const TYPE_LINESTRING         = 'LINESTRING';
    const TYPE_POLYGON            = 'POLYGON';
    const TYPE_MULTIPOINT         = 'MULTIPOINT';
    const TYPE_MULTILINESTRING    = 'MULTILINESTRING';
    const TYPE_MULTIPOLYGON       = 'MULTIPOLYGON';
    const TYPE_GEOMETRYCOLLECTION = 'GEOMETRYCOLLECTION';

    /**
     * Geometries as WKT
     *
     * @ORM\Column(name="geom", type="text", nullable=true)
     */
    protected $geom;

    /**
     * Geometry SRID
     *
     * @ORM\Column(name="srid", type="text", nullable=true)
     */
    protected $srid;

    /**
     * GEOM field name
     *
     * @ORM\Column(name="geomFieldName", type="text", nullable=true)
     */
    protected $geomField;

    /**
     * Geometry type.
     *
     * @ORM\Column(name="type", type="text", nullable=true)
     */
    protected $type;

    /**
     * @param $geom
     * @return $this
     */
    public function setGeom($geom)
    {
        $this->geom = $geom;
        return $this;
    }

    /**
     * @return mixed
     */
    public function getGeom()
    {
        return $this->geom;
    }

    /**
     * @return mixed
     */
    public function getSrid()
    {
        return $this->srid;
    }

    /**
     * @param mixed $srid
     */
    public function setSrid($srid)
    {
        $this->srid = intval($srid);
    }

    /**
     *  has SRID?
     */
    public function hasSrid()
    {
        return !!$this->srid;
    }

    /**
     * @param mixed $args JSON or array(
     * @param int $srid
     * @param string $uniqueIdField ID field name
     * @param string $geomField GEOM field name
     */
    public function __construct($args = null, $srid = null, $uniqueIdField = 'id', $geomField = "geom")
    {
        $this->geomField = $geomField;

        // decode JSON
        if (is_string($args)) {
            $args = json_decode($args, true);
            if (isset($args["geometry"])) {
                $args["geom"] = \geoPHP::load($args["geometry"], 'json')->out('wkt');
            }
        }

        $this->setSrid($srid);

        // Is JSON feature array?
        if (is_array($args) && isset($args["geometry"]) && isset($args['properties'])) {
            $properties             = $args["properties"];
            $geom                   = $args["geometry"];
            $properties[$geomField] = $geom;

            if (isset($args['id'])) {
                $properties[$uniqueIdField] = $args['id'];
            }

            if (isset($args['srid'])) {
                $this->setSrid($args['srid']);
            }

            $args = $properties;
        }

        // set GEOM
        if (isset($args[$geomField])) {
            $this->setGeom($args[$geomField]);
            unset($args[$geomField]);
        }

        parent::__construct($args, $uniqueIdField);
    }

    /**
     * Get GeoJSON
     *
     * @param bool $decodeGeometry
     * @return array in GeoJSON format
     * @throws \exception
     */
    public function toGeoJson( $decodeGeometry = true)
    {
        $wkt = $this->getGeom();
        if($wkt){
            $wkt = \geoPHP::load($wkt, 'wkt')->out('json');
            if($decodeGeometry){
                $wkt = json_decode($wkt, true);
            }
        }

        return array('type'       => 'Feature',
                     'properties' => $this->getAttributes(),
                     'geometry'   => $wkt,
                     'id'         => $this->getId(),
                     'srid'       => $this->getSrid());
    }

    /**
     * Return GeoJSON string
     *
     * @return string
     */
    public function __toString()
    {
        return json_encode($this->toGeoJson());
    }

    /**
     * Return array
     *
     * @return mixed
     */
    public function toArray()
    {
        $data = $this->getAttributes();

        if ($this->hasGeom()) {
            //$wkb = \geoPHP::load($feature->getGeom(), 'wkt')->out('wkb');
            if ($this->getSrid()) {
                $data[$this->geomField] = "SRID=" . $this->getSrid() . ";" . $this->getGeom();
            } else {
                $data[$this->geomField] = $this->srid . ";" . $this->getGeom();
            }
        }

        if (!$this->hasId()) {
            unset($data[$this->uniqueIdField]);
        }else{
            $data[$this->uniqueIdField] = $this->getId();
        }

        return $data;
    }

    /**
     * Has geom data
     *
     * @return bool
     */
    public function hasGeom(){
        return !is_null($this->geom);
    }

    /**
     * Get geometry type
     *
     * TODO: recover type from geometry.
     *
     * @return string
     */
    public function getType()
    {
        return $this->type;
    }

    /**
     * Set geometry type
     *
     * @param string $type Feature::TYPE_*
     */
    public function setType($type)
    {
        $this->type = $type;
    }
}