<?php


namespace Mapbender\DataSourceBundle\Component\Meta;


class Column
{
    /** @var bool */
    protected $nullable;
    /** @var bool */
    protected $hasDefault;
    /** @var bool */
    protected $isNumeric;
    /** @var string|null */
    protected $geometryType;
    /** @var int|null */
    protected $srid;

    /**
     * @param boolean $nullable
     * @param boolean $hasDefault
     * @param boolean $isNumeric
     * @param string|null $geometryType
     * @param int|null $srid
     */
    public function __construct($nullable, $hasDefault, $isNumeric,
                                $geometryType = null, $srid = null)
    {
        $this->nullable = $nullable;
        $this->hasDefault = $hasDefault;
        $this->isNumeric = $isNumeric;
        $this->geometryType = $geometryType;
        $this->srid = $srid;
    }

    /**
     * @return int|string|null
     */
    public function getSafeDefault()
    {
        if ($this->nullable) {
            return null;
        } elseif ($this->isNumeric) {
            return 0;
        } else {
            return '';
        }
    }

    /**
     * @return bool
     */
    public function isNullable()
    {
        return $this->nullable;
    }

    /**
     * @return bool
     */
    public function hasDefault()
    {
        return $this->hasDefault;
    }

    /**
     * @return bool
     */
    public function isNumeric()
    {
        return $this->isNumeric;
    }

    /**
     * @return string|null
     */
    public function getGeometryType()
    {
        return $this->geometryType;
    }

    /**
     * @return int|null
     */
    public function getSrid()
    {
        return $this->srid;
    }
}
