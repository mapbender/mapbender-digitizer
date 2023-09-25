<?php


namespace Mapbender\DataSourceBundle\Component\Factory;


use Mapbender\DataSourceBundle\Component\FeatureType;

/**
 * Implementation for service id mbds.default_featuretype_factory
 * @since 0.1.22
 */
class FeatureTypeFactory extends DataStoreFactory
{
    public function fromConfig(array $config)
    {
        $config += $this->getConfigDefaults();
        $connection = $this->getDbalConnectionByName($config['connection']);
        return new FeatureType($connection, $this->tokenStorage, $this->eventProcessor, $config);
    }

    protected function getConfigDefaults()
    {
        return parent::getConfigDefaults() + array(
            'geomField' => 'geom',
        );
    }
}
