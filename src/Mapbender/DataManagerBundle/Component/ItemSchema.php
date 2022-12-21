<?php


namespace Mapbender\DataManagerBundle\Component;


use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\FeatureType;

/**
 * Schema containing concrete data (i.e. not a combination).
 * Provides the data repository plus (extended, non-data-source)
 * repository config values.
 *
 * Helps reduce repeated lookups of assorted repository configs
 * (e.g. styleColumn required with allowCustomStyle)
 * (e.g. userColumn required with filterUser / trackUser)
 */
class ItemSchema extends Schema
{
    /** @var array */
    public $repositoryConfig;
    /** @var DataStore|FeatureType */
    protected $repository;

    public function __construct($name, array $config, DataStore $repository, array $repositoryConfig)
    {
        $this->repository = $repository;
        $this->repositoryConfig = $repositoryConfig;
        parent::__construct($name, $config);
    }

    /**
     * @return DataStore|FeatureType
     */
    public function getRepository()
    {
        return $this->repository;
    }

    public function getSubSchemaNames()
    {
        return array($this->name);
    }
}
