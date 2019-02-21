<?php
namespace Mapbender\DigitizerBundle\Component;

/**
 * Class SqliteExtended
 *
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class SqliteExtended extends \SQLite3
{
    const VALUE_ESC_CHAR = '\'';
    const NAME_ESC_CHAR  = '`';
    const NULL           = 'NULL';
    /** @var string File path */
    protected $filePath;
    /**
     * Instantiates an SQLite3 object and opens an SQLite 3 database
     *
     * @link  http://php.net/manual/en/sqlite3.construct.php
     * @param string $filename       <p>
     *                               Path to the SQLite database, or :memory: to use in-memory database.
     *                               </p>
     * @param int    $flags          [optional] <p>
     *                               Optional flags used to determine how to open the SQLite database. By
     *                               default, open uses SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE.
     *                               <p>
     *                               SQLITE3_OPEN_READONLY: Open the database for
     *                               reading only.
     *                               </p>
     * @param string $encryption_key [optional] <p>
     *                               An optional encryption key used when encrypting and decrypting an
     *                               SQLite database.
     *                               </p>
     * @since 5.3.0
     */
    public function __construct($filename, $flags = null, $encryption_key = null)
    {
        $this->filePath = $filename;
        parent::__construct($filename);
    }
    /**
     * Query and get results
     *
     * @param string $sql
     * @return array
     */
    public function queryAndFetch($sql, $callback = null)
    {
        $result     = array();
        $statement  = $this->query($sql);
        $isCallable = is_callable($callback);
        while ($row = $statement->fetchArray(SQLITE3_ASSOC)) {
            $result[] = $isCallable ? $callback($row) : $row;
        }
        return $result;
    }
    /**
     * @param string $sql SQL
     * @param bool   $debug
     * @return mixed
     */
    public function fetchColumn($sql, $debug = false)
    {
        $result = $this->fetchRow($sql, $debug);
        if (is_array($result)) {
            $result = current($result);
        }
        return $result;
    }
    /**
     * @param string $sql
     * @param bool   $debug
     * @return mixed
     */
    public function fetchRow($sql, $debug = false)
    {
        $result = current($this->queryAndFetch($sql, $debug));
        return $result ? $result : array();
    }
    /**
     * Escape value
     *
     * @param $value
     * @return null|string
     */
    public static function escapeValue($value)
    {
        $r = null;
        if (is_string($value)) {
            $r = self::VALUE_ESC_CHAR . static::escapeString($value) . self::VALUE_ESC_CHAR;
        } elseif (is_null($value)) {
            $r = static::NULL;
        } elseif (is_bool($value)) {
            $r = $value ? 1 : 0;
        } else {
            $r = $value;
        }
        return $r;
    }
    /**
     * Start transaction
     */
    public function startTransaction()
    {
        $this->exec("BEGIN");
    }
    /**
     * Stop transaction
     */
    public function stopTransaction()
    {
        $this->exec("END");
    }
    /**
     * Get table name
     *
     * @param $name
     * @return array
     */
    public function getTableInfo($name)
    {
        return $this->queryAndFetch("PRAGMA TABLE_INFO(" . $this->quote($name) . ")");
    }
    /**
     * Quote name
     *
     * @param $name
     * @return string
     */
    public function quote($name)
    {
        return static::NAME_ESC_CHAR . str_replace('\\', '\'', $name) . static::NAME_ESC_CHAR;
    }
    /**
     * @param $name
     * @return array
     */
    public function emptyTable($name)
    {
        return $this->queryAndFetch("DELETE FROM " . $this->quote($name));
    }
    /**
     * @param $name
     * @return array
     */
    public function dropTable($name)
    {
        return $this->queryAndFetch("DROP TABLE  " . $this->quote($name));
    }
    /**
     * Add column by table name and column name
     *
     * Types:
     *
     * * NULL. The value is a NULL value.
     * * INTEGER. The value is a signed integer, stored in 1, 2, 3, 4, 6, or 8 bytes depending on the magnitude of the
     * value.
     * * REAL. The value is a floating point value, stored as an 8-byte IEEE floating point number.
     * * TEXT. The value is a text string, stored using the database encoding (UTF-8, UTF-16BE or UTF-16LE).
     * * BLOB. The value is a blob of data, stored exactly as it was input.
     *
     * @see https://www.sqlite.org/datatype3.html
     *
     * @param string $tableName  Table name
     * @param string $columnName Column name
     * @param string $type Type as string (https://www.sqlite.org/datatype3.html)
     *
     * @return array
     */
    public function addColumn($tableName, $columnName, $type = 'BLOB')
    {
        return $this->query(
            "ALTER TABLE " .
            $this->quote($tableName) .
            " ADD  " .
            $this->quote($columnName) .
            ' ' . $type);
    }
    /**
     * Create table
     *
     * @param string $name Table name
     * @return array
     */
    public function createTable($name)
    {
        return $this->query(
            "CREATE TABLE IF NOT EXISTS "
            . $this->quote($name)
            . " (id INTEGER NOT NULL PRIMARY KEY)");
    }
    /**
     * Check if database has table
     *
     * @param string $name Table name
     * @return bool
     */
    public function hasTable($name)
    {
        return count($this->getTableInfo($name)) > 0;
    }
    /**
     * Get last insert ID
     *
     * @param string      $tableName Table name
     * @param null|string $idColumn  ID column name
     * @return int ID
     */
    public function getLastInsertId($tableName, $idColumn = null)
    {
        $id = $this->lastInsertRowID();
        if ($id < 1) {
            $id = $this->fetchColumn("SELECT
            MAX(" . $this->getIdColumn($idColumn) . ")
            FROM " . $this->quote($tableName));
        }
        return $id;
    }
    /**
     * List table names
     *
     * @return array
     */
    public function listTableNames()
    {
        $sql = /** @lang SQLite */
            'SELECT name FROM sqlite_master WHERE type=\'table\'';
        return array_map(function ($row) {
            return $row["name"];
        }, $this->queryAndFetch($sql));
    }
    /**
     * Get ID column name or ROWID const
     *
     * @param $idColumn
     * @return string
     */
    protected function getIdColumn($idColumn = null)
    {
        return $idColumn ? $this->quote($idColumn) : 'ROWID';
    }
    /**
     * @return string Database file path
     */
    public function getFilePath()
    {
        return $this->filePath;
    }
    /**
     * @return bool Remove database file
     */
    public function destroy()
    {
        $this->close();
        return unlink($this->getFilePath());
    }
    /**
     * @param        $tableName
     * @param        $data
     * @param        $idValue
     * @param string $idColumn
     * @return int
     */
    public function update($tableName, $data, $idValue, $idColumn = 'id')
    {
        $values = array();
        $keys   = array();
        foreach ($data as $key => $value) {
            $values[] = $this->quote($key) . "=" . static::escapeValue($value);
        }
        return $this->query('UPDATE '
            . $this->quote($tableName)
            . ' SET '
            . implode(', ', $values)
            . ' WHERE ' . $this->quote($idColumn) . "=" . static::escapeValue($idValue));
    }
    /**
     * Insert data and get last insert id.
     * This method is secure course of transaction.
     *
     * @param        $tableName
     * @param array  $data Array with mixed values this escapes with `escapeValue` method.
     *
     * @param string $idColumn
     * @return int Last insert id
     * @internal param string $_tableName Table name
     */
    public function insert($tableName, array $data, $idColumn = null)
    {
        $values = array();
        $keys   = array();
        foreach ($data as $key => $value) {
            if ($value === null) {
                continue;
            }
            $values[] = static::escapeValue($value);
            $keys[]   = $this->quote($key);
        }
        $this->startTransaction();
        $this->exec('INSERT INTO '
            . $this->quote($tableName)
            . ' ('
            . implode(', ', $keys)
            . ') VALUES ('
            . implode(', ', $values)
            . ')');
        $id = $this->getLastInsertId($tableName);
        $this->stopTransaction();
        return $id;
    }
}