<?php
namespace Mapbender\DataSourceBundle\Entity;

use Mapbender\DataSourceBundle\Utils\WktUtility;

/**
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 */
class Feature extends DataItem
{
    /** @var string|null */
    protected $geomField;

    /**
     * @param string|null $geom
     * @return $this
     */
    public function setGeom($geom)
    {
        if ($geom && !($newSrid = WktUtility::getEwktSrid($geom))) {
            if ($oldSrid = $this->getSrid()) {
                $geom = "SRID={$oldSrid};$geom";
            }
        }
        $this->attributes[$this->geomField] = $geom ?: null;

        return $this;
    }

    /**
     * Get geometry as WKT.
     * @return string|null
     */
    public function getGeom()
    {
        return WktUtility::wktFromEwkt($this->attributes[$this->geomField]);
    }

    /**
     * Get geometry as EWKT string.
     *
     * @return string|null
     */
    public function getEwkt()
    {
        return $this->attributes[$this->geomField] ?: null;
    }

    /**
     * @return integer|null
     */
    public function getSrid()
    {
        return WktUtility::getEwktSrid($this->getEwkt());
    }

    /**
     * @param integer $srid
     */
    public function setSrid($srid)
    {
        if ($wkt = WktUtility::wktFromEwkt($this->attributes[$this->geomField])) {
            $this->attributes[$this->geomField] = "SRID={$srid};{$wkt}";
        }
    }

    /**
     * @param mixed[] $attributes
     * @param string $uniqueIdField
     * @param string $geomField
     * @internal
     */
    public function __construct(array $attributes = array(), $uniqueIdField = 'id', $geomField = "geom")
    {
        if (\is_numeric($uniqueIdField)) {
            @trigger_error("DEPRECATED: do not pass srid to Feature constructor.", E_USER_DEPRECATED);
            $uniqueIdField = $geomField;
            $geomField = (\func_num_args() >= 4) ? \func_get_arg(3) : 'geom';
        }
        $this->geomField = $geomField;
        // Ensure getGeom / getEwkt / getSrid works
        $attributes += array(
            $geomField => null,
        );
        parent::__construct($attributes, $uniqueIdField);
    }

    /**
     * ADD attributes
     *
     * @param mixed $attributes
     */
    public function setAttributes($attributes)
    {
        if (array_key_exists($this->geomField, $attributes)) {
            $this->setGeom($attributes[$this->geomField]);
            unset($attributes[$this->geomField]);
        }
        parent::setAttributes($attributes);
    }

    public function setAttribute($key, $value)
    {
        if ($key === $this->geomField) {
            $this->setGeom($value);
        } else {
            parent::setAttribute($key, $value);
        }
    }

    /**
     * Get geometry type
     *
     * @return string|null
     */
    public function getType()
    {
        return WktUtility::getGeometryType($this->attributes[$this->geomField]);
    }

}
