<?php
namespace Mapbender\DataSourceBundle;

use Mapbender\DataSourceBundle\DependencyInjection\MapbenderDataSourceExtension;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\Config\Resource\FileResource;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\ExtensionInterface;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;
use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * DataSource Bundle.
 */
class MapbenderDataSourceBundle extends Bundle
{
    public function build(ContainerBuilder $container): void
    {
        $configLocator = new FileLocator(__DIR__ . '/Resources/config');
        $xmlLoader = new XmlFileLoader($container, $configLocator);
        $xmlLoader->load('services.xml');
        // Auto-rebuild on config change
        $container->addResource(new FileResource($xmlLoader->getLocator()->locate('services.xml')));
    }

    /**
     * Returns the DI extension that auto-registers PostGIS type mappings for Doctrine.
     *
     * Previously this returned null because the bundle had no DI configuration needs.
     * The extension was added to automatically inject PostGIS mapping_types into
     * DoctrineBundle's configuration, so projects using DataSourceBundle don't need
     * manual doctrine.yaml entries for geometry/geography column types.
     *
     * @see MapbenderDataSourceExtension for detailed rationale
     */
    public function getContainerExtension(): ?ExtensionInterface
    {
        return new MapbenderDataSourceExtension();
    }
}
