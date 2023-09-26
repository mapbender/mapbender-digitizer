<?php
namespace Mapbender\DataSourceBundle\Component;

use Mapbender\DataSourceBundle\Component\Factory\DataStoreFactory;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 * @deprecated incompatible with Symfony 4 (full container injection); use RepositoryRegistry and inject `mbds.default_datastore_factory`
 */
class DataStoreService extends RepositoryRegistry
{
    protected $factoryId = 'mbds.default_datastore_factory';

    /**
     * @param ContainerInterface $container
     * @param mixed[][]|string $declarations repository configs, or container param key for lookup
     */
    public function __construct(ContainerInterface $container, $declarations = 'dataStores')
    {
        /** @var DataStoreFactory $factory */
        $factory = $container->get($this->factoryId);
        $declarations = $declarations ?: array();
        if ($declarations && \is_string($declarations)) {
            $declarations = $container->getParameter($declarations);
        }

        parent::__construct($factory, $declarations ?: array());
    }

    /**
     * Get store by name
     *
     * @param string $name
     * @return DataStore
     */
    public function get($name)
    {
        return $this->getDataStoreByName($name);
    }
}
