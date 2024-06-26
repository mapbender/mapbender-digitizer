<?php
namespace Mapbender\DataSourceBundle\Component\Drivers;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\Meta\Column;
use Mapbender\DataSourceBundle\Component\Meta\TableMeta;

/**
 * @package Mapbender\DataSourceBundle\Component\Drivers
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class SQLite extends DoctrineBaseDriver
{
    public function loadTableMeta(Connection $connection, $tableName)
    {
        // NOTE: cannot use Doctrine SchemaManager::listTableColumns. SchemaManager
        // destroys the distinction between a column with no default and a column
        // with a null default.
        $sql = $connection->getDatabasePlatform()->getListTableColumnsSQL($tableName);
        $columns = array();
        /** @see \Doctrine\DBAL\Platforms\SqlitePlatform::getListTableColumnsSQL */
        /** @see \Doctrine\DBAL\Schema\SqliteSchemaManager::_getPortableTableColumnDefinition */
        foreach ($connection->executeQuery($sql) as $row) {
            $isNullable = !$row['notnull'];
            $hasDefault = !empty($row['dflt_value']);
            $isNumeric = !!preg_match('#int|float|double|real|decimal|numeric#i', $row['type']);
            $columns[$row['name']] = new Column($isNullable, $hasDefault, $isNumeric);
        }
        $tableMeta = new TableMeta($connection->getDatabasePlatform(), $columns);
        return $tableMeta;
    }
}
