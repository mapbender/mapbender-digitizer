<?php


namespace Mapbender\DataManagerBundle\Component;


/**
 * Schema that only wraps other schemas.
 * Does not contain a repository.
 */
class CombinationSchema extends Schema
{
    public function getSubSchemaNames()
    {
        return $this->config['combine'];
    }
}
