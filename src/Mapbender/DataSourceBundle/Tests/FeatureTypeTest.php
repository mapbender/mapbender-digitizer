<?php
namespace Mapbender\DataSourceBundle\Tests;

use Mapbender\DataSourceBundle\Entity\Feature;
use PHPUnit\Framework\TestCase;

/**
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class FeatureTypeTest extends TestCase
{
    // The OGC and ISO specifications
    const WKT_POINT              = "POINT(0 0)";
    const WKT_LINESTRING         = "LINESTRING(0 0,1 1,1 2)";
    const WKT_POLYGON            = "POLYGON((0 0,4 0,4 4,0 4,0 0),(1 1, 2 1, 2 2, 1 2,1 1))";
    const WKT_MULTIPOINT         = "MULTIPOINT(0 0,1 2)";
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


    /**
     * Test Feature constructor and geometry getter
     */
    public function testGeometries()
    {
        foreach (array(
                     self::WKT_POINT,
                     self::WKT_POLYGON,
                     self::WKT_LINESTRING,
                     self::WKT_MULTIPOINT,
                     self::WKT_MULTILINESTRING,
                     self::WKT_MULTIPOLYGON,
                     self::WKT_GEOMETRYCOLLECTION,
                 ) as $wkt) {

            $srid          = 4326;
            $geomFieldName = 'geom';
            $uniqueIdField = 'id';
            $feature       = new Feature(array(
                $geomFieldName => "SRID={$srid};$wkt",
            ), $uniqueIdField, $geomFieldName);

            $this->assertEquals($feature->getGeom(), $wkt);
            $this->assertEquals($feature->getSrid(), $srid);
        }
    }
}
