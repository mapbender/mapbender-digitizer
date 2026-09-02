<?php


namespace Mapbender\DataSourceBundle\Component\Meta;


class Column
{
    public function __construct(
        protected bool    $nullable,
        protected bool    $hasDefault,
        protected bool    $isNumeric,
        protected ?string $geometryType = null,
        protected ?int    $srid = null,
        protected bool    $isGenerated = false)
    {
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

    public function isGenerated(): bool
    {
        return $this->isGenerated;
    }
}
