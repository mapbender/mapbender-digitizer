<?php
namespace Mapbender\DataSourceBundle\Entity;

/**
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 */
class DataItem implements \ArrayAccess
{
    /** @var mixed[] */
    protected $attributes = array();

    /** @var string */
    protected $uniqueIdField;

    /**
     * @param mixed[] $attributes array
     * @param string $uniqueIdField ID field name
     * @internal
     */
    public function __construct(array $attributes = array(), $uniqueIdField = 'id')
    {
        $this->uniqueIdField = $uniqueIdField;
        if (!array_key_exists($this->uniqueIdField, $attributes)) {
            // ensure getId works
            $attributes[$this->uniqueIdField] = null;
        }
        $this->setAttributes($attributes);
    }

    /**
     * @return array
     */
    public function toArray()
    {
        return $this->attributes;
    }

    /**
     * @param mixed $id
     */
    public function setId($id)
    {
        $this->attributes[$this->uniqueIdField] = $id;
    }

    /**
     * Is id not null
     *
     * @return bool
     * @deprecated use getId and coerce to boolean
     */
    public function hasId()
    {
        return !is_null($this->getId());
    }

    /**
     * Get id
     *
     * @return integer
     */
    public function getId()
    {
        return $this->attributes[$this->uniqueIdField];
    }

    /**
     * Get attributes
     *
     * @return mixed[]
     */
    public function getAttributes()
    {
        return $this->attributes;
    }

    /**
     * @param string $name
     * @return mixed
     */
    public function getAttribute($name)
    {
        return $this->attributes[$name];
    }

    /**
     * ADD attributes
     *
     * @param mixed $attributes
     */
    public function setAttributes($attributes)
    {
        $this->attributes = array_merge($this->attributes, $attributes);
    }

    /**
     * Set attribute
     *
     * @param string $key
     * @param mixed $value
     */
    public function setAttribute($key, $value)
    {
        $this->attributes[ $key ] = $value;
    }

    public function offsetExists($offset)
    {
        return \array_key_exists($offset, $this->attributes);
    }

    public function offsetGet($offset)
    {
        return $this->attributes[$offset];
    }

    public function offsetSet($offset, $value)
    {
        $this->setAttribute($offset, $value);
    }

    public function offsetUnset($offset)
    {
        unset($this->attributes[$offset]);
    }
}
