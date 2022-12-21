<?php


namespace Mapbender\DataManagerBundle\Component;


use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\FeatureType;

/**
 * Bundle of schema and repository plus (extended, non-data-source)
 * repository config values.
 *
 * Reduces repeated lookups of assorted repository configs
 * (e.g. styleColumn required with allowCustomStyle)
 * (e.g. userColumn required with filterUser / trackUser)
 */
class Schema
{
    /** @var array */
    public $config;
    /** @var DataStore|FeatureType */
    protected $repository;
    /** @var array */
    public $repositoryConfig;

    public function __construct(array $config, DataStore $repository, array $repositoryConfig)
    {
        $this->config = $config;
        $this->repository = $repository;
        $this->repositoryConfig = $repositoryConfig;
    }

    /**
     * @return DataStore|FeatureType
     */
    public function getRepository()
    {
        return $this->repository;
    }
}
