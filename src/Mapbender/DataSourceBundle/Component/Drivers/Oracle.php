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
        $platform = $connection->getDatabasePlatform();
        $sql = $platform->getListTableColumnsSQL($tableName);

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
        /** @see \Doctrine\DBAL\Platforms\OraclePlatform::getListTableColumnsSQL */
        /** @see \Doctrine\DBAL\Schema\OracleSchemaManager::_getPortableTableColumnDefinition */
        foreach ($connection->executeQuery($sql) as $row) {
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
