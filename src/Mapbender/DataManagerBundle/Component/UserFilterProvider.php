<?php


namespace Mapbender\DataManagerBundle\Component;


use Doctrine\DBAL\Connection;
use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Component\Security\Core\Authentication\Token\AnonymousToken;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

class UserFilterProvider
{
    /** @var TokenStorageInterface */
    protected $tokenStorage;

    public function __construct(TokenStorageInterface $tokenStorage)
    {
        $this->tokenStorage = $tokenStorage;
    }

    /**
     * Returns an SQL fragment baked into the where
     * condition during select.
     *
     * Extend this if you have historic user aliasing
     * in your database (different values in the same
     * column describe effectively the same user).
     *
     * @param Connection $connection
     * @param array $storeConfig
     * @return string
     */
    public function getFilterSql(Connection $connection, array $storeConfig)
    {
        if (empty($storeConfig['userColumn'])) {
            throw new ConfigurationErrorException("Cannot filter data by user without a 'userColumn' setting in the dataStore or featureType.");
        }

        $columnRef = $connection->quoteIdentifier($storeConfig['userColumn']);
        $value = $this->getFilterValue();
        if ($value) {
            return "{$columnRef} = " . $connection->quote($value);
        } else {
            // Treat null / empty string interchangeably
            return "({$columnRef} IS NULL or LENGTH({$columnRef}) = 0)";
        }
    }

    /**
     * Returns additional user specific data to be inserted
     * into the database on save.
     *
     * Extend this if you want to add multiple columns
     * (creating user + modifying user) or treat null
     * differently.
     *
     * @param Schema $schema
     * @param DataItem $item
     * @return mixed[]
     */
    public function getStorageValues(Schema $schema, DataItem $item)
    {
        if (!empty($schema->config['filterUser']) || !empty($schema->config['trackUser'])) {
            if (empty($storeConfig['userColumn'])) {
                throw new ConfigurationErrorException("Cannot store modifying user without a 'userColumn' setting in the dataStore or featureType.");
            }

            return array(
                // Prefer empty string for compatibility with non-nullable column
                // (default select filter makes no distinction between null and empty string)
                $storeConfig['userColumn'] => $this->getFilterValue() ?: '',
            );
        } else {
            return array();
        }
    }

    /**
     * Extracts a value from the current user,
     * used for both filtering and storage.
     *
     * Extend this if you want to use non-name properties
     * of custom user objects (user id or similar)
     *
     * @return string|null
     */
    protected function getFilterValue()
    {
        $token = $this->tokenStorage->getToken();
        if ($token instanceof AnonymousToken) {
            return null;
        } else {
            return $token->getUsername();
        }
    }
}
