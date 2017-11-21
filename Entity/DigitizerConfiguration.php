<?php

namespace Mapbender\DigitizerBundle\Entity;

use Mapbender\DataSourceBundle\Entity\BaseConfiguration;

/**
 * Class DigitizerConfiguration
 *
 * @package Mapbender\DigitizerBundle\Entity
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class DigitizerConfiguration extends BaseConfiguration
{
    /**
     * @var SchemaConfiguration[] Form element hierarchy
     */
    public $schemes = array();

}