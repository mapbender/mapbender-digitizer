<?php

namespace Mapbender\DataSourceBundle\Component\Factory;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\DataStore;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Factory for creating DataStore instances from configuration arrays.
 *
 * Service id: mbds.default_datastore_factory
 */
class DataStoreFactory
{
    protected ManagerRegistry $connectionRegistry;
    protected TokenStorageInterface $tokenStorage;

    /**
     * @param ManagerRegistry $connectionRegistry Doctrine registry
     * @param TokenStorageInterface $tokenStorage Security token storage
     * @param mixed $eventProcessor DEPRECATED, accepted but ignored for backward compatibility
     */
    public function __construct(
        ManagerRegistry $connectionRegistry,
        TokenStorageInterface $tokenStorage,
        $eventProcessor = null,
    ) {
        $this->connectionRegistry = $connectionRegistry;
        $this->tokenStorage = $tokenStorage;
    }

    /**
     * @param array $config
     * @return DataStore
     */
    public function fromConfig(array $config): DataStore
    {
        $config += $this->getConfigDefaults();
        $connection = $this->getDbalConnectionByName($config['connection']);
        return new DataStore($connection, $this->tokenStorage, $config);
    }

    protected function getConfigDefaults(): array
    {
        return [
            'uniqueId' => 'id',
            'connection' => 'default',
            'fields' => null,
        ];
    }

    /**
     * @param string $name
     * @return Connection
     */
    public function getDbalConnectionByName($name): Connection
    {
        try {
            /** @var Connection $connection */
            $connection = $this->connectionRegistry->getConnection($name);
            return $connection;
        } catch (\InvalidArgumentException $e) {
            throw new \Exception("api.query.error-database");
        }
    }
}
