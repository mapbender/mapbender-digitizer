<?php
namespace Mapbender\DataManagerBundle;

use Mapbender\DataSourceBundle\MapbenderDataSourceBundle;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\Config\Resource\FileResource;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;
use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * Data manager bundle.
 * 
 * @author Andriy Oblivantsev
 */
class MapbenderDataManagerBundle extends Bundle
{
    public function build(ContainerBuilder $container)
    {
        // Ensure DataSourceBundle services exist (independent of kernel registration)
        $dsBundle = new MapbenderDataSourceBundle();
        $dsBundle->build($container);

        $configLocator = new FileLocator(__DIR__ . '/Resources/config');
        $loader = new XmlFileLoader($container, $configLocator);
        $loader->load('services.xml');
        $container->addResource(new FileResource($loader->getLocator()->locate('services.xml')));
        $loader->load('elements.xml');
        $container->addResource(new FileResource($loader->getLocator()->locate('elements.xml')));
    }

    public function getContainerExtension()
    {
        return null;
    }
}
