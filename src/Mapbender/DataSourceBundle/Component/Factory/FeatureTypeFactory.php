<?php

namespace Mapbender\DataSourceBundle\Component\Factory;

use Mapbender\DataSourceBundle\Component\FeatureType;

/**
 * Factory for creating FeatureType instances from configuration arrays.
 *
 * Service id: mbds.default_featuretype_factory
 */
class FeatureTypeFactory extends DataStoreFactory
{
    public function fromConfig(array $config): FeatureType
    {
        $config += $this->getConfigDefaults();
        $connection = $this->getDbalConnectionByName($config['connection']);
        return new FeatureType($connection, $this->tokenStorage, $config);
    }

    protected function getConfigDefaults(): array
    {
        return parent::getConfigDefaults() + [
            'geomField' => 'geom',
        ];
    }
}
