<?php


namespace Mapbender\DataManagerBundle\Component;


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
     * @param ItemSchema $schema
     * @return string
     */
    public function getFilterSql(ItemSchema $schema)
    {
        if (empty($schema->repositoryConfig['userColumn'])) {
            throw new ConfigurationErrorException("Cannot filter data by user without a 'userColumn' setting in the dataStore or featureType.");
        }

        $connection = $schema->getRepository()->getConnection();
        $columnRef = $connection->quoteIdentifier($schema->repositoryConfig['userColumn']);
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
     * @param ItemSchema $schema
     * @param DataItem $item
     * @return mixed[]
     */
    public function getStorageValues(ItemSchema $schema, DataItem $item)
    {
        if (!empty($schema->config['filterUser']) || !empty($schema->config['trackUser'])) {
            if (empty($schema->repositoryConfig['userColumn'])) {
                throw new ConfigurationErrorException("Cannot store modifying user without a 'userColumn' setting in the dataStore or featureType.");
            }
            $userColumn = $schema->repositoryConfig['userColumn'];

            return array(
                // Prefer empty string for compatibility with non-nullable column
                // (default select filter makes no distinction between null and empty string)
                $userColumn => $this->getFilterValue() ?: '',
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
        if ($token == null) {
            throw new \Exception("api.query.error-notloggedin");
        }
        if ($token instanceof AnonymousToken) {
            return null;
        } else {
            return $token->getUsername();
        }
    }
}
