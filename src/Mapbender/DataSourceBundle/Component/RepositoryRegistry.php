<?php


namespace Mapbender\DataSourceBundle\Component;


use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\Factory\DataStoreFactory;

/**
 * Container-unaware (Symfony 4+) portions of DataStoreService / FeatureTypeService
 *
 * @since 0.1.22
 */
class RepositoryRegistry
{
    /** @var DataStoreFactory */
    protected $factory;
    /** @var mixed[][] */
    protected $repositoryConfigs;
    /** @var DataStore[] */
    protected $repositories = array();

    /**
     * @param DataStoreFactory $factory
     * @param mixed[][] $repositoryConfigs
     */
    public function __construct(DataStoreFactory $factory,
                                array $repositoryConfigs)
    {
        $this->factory = $factory;
        $this->repositoryConfigs = $repositoryConfigs;
    }

    /**
     * @param array $config
     * @return DataStore
     */
    public function dataStoreFactory(array $config)
    {
        return $this->factory->fromConfig($config);
    }

    /**
     * @param string $name
     * @return DataStore
     * @since 0.1.15
     */
    public function getDataStoreByName($name)
    {
        if (!$name) {
            throw new \InvalidArgumentException("Empty dataStore / featureType name " . var_export($name, true));
        }
        if (!\array_key_exists($name, $this->repositories)) {
            $this->repositories[$name] = $this->dataStoreFactory($this->repositoryConfigs[$name]);
        }
        return $this->repositories[$name];
    }

    /**
     * @return mixed[][]
     * @since 0.1.8
     */
    public function getDataStoreDeclarations()
    {
        return $this->repositoryConfigs;
    }

    /**
     * Alias for dataStoreFactory
     *
     * @param mixed[] $config
     * @return DataStore
     * @since 0.1.15
     * @deprecated use aliased method directly
     * aliased @since 0.1.22
     */
    public function featureTypeFactory(array $config)
    {
        return $this->dataStoreFactory($config);
    }

    /**
     * Alias for getDataStoreByName
     *
     * @param string $name
     * @return DataStore
     * @since 0.1.15
     * @deprecated use aliased method directly
     * aliased @since 0.1.22
     */
    public function getFeatureTypeByName($name)
    {
        return $this->getDataStoreByName($name);
    }

    /**
     * Alias for getDataStoreDeclarations
     *
     * @return array
     * @deprecated use aliased method directly
     * aliased @since 0.1.22
     */
    public function getFeatureTypeDeclarations()
    {
        return $this->getDataStoreDeclarations();
    }

    /**
     * @param string $name
     * @return Connection
     * @since 0.0.16
     */
    public function getDbalConnectionByName($name)
    {
        return $this->factory->getDbalConnectionByName($name);
    }
}
