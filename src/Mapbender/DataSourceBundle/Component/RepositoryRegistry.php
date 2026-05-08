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
    protected DataStoreFactory $factory;
    /** @var mixed[][] */
    protected array $repositoryConfigs;
    /** @var DataStore[] */
    protected array $repositories = [];

    /**
     * @param mixed[][] $repositoryConfigs
     */
    public function __construct(DataStoreFactory $factory, array $repositoryConfigs)
    {
        $this->factory = $factory;
        $this->repositoryConfigs = $repositoryConfigs;
    }

    public function dataStoreFactory(array $config): DataStore
    {
        return $this->factory->fromConfig($config);
    }

    /**
     * @since 0.1.15
     */
    public function getDataStoreByName(string $name): DataStore
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
    public function getDataStoreDeclarations(): array
    {
        return $this->repositoryConfigs;
    }

    /**
     * @since 0.0.16
     */
    public function getDbalConnectionByName(string $name): Connection
    {
        return $this->factory->getDbalConnectionByName($name);
    }
}
