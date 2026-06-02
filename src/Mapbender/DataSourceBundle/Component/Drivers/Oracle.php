<?php
namespace Mapbender\DataSourceBundle\Component\Drivers;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\Drivers\Interfaces\Geographic;
use Mapbender\DataSourceBundle\Component\Meta\Column;
use Mapbender\DataSourceBundle\Component\Meta\TableMeta;

/**
 * @package Mapbender\DataSourceBundle\Component\Drivers
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class Oracle extends DoctrineBaseDriver implements Geographic
{
    /**
     * Transform result column names from lower case to upper
     *
     * @param array[] $rows
     */
    public static function transformColumnNames(&$rows)
    {
        if (!$rows) {
            $columnNames = array();
        } else {
            $columnNames = array_keys(current($rows));
        }
        foreach ($rows as &$row) {
            foreach ($columnNames as $name) {
                $row[ strtolower($name) ] = &$row[ $name ];
                unset($row[ $name ]);
            }
        }
    }

    public function getReadEwktSql($data)
    {
        return "SDO_UTIL.TO_WKBGEOMETRY({$data})";
    }

    public function getTransformSql($data, $sridTo)
    {
        if (!$sridTo || !\is_numeric($sridTo)) {
            throw new \InvalidArgumentException("Invalid sridTo " . print_r($sridTo, true));
        }
        return "SDO_CS.TRANSFORM({$data}, " . intval($sridTo) . ')';
    }

    public function getDumpWktSql($data)
    {
        return "SDO_UTIL.TO_WKTGEOMETRY({$data})";
    }

    /**
     * @param string $geomExpression
     * @return string
     */
    public function getPromoteToCollectionSql($geomExpression)
    {
        // no implementation
        // @todo: support this? Use cases?
        return $geomExpression;
    }

    public function getIntersectCondition($geomExpressionA, $geomExpressionB)
    {
        return "SDO_RELATE({$geomExpressionA}, {$geomExpressionB}, 'mask=ANYINTERACT querytype=WINDOW') = 'TRUE'";
    }

    /**
     * @inheritdoc
     */
    public function getGeomAttributeAsWkt($geomReference, $sridTo)
    {
      return "SDO_UTIL.TO_WKTGEOMETRY(SDO_CS.TRANSFORM($geomReference, $sridTo))";
    }

    public function getColumnToEwktSql($column, $sridTo)
    {
        return "CASE WHEN {$column} IS NOT NULL THEN"
            .  " CONCAT('SRID={$sridTo};', "
            . $this->getGeomAttributeAsWkt($column, $sridTo)
            . " ELSE NULL END"
        ;
    }

    public function loadTableMeta(Connection $connection, $tableName)
    {
        // NOTE: cannot use Doctrine SchemaManager. SchemaManager will throw when encountering
        // geometry type columns. Internal SchemaManager Column metadata APIs are
        // closed to querying individual columns.
        // getListTableColumnsSQL() was removed in DBAL 4; use ALL_TAB_COLUMNS directly.
        $platform = $connection->getDatabasePlatform();
        $columnSql = 'SELECT LOWER(C.COLUMN_NAME) AS column_name,'
            . ' LOWER(C.DATA_TYPE) AS data_type,'
            . ' C.DATA_DEFAULT AS data_default,'
            . ' C.NULLABLE AS nullable'
            . ' FROM ALL_TAB_COLUMNS C'
            . ' WHERE C.TABLE_NAME = ?'
            . ' AND C.OWNER = USER'
            . ' ORDER BY C.COLUMN_ID';

        $gmdSql = 'SELECT COLUMN_NAME, SRID FROM ALL_SDO_GEOM_METADATA'
                . ' WHERE TABLE_NAME = ' . $platform->quoteIdentifier($tableName)
        ;
        $srids = array();
        try {
            foreach ($connection->executeQuery($gmdSql) as $row) {
                $srids[$row['COLUMN_NAME']] = $row['SRID'];
            }
        } catch (\Doctrine\DBAL\Exception $e) {
            // Ignore (no spatial support?)
        }

        $columns = array();
        foreach ($connection->executeQuery($columnSql, [strtoupper($tableName)]) as $row) {
            $name = $row['column_name'];
            if (!empty($srids[\strtoupper($name)])) {
                $srid = $srids[\strtoupper($name)];
            } else {
                $srid = null;
            }

            $notNull = $row['nullable'] === 'N';
            $hasDefault = !!$row['data_default'];
            $isNumeric = !!preg_match('#int|float|double|real|decimal|numeric#i', $row['data_type']);
            $columns[$name] = new Column($notNull, $hasDefault, $isNumeric, null, $srid);
        }
        $tableMeta = new TableMeta($connection->getDatabasePlatform(), $columns);
        return $tableMeta;
    }
}
