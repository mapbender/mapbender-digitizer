<?php
namespace Mapbender\DigitizerBundle\Entity;

/**
 * Class ToolSetConfiguration
 *
 * @package Mapbender\DigitizerBundle\Entity
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class ToolSetConfiguration
{

    const DRAW_RECTANGLE = "drawRectangle";
    const DRAW_ELLIPSE = "drawEllipse";
    const DRAW_DONUT = "drawRectangle";
    const DRAW_CIRCLE = "drawCircle";
    const MODIFY_FEATURE = "modifyFeature";
    /**
     * @var string
     */
    public $type;


}