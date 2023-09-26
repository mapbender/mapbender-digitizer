<?php
namespace Mapbender\DataSourceBundle;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\Config\Resource\FileResource;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;
use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * DataSource Bundle.
 * y
 * @author Andriy Oblivantsev
 */
class MapbenderDataSourceBundle extends Bundle
{
    public function build(ContainerBuilder $container)
    {
        $configLocator = new FileLocator(__DIR__ . '/Resources/config');
        $xmlLoader = new XmlFileLoader($container, $configLocator);
        $xmlLoader->load('services.xml');
        // Auto-rebuild on config change
        $container->addResource(new FileResource($xmlLoader->getLocator()->locate('services.xml')));
    }

    public function getContainerExtension()
    {
        return null;
    }
}
