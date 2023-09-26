<?php
namespace Mapbender\DataSourceBundle\Component;

/**
 * Features service handles feature types
 *
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 18.03.2015 by WhereGroup GmbH & Co. KG
 *
 * @method FeatureType getDataStoreByName(string $name)
 * @method FeatureType getFeatureTypeByName(string $name)
 * @method FeatureType get(string $name)
 * @method FeatureType dataStoreFactory(array $config)
 * @method FeatureType featureTypeFactory(array $config)
 * @property FeatureType[] $repositories
 *
 * @deprecated incompatible with Symfony 4 (full container injection); use RepositoryRegistry and inject `mbds.default_featuretype_factory`
 */
class FeatureTypeService extends DataStoreService
{
    protected $factoryId = 'mbds.default_featuretype_factory';
}
