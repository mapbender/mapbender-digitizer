<?php


namespace Mapbender\DataSourceBundle\Component\Factory;


use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\EventProcessor;
use Doctrine\Persistence\ConnectionRegistry;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Implementation for service id mbds.default_datastore_factory
 * @since 0.1.22
 */
class DataStoreFactory
{
    /** @var ConnectionRegistry */
    protected $connectionRegistry;
    /** @var TokenStorageInterface */
    protected $tokenStorage;
    /** @var EventProcessor */
    protected $eventProcessor;

    public function __construct(ConnectionRegistry $connectionRegistry,
                                TokenStorageInterface $tokenStorage,
                                EventProcessor $eventProcessor)
    {
        $this->connectionRegistry = $connectionRegistry;
        $this->tokenStorage = $tokenStorage;
        $this->eventProcessor = $eventProcessor;
    }

    /**
     * @param array $config
     * @return DataStore
     */
    public function fromConfig(array $config)
    {
        $config += $this->getConfigDefaults();
        $connection = $this->getDbalConnectionByName($config['connection']);
        return new DataStore($connection, $this->tokenStorage, $this->eventProcessor, $config);
    }

    protected function getConfigDefaults()
    {
        return array(
            'uniqueId' => 'id',
            'connection' => 'default',
            'fields' => null,
        );
    }

    /**
     * @param $name
     * @return Connection
     */
    public function getDbalConnectionByName($name)
    {
        /** @var Connection $connection */
        $connection = $this->connectionRegistry->getConnection($name);
        return $connection;
    }
}
