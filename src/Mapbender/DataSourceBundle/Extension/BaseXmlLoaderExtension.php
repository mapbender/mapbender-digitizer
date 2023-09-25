<?php
namespace Mapbender\DataSourceBundle\Extension;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;
use Symfony\Component\HttpKernel\DependencyInjection\Extension;

/**
 * @package Mapbender\DataSourceBundle\Extension
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 *
 * @deprecated use Bundle::build to load configuration
 */
class BaseXmlLoaderExtension extends Extension
{
    protected $xmlFileName = 'services.xml';
    protected $xmlFilePath = '/../Resources/config';
    protected $reflector;

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->reflector = new \ReflectionClass(get_class($this));
    }

    /**
     * Loads a specific configuration.
     *
     * @param array            $configs
     * @param ContainerBuilder $container
     */
    public function load(array $configs, ContainerBuilder $container)
    {
        $fileSrc = dirname($this->reflector->getFileName()) . $this->xmlFilePath;
        $loader  = new XmlFileLoader($container, new FileLocator($fileSrc));
        $loader->load($this->xmlFileName);
    }
}
