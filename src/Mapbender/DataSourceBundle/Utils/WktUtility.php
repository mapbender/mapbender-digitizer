<?php


namespace Mapbender\DataSourceBundle\Utils;


class WktUtility
{
    /**
     * Extracts the geometry type (e.g. "POLYGON") from given (E)WKT input.
     */
    public static function getGeometryType(?string $wkt): ?string
    {
        $wkt = static::wktFromEwkt($wkt);
        if ($wkt === null) {
            return null;
        }
        $matches = array();
        if (preg_match('#^\w+#', $wkt, $matches)) {
            return $matches[0];
        }
        return null;
    }

    /**
     * Extracts the WKT portion (e.g. "POLYGON(...)") from given EWKT input.
     * If input is already a WKT string, returns it unchanged.
     */
    public static function wktFromEwkt(?string $ewkt): ?string
    {
        if ($ewkt === null || $ewkt === '') {
            return null;
        }
        $wkt = preg_replace('#^SRID=[^\;]*;#', '', $ewkt);
        if (!preg_match('#^\w+#', $wkt)) {
            return null;
        }
        return $wkt;
    }

    /**
     * Extracts the SRID number from EWKT input.
     */
    public static function getEwktSrid(?string $ewkt): ?int
    {
        if ($ewkt === null || $ewkt === '') {
            return null;
        }
        $matches = array();
        if (preg_match('#^SRID=(\d+);#', $ewkt, $matches)) {
            return intval($matches[1]) ?: null;
        }
        return null;
    }
}
