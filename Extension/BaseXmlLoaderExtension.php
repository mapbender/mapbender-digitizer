<?php

namespace Mapbender\DigitizerBundle\Extension;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\XmlFileLoader;
use Symfony\Component\HttpKernel\DependencyInjection\Extension;

/**
 * Class BaseXmlLoaderExtension
 *
 * @package Mapbender\DataSourceBundle\Extension
 * @author  Andriy Oblivantsev <eslider@gmail.com>
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
     * @param ContainerBuilder $container A ContainerBuilder instance
     *
     * @internal param array $config An array of configuration values
     * @api
     * @return string
     */
    public function load(array $configs, ContainerBuilder $container)
    {
        $fileSrc = dirname($this->reflector->getFileName()) . $this->xmlFilePath;
        $loader  = new XmlFileLoader($container, new FileLocator($fileSrc));
        $loader->load($this->xmlFileName);
    }

}
