<?php
namespace Mapbender\DataSourceBundle\Tests;

use Mapbender\DataSourceBundle\Component\Factory\FeatureTypeFactory;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Entity\Feature;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;


/**
 * @author    Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 2015 by WhereGroup GmbH & Co. KG
 */
class FeaturesTest extends KernelTestCase
{
    /**
     * @var FeatureType
     */
    protected static $featureType;

    public static function setUpBeforeClass()
    {
        $kernel = self::bootKernel();
        $container = $kernel->getContainer();
        if (!$container->hasParameter('featureTypes')) {
            self::markTestSkipped("Missing featureTypes container param");
        }
        $definitions = $container->getParameter('featureTypes');
        $ftConfig = \array_values($definitions)[0];
        /** @var FeatureTypeFactory $ftFactory */
        $ftFactory = $container->get('mbds.default_featuretype_factory');
        self::$featureType = $ftFactory->fromConfig($ftConfig);
        self::$fieldName   = current(self::$featureType->getFields());
    }

    public function testSearch()
    {
        self::$featureType->search(array());
    }

    public function testCustomSearch()
    {
        $results = self::$featureType->search(array('maxResults' => 1));
        $this->assertTrue(is_array($results));
        $this->assertTrue(count($results) <= 1);
    }

    public function testSaveArray()
    {
        $idName = self::$featureType->getUniqueId();
        $featureData = array($idName => "testSaveArray");
        $feature     = self::$featureType->save($featureData);
        $this->assertTrue($feature instanceof Feature);
    }

    public function testSaveObject()
    {
        $idName = self::$featureType->getUniqueId();
        $featureData = array($idName => "testSaveObject");
        $feature = self::$featureType->itemFromArray($featureData);
        $this->assertTrue($feature instanceof Feature);
        $feature = self::$featureType->save($feature);
        $this->assertTrue($feature instanceof Feature);
    }

    public function testGetById()
    {
        $originFeature = $this->getRandomFeature();
        $feature       = self::$featureType->getById($originFeature->getId());
        $this->assertTrue($feature instanceof Feature);
        $this->assertTrue($feature->getId() == $originFeature->getId(), "ID is incorrect");
    }

    public function testRemove()
    {
        $featureType = self::$featureType;
        $this->assertGreaterThan(0, $featureType->remove("testSaveArray"));
        $this->assertGreaterThan(0, $featureType->remove("testSaveObject"));
    }

    public function testUpdate()
    {
        $originFeature = $this->getRandomFeature();
        self::$featureType->save($originFeature);
    }

    /**
     * @param int $maxResults
     * @return Feature
     */
    private function getRandomFeature($maxResults = 10)
    {
        $features      = self::$featureType->search(array('maxResults' => $maxResults));
        $originFeature = $features[ rand(1, count($features)) - 1 ];
        return $originFeature;
    }
}
