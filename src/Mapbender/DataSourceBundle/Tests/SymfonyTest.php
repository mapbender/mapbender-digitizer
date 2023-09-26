<?php
namespace Mapbender\DataSourceBundle\Tests;

use Symfony\Bundle\FrameworkBundle\Client;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\DependencyInjection\Container;

/**
 * @package Mapbender\DataSourceBundle\Tests
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 * @deprecated extend appropriate test base class directly (WebTestCase, KernelTestCase or plain PHPUnit TestCase)
 */
abstract class SymfonyTest extends WebTestCase
{

    /** @var Client */
    protected static $client;

    /** @var Container Container */
    protected static $container;

    /**
     * Setup before run tests
     */
    public static function setUpBeforeClass()
    {
        self::$client    = static::createClient();
        self::$container = self::$client->getContainer();
    }

    /**
     * @param string $serviceName
     * @return object
     */
    protected function get($serviceName)
    {
        return static::$container->get($serviceName);
    }

    /**
     * @return Client
     */
    public function getClient()
    {
        return self::$client;
    }

    /**
     * Get symfony parameter
     *
     * @param $name
     * @return mixed
     */
    protected function getParameter($name)
    {
        return static::$container->getParameter($name);
    }
}
