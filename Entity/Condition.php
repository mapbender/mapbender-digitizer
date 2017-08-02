<?php

namespace Mapbender\DigitizerBundle\Entity;

use Mapbender\DataSourceBundle\Entity\BaseConfiguration;

/**
 * Search query condition entity
 *
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class Condition extends BaseConfiguration
{

    /** @var string Type */
    protected $type = 'sql';

    /** @var string Code */
    protected $code = '';

    /** @var string Key-Name */
    public $key = 'name';

    /** @var string Operator */
    public $operator = 'AND';

    /**
     * Is SQL type
     *
     * @return bool
     */
    public function isSql()
    {
        return $this->type == "sql";
    }

    /**
     * Is SQL type
     *
     * @return bool
     */
    public function isSqlArray()
    {
        return $this->type == "sql-array";
    }

    /**
     * Is PHP type
     *
     * @return bool
     */
    public function isPhp()
    {
        return $this->type == "php";
    }

    /**
     * Get code (SQL, PHP, ...)
     *
     * @return string
     */
    public function getCode()
    {
        return $this->code;
    }

    /**
     * Return operator
     *
     * @return string
     */
    public function getOperator()
    {
        return $this->operator;
    }

    /**
     * Get array key name
     *
     * @return string
     */
    public function getKey()
    {
        return $this->key;
    }
}