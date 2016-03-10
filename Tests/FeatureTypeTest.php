<?php

namespace Mapbender\DigitizerBundle\Tests;

use Doctrine\Bundle\DoctrineBundle\Registry;
use Doctrine\DBAL\Driver\Connection;
use Mapbender\DataSourceBundle\Component\Drivers\Geographic;
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

    // The OGC and ISO specifications
    const WKT_POINT              = "POINT(0 0)";
    const WKT_LINESTRING         = "LINESTRING(0 0,1 1,1 2)";
    const WKT_POLYGON            = "POLYGON((0 0,4 0,4 4,0 4,0 0),(1 1, 2 1, 2 2, 1 2,1 1))";
    const WKT_MULTIPOINT         = "MULTIPOINT((0 0),(1 2))";
    const WKT_MULTILINESTRING    = "MULTILINESTRING((0 0,1 1,1 2),(2 3,3 2,5 4))";
    const WKT_MULTIPOLYGON       = "MULTIPOLYGON(((0 0,4 0,4 4,0 4,0 0),(1 1,2 1,2 2,1 2,1 1)), ((-1 -1,-1 -2,-2 -2,-2 -1,-1 -1)))";
    const WKT_GEOMETRYCOLLECTION = "GEOMETRYCOLLECTION(POINT(2 3),LINESTRING(2 3,3 4))";

    // PostGIS extended specifications
    const WKT_MULTIPOINTM         = "MULTIPOINTM(0 0 0,1 2 1)";
    const WKT_GEOMETRYCOLLECTIONM = "GEOMETRYCOLLECTIONM( POINTM(2 3 9), LINESTRINGM(2 3 4, 3 4 5) )";
    const WKT_MULTICURVE          = "MULTICURVE( (0 0, 5 5), CIRCULARSTRING(4 0, 4 4, 8 4) )( (0 0, 5 5), CIRCULARSTRING(4 0, 4 4, 8 4) )";
    const WKT_POLYHEDRALSURFACE   = "POLYHEDRALSURFACE( ((0 0 0, 0 0 1, 0 1 1, 0 1 0, 0 0 0)), ((0 0 0, 0 1 0, 1 1 0, 1 0 0, 0 0 0)), ((0 0 0, 1 0 0, 1 0 1, 0 0 1, 0
0 0)), ((1 1 0, 1 1 1, 1 0 1, 1 0 0, 1 1 0)), ((0 1 0, 0 1 1, 1 1 1, 1 1 0, 0 1 0)), ((0 0 1, 1 0 1, 1 1 1, 0 1 1, 0 0 1)) )";
    const WKT_TRIANGLE            = "TRIANGLE ((0 0, 0 9, 9 0, 0 0))";
    const WKT_TIN                 = "TIN( ((0 0 0, 0 0 1, 0 1 0, 0 0 0)), ((0 0 0, 0 1 0, 1 1 0, 0 0 0)) )";
    const WKT_CIRCULARSTRING      = "CIRCULARSTRING(0 0, 1 1, 1 0)";
    const WKT_COMPOUNDCURVE       = "COMPOUNDCURVE(CIRCULARSTRING(0 0, 1 1, 1 0),(1 0, 0 1))";
    const WKT_CURVEPOLYGON        = "CURVEPOLYGON(CIRCULARSTRING(0 0, 4 0, 4 4, 0 4, 0 0),(1 1, 3 3, 3 1, 1 1))";
    const WKT_MULTISURFACE        = "MULTISURFACE(CURVEPOLYGON(CIRCULARSTRING(0 0, 4 0, 4 4, 0 4, 0 0),(1 1, 3 3, 3 1, 1 1)),((10 10, 14 12, 11 10,
10 10),(11 11, 11.5 11, 11 11.5, 11 11)))";


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

        /** @var PostgreSQL|Geographic $driver */
        $driver = $featureType->getDriver();
        $driver->addGeometryColumn();
        $driver->createTable($tableName, $uniqueIdField, true);
        $featureType->addGeometryColumn($tableName, $type, $srid, $geomFieldName);
        $savedFeature = $featureType->save($feature);
        $this->assertEquals($savedFeature->getGeom(), $wkt);

        //CREATE TABLE gtest ( gid serial primary key, name varchar(20)
        //, geom geometry(LINESTRING) );
        //$featureType = new FeatureType(self::$container);
    }
}