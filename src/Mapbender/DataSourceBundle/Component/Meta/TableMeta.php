<?php


namespace Mapbender\DataSourceBundle\Component\Meta;


use Doctrine\DBAL\Platforms\AbstractPlatform;

class TableMeta
{
    /** @var AbstractPlatform */
    protected $platform;
    /** @var Column[] */
    protected $columns = array();
    /** @var string[] */
    protected $ciColumnIndex = array();

    /**
     * @param AbstractPlatform $platform
     * @param string[] $columns
     */
    public function __construct(AbstractPlatform $platform, array $columns)
    {
        $this->platform = $platform;
        foreach ($columns as $name => $column) {
            $this->columns[$name] = $column;
            $this->ciColumnIndex[\strtolower($name)] = $name;
        }
        $this->columns = $columns;
    }

    /**
     * @return string[]
     */
    public function getColumNames()
    {
        return \array_keys($this->columns);
    }

    public function prepareUpdateData(array $data)
    {
        foreach ($data as $columnName => $value) {
            if (\is_string($value) && !$value) {
                $column = $this->getColumn($columnName);
                // "0" is a well-formed number (work around PHP "0" == false equivalence)
                // NOTE: Starting with PHP 8 is_numeric allows trailing whitespace. Avoid that behaviour.
                // see https://www.php.net/manual/en/function.is-numeric.php
                if ($column->isNumeric() && !\is_numeric(trim($value))) {
                    $data[$columnName] = $column->getSafeDefault();
                }
            } elseif (\is_bool($value) && $this->getColumn($columnName)->isNumeric()) {
                $data[$columnName] = $value ? 1 : 0;
            }
        }
        return $data;
    }

    public function prepareInsertData(array $data)
    {
        $data = $this->prepareUpdateData($data);
        $dataNames = array();
        foreach (array_keys($data) as $dataKey) {
            $dataNames[] = \strtolower($dataKey);
        }
        foreach (\array_keys($this->ciColumnIndex) as $columnName) {
            if (!\in_array($columnName, $dataNames, true)) {
                $column = $this->getColumn($columnName);
                if (!$column->hasDefault()) {
                    $data[$columnName] = $column->getSafeDefault();
                }
            }
        }
        return $data;
    }

    /**
     * @param string $name
     * @return Column
     * @throws \RuntimeException
     */
    public function getColumn($name)
    {
        $nameNormalized = \strtolower($name);
        if (\array_key_exists($nameNormalized, $this->ciColumnIndex)) {
            return $this->columns[$this->ciColumnIndex[$nameNormalized]];
        }
        throw new \RuntimeException("Unknown column {$name}");
    }

    /**
     * @param string $name
     * @return string
     */
    public function getRealColumnName($name)
    {
        return $this->ciColumnIndex[\strtolower($name)];
    }
}
