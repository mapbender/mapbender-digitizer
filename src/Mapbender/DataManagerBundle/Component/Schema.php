<?php


namespace Mapbender\DataManagerBundle\Component;


/**
 * Schema base class (CombinationSchema + concrete ItemSchema)
 *
 * Provides a name and the base config + defaults.
 */
abstract class Schema
{
    /** @var array */
    public $config;
    /** @var string */
    protected $name;

    public function __construct($name, array $config)
    {
        $this->name = $name;
        $this->config = $config;
    }

    public function getName()
    {
        return $this->name;
    }

    /**
     * @return string[]
     */
    abstract public function getSubSchemaNames();
}
