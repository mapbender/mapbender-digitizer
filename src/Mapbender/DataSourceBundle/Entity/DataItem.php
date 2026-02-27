<?php
namespace Mapbender\DataSourceBundle\Entity;

class DataItem implements \ArrayAccess
{
    /** @var mixed[] */
    protected array $attributes = [];

    protected string $uniqueIdField;

    /**
     * @param mixed[] $attributes
     * @param string $uniqueIdField ID field name
     * @internal
     */
    public function __construct(array $attributes = [], string $uniqueIdField = 'id')
    {
        $this->uniqueIdField = $uniqueIdField;
        if (!array_key_exists($this->uniqueIdField, $attributes)) {
            // ensure getId works
            $attributes[$this->uniqueIdField] = null;
        }
        $this->setAttributes($attributes);
    }

    /**
     * @return mixed[]
     */
    public function toArray(): array
    {
        return $this->attributes;
    }

    public function setId(mixed $id): void
    {
        $this->attributes[$this->uniqueIdField] = $id;
    }

    /**
     * @deprecated use getId and coerce to boolean
     */
    public function hasId(): bool
    {
        return !is_null($this->getId());
    }

    public function getId(): mixed
    {
        return $this->attributes[$this->uniqueIdField];
    }

    /**
     * @return mixed[]
     */
    public function getAttributes(): array
    {
        return $this->attributes;
    }

    public function getAttribute(string $name): mixed
    {
        return $this->attributes[$name];
    }

    /**
     * Merge attributes into the existing set.
     *
     * @param mixed[] $attributes
     */
    public function setAttributes(array $attributes): void
    {
        $this->attributes = array_merge($this->attributes, $attributes);
    }

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function offsetExists($offset): bool
    {
        return \array_key_exists($offset, $this->attributes);
    }

    public function offsetGet(mixed $offset): mixed
    {
        return $this->attributes[$offset];
    }

    public function offsetSet($offset, $value): void
    {
        $this->setAttribute($offset, $value);
    }

    public function offsetUnset($offset): void
    {
        unset($this->attributes[$offset]);
    }
}
