<?php
namespace Mapbender\DigitizerBundle;

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
        parent::build($container);
        $configLocator = new FileLocator(__DIR__ . '/Resources/config');
        $loader = new XmlFileLoader($container, $configLocator);
        $loader->load('services.xml');
    }

    public function getContainerExtension()
    {
        return null;
    }
}

