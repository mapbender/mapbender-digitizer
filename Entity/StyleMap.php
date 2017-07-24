<?php

namespace Mapbender\DigitizerBundle\Entity;

use Mapbender\DataSourceBundle\Entity\BaseConfiguration;

/**
 * Class StyleMap
 *
 * @package Mapbender\DataSourceBundle\Entity
 * @author  Mohamed Tahrioui <mohamed.tahrioui@wheregroup.com>
 */
class StyleMap extends BaseConfiguration
{
    /* @var int ID */
    protected $id;

    /** @var string Name * */
    protected $name;

    /* @var Style[] Style list */
    protected $styles = array();

    /** @var string userId * */
    protected $userId;

    /**
     * @return mixed
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * @param $id
     * @return $this
     */
    public function setId($id)
    {
        $this->id = $id;
        return $this;
    }

    /**
     * @return string
     */
    public function getUserId()
    {
        return $this->userId;
    }

    /**
     * @param string $userId
     */
    public function setUserId($userId)
    {
        $this->userId = $userId;
    }

    /**
     * @return Style[]
     */
    public function getStyles()
    {
        return $this->styles;
    }

    /**
     * @param string $id
     * @return string|boolean
     */
    public function removeStyleById($id)
    {
        $hasStyle = isset($this->styles[ $id ]);
        if ($hasStyle) {
            unset($this->styles[ $id ]);
        }
        return $hasStyle;
    }

    /**
     * @param $id
     * @return string
     */
    public function addStyle($id)
    {
        $this->styles[ $id ] = $id;
        return $this;
    }

    /**
     * @param Style[] $styles
     * @return StyleMap
     */
    public function setStyles($styles)
    {
        $this->styles = $styles;
        return $this;
    }
}