<?php


namespace Mapbender\DataSourceBundle\Utils;


class WktUtility
{
    /**
     * Extracts the geometry type (e.g. "POLYGON") from given (E)WKT input.
     *
     * @param string $wkt
     * @return string|null for invalid input
     */
    public static function getGeometryType($wkt)
    {
        $matches = array();
        if (preg_match('#^\w+#', static::wktFromEwkt($wkt), $matches)) {
            return $matches[0];
        } else {
            return null;
        }
    }

    /**
     * Extracts the WKT portion (e.g. "POLYGON(...)") from given $ewkt input.
     * If input is already a WKT string, return it unchanged.
     *
     * @param string $ewkt
     * @return string|null for invalid input
     */
    public static function wktFromEwkt($ewkt)
    {
        $wkt = preg_replace('#^SRID=[^\;]*;#', '', $ewkt);
        if (!preg_match('#^\w+#', $wkt)) {
            return null;
        } else {
            return $wkt;
        }
    }

    /**
     * Extracts the SRID number from EWKT input.
     *
     * @param $ewkt
     * @return int|null for invalid input
     */
    public static function getEwktSrid($ewkt)
    {
        $matches = array();
        if (preg_match('#^SRID=(\d+);#', $ewkt, $matches)) {
            return intval($matches[1]) ?: null;
        } else {
            return null;
        }
    }
}
