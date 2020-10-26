<?php
namespace Mapbender\DigitizerBundle;

use Mapbender\CoreBundle\Component\MapbenderBundle;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;

/**
 * Digitizer Bundle.
 *
 * @author Andriy Oblivantsev
 * @author Stefan Winkelmann
 */
class MapbenderDigitizerBundle extends MapbenderBundle
{
    /**
     * @inheritdoc
     */
    public function getElements()
    {
        return array(
            'Mapbender\DigitizerBundle\Element\Digitizer'
        );
    }

    public function build(ContainerBuilder $container)
    {
        parent::build($container);
        $configLocator = new FileLocator(__DIR__ . '/Resources/config');
        $loader = new XmlFileLoader($container, $configLocator);
        $loader->load('services.xml');
    }
}

