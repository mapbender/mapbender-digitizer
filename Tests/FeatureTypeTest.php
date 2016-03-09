<?php

namespace Mapbender\DigitizerBundle\Tests;

use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\DBAL\Driver\Connection;
use Mapbender\DataSourceBundle\Component\Drivers\PostgreSQL;
use Mapbender\DataSourceBundle\Tests\SymfonyTest;
use Mapbender\DigitizerBundle\Entity\Feature;
use Mapbender\DigitizerBundle\Entity\FeatureType;

/**
 * Class FeatureTypeTest
 *
 * @package Mapbender\DigitizerBundle\Tests
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class FeatureTypeTest extends SymfonyTest
{
    protected $configuration;

    public function setUp()
    {
        $this->configuration = array();
        $container           = self::$container;

        if ($container->hasParameter("testing")) {
            $this->configuration = $container->getParameter("testing");
        }

        if(!isset($this->configuration["featureType"])){
            self::markTestSkipped("No feature type test declaration found");
        }else{
            $this->configuration = $this->configuration["featureType"];
        }
    }

    /**
     * POINT
     * • LINESTRING
    • POLYGON
    • MULTIPOINT
    • MULTILINESTRING
    • MULTIPOLYGON
    • GEOMETRYCOLLECTION
     */
    public function testSomething()
    {
        /** @var Connection $db */
        /** @var Registry $doctrine */
        $container      = self::$container;
        $doctrine       = $container->get("doctrine");
        $connectionName = $this->configuration['connection'];
        $db             = $doctrine->getConnection($connectionName);
        $version        = $db->query("SELECT version()")->fetchColumn();
        $schemaName     = 'public';
        $tableName      = "test_points";
        $srid           = 4326;
        $type           = 'POINT';
        $geomFieldName  = 'geom';
        $uniqueIdField  = 'id';
        $wkt            = 'POINT(-110 30)';
        $featureType    = new FeatureType($container, array(
            'connection' => $connectionName,
            'table'      => $tableName,
            'srid'       => $srid,
            'geomField'  => $geomFieldName
        ));
        $feature = new Feature(array(
            'geometry'   => $wkt,
            'properties' => array(
            )
        ), $srid, $uniqueIdField, $geomFieldName);

        /** @var PostgreSQL $driver */
        $driver = $featureType->getDriver();
        $driver->createTable($tableName, $uniqueIdField, true);
        $featureType->addGeometryColumn($tableName, $type, $srid, $geomFieldName);
        $savedFeature = $featureType->save($feature);
        $this->assertEquals($savedFeature->getGeom(), $wkt);

        //CREATE TABLE gtest ( gid serial primary key, name varchar(20)
        //, geom geometry(LINESTRING) );
        //$featureType = new FeatureType(self::$container);
    }
}