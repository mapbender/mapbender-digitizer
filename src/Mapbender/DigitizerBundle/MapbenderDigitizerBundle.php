<?php
namespace Mapbender\DigitizerBundle;

use Mapbender\DataSourceBundle\MapbenderDataSourceBundle;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;
use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * Digitizer Bundle.
 *
 * @author Andriy Oblivantsev
 * @author Stefan Winkelmann
 */
class MapbenderDigitizerBundle extends Bundle
{
    public function build(ContainerBuilder $container)
    {
        // Ensure DataSourceBundle services exist (independent of kernel registration)
        $dsBundle = new MapbenderDataSourceBundle();
        $dsBundle->build($container);

        $configLocator = new FileLocator(__DIR__ . '/Resources/config');
        $loader = new XmlFileLoader($container, $configLocator);
        $loader->load('services.xml');
    }

    public function getContainerExtension()
    {
        return null;
    }
}

