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
class PostgreSQL extends DoctrineBaseDriver implements Geographic
{

    public function insert(Connection $connection, $tableName, array $data, $identifier)
    {
        $pData = $this->prepareInsertData($connection, $data);
        $tableName = $connection->quoteIdentifier($tableName);

        $sql = $this->getInsertSql($tableName, $pData[0], $pData[1])
            . ' RETURNING ' . $connection->quoteIdentifier($identifier)
        ;
        return $connection->fetchOne($sql, $pData[2]);
    }

    protected function prepareParamValue($value)
    {
        if (\is_bool($value)) {
            // PostgreSQL PDO will accept a variety of string representations for boolean columns
            // including 't' and 'f'
            return $value ? 't' : 'f';
        } else {
            return parent::prepareParamValue($value);
        }
    }

    public function getReadEwktSql($data)
    {
        return "ST_MakeValid(ST_GeomFromEWKT({$data}))";
    }

    public function getTransformSql($data, $sridTo)
    {
        if (!$sridTo || !\is_numeric($sridTo)) {
            throw new \InvalidArgumentException("Invalid sridTo " . print_r($sridTo, true));
        }
        return "ST_MakeValid(ST_Transform({$data}, " . intval($sridTo) . '))';
    }

    /**
     * @param string $geomExpression
     * @return string
     */
    public function getPromoteToCollectionSql($geomExpression)
    {
        return "ST_Multi({$geomExpression})";
    }

    public function getDumpWktSql($data)
    {
        return "ST_AsText({$data})";
    }

    public function getIntersectCondition($geomExpressionA, $geomExpressionB)
    {
        return "({$geomExpressionA} && {$geomExpressionB})";
    }

    /**
     * @inheritdoc
     */
    public function getGeomAttributeAsWkt($geomReference, $sridTo)
    {
        return "ST_ASTEXT(ST_TRANSFORM($geomReference, $sridTo))";
    }

    public function getColumnToEwktSql($geomReference, $sridTo)
    {
        return "ST_AsEwkt(ST_TRANSFORM($geomReference, $sridTo))";
    }

    public function loadTableMeta(Connection $connection, $tableName)
    {
        // NOTE: cannot use Doctrine SchemaManager. SchemaManager will throw when encountering
        // geometry type columns. Internal SchemaManager Column metadata APIs are
        // closed to querying individual columns.
        $platform = $connection->getDatabasePlatform();
        $gcSql = 'SELECT f_geometry_column, srid, type FROM "public"."geometry_columns"'
               . ' WHERE f_table_name = ?'
        ;
        $gcParams = array();
        if (false !== strpos($tableName, ".")) {
            $tableNameParts = explode('.', $tableName, 2);
            $gcParams[] = $tableNameParts[1];
            $gcSql .= ' AND "f_table_schema" = ?';
            $gcParams[] = $tableNameParts[0];
        } else {
            $gcParams[] = $tableName;
            $gcSql .= ' AND "f_table_schema" = current_schema()';
        }
        $gcInfos = array();
        try {
            foreach ($connection->executeQuery($gcSql, $gcParams) as $row) {
                $gcInfos[$row['f_geometry_column']] = array($row['type'], $row['srid']);
            }
        } catch (\Doctrine\DBAL\Exception $e) {
            // Ignore (DataStore on PostgreSQL / no Postgis)
        }

        $sql = $platform->getListTableColumnsSQL($tableName);
        $columns = array();
        /** @see \Doctrine\DBAL\Platforms\PostgreSqlPlatform::getListTableColumnsSQL */
        /** @see \Doctrine\DBAL\Schema\PostgreSqlSchemaManager::_getPortableTableColumnDefinition */
        $result = $connection->executeQuery($sql);
        $data = $result->fetchAllAssociative();
        foreach ($data as $row) {
            $name = trim($row['field'], '"');   // Undo quote_ident
            $notNull = !$row['isnotnull'];
            $hasDefault = !!$row['default'];
            $isNumeric = !!preg_match('#int|float|double|real|decimal|numeric#i', $row['complete_type']);
            if (!empty($gcInfos[$name])) {
                $geomType = $gcInfos[$name][0];
                $srid = $gcInfos[$name][1];
            } else {
                $geomType = $srid = null;
            }

            $columns[$name] = new Column($notNull, $hasDefault, $isNumeric, $geomType, $srid);
        }
        $tableMeta = new TableMeta($connection->getDatabasePlatform(), $columns);
        return $tableMeta;
    }
}
