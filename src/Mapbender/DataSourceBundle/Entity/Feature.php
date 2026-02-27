<?php
namespace Mapbender\DataSourceBundle\Entity;

use Mapbender\DataSourceBundle\Utils\WktUtility;

class Feature extends DataItem
{
    protected string $geomField;

    /**
     * @param string|null $geom
     * @return $this
     */
    public function setGeom(?string $geom): static
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
     */
    public function getGeom(): ?string
    {
        return WktUtility::wktFromEwkt($this->attributes[$this->geomField]);
    }

    /**
     * Get geometry as EWKT string.
     */
    public function getEwkt(): ?string
    {
        return $this->attributes[$this->geomField] ?: null;
    }

    public function getSrid(): ?int
    {
        return WktUtility::getEwktSrid($this->getEwkt());
    }

    public function setSrid(int $srid): void
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
    public function __construct(array $attributes = array(), string $uniqueIdField = 'id', string $geomField = 'geom')
    {
        $this->geomField = $geomField;
        // Ensure getGeom / getEwkt / getSrid works
        $attributes += array(
            $geomField => null,
        );
        parent::__construct($attributes, $uniqueIdField);
    }

    public function setAttributes(array $attributes): void
    {
        if (array_key_exists($this->geomField, $attributes)) {
            $this->setGeom($attributes[$this->geomField]);
            unset($attributes[$this->geomField]);
        }
        parent::setAttributes($attributes);
    }

    public function setAttribute(string $key, mixed $value): void
    {
        if ($key === $this->geomField) {
            $this->setGeom($value);
        } else {
            parent::setAttribute($key, $value);
        }
    }

    /**
     * Get geometry type (e.g. "POLYGON", "POINT").
     */
    public function getType(): ?string
    {
        return WktUtility::getGeometryType($this->attributes[$this->geomField]);
    }

}
