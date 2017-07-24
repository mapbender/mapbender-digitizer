<?php

namespace Mapbender\DigitizerBundle\Entity;

use Mapbender\DataSourceBundle\Entity\BaseConfiguration;

/**
 * Class Style
 *
 * @package Mapbender\DataSourceBundle\Entity
 * @author  Mohamed Tahrioui <mohamed.tahrioui@wheregroup.com>
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class Style extends BaseConfiguration
{
    /* @var int ID */
    protected $id;

    /** @var string Name */
    protected $name;

    /** @var Boolean  Set to false if no fill is desired. */
    public $fill;

    /** @var String  Hex fill color.  Default is “#ee9900”. */
    public $fillColor;

    /** @var Number  Fill opacity (0-1).  Default is 0.4 */
    public $fillOpacity;

    /** @var Boolean  Set to false if no stroke is desired. */
    public $stroke;

    /** @var String  Hex stroke color.  Default is “#ee9900”. */
    public $strokeColor;

    /** @var Number  Stroke opacity (0-1).  Default is 1. */
    public $strokeOpacity;

    /** @var Number  Pixel stroke width.  Default is 1. */
    public $strokeWidth;

    /** @var String  Stroke cap type.  Default is “round”.  [butt | round | square] */
    public $strokeLinecap;

    /** @var String  Stroke dash style.  Default is “solid”.  [dot | dash | dashdot | longdash | longdashdot | solid] */
    public $strokeDashstyle;

    /** @var Boolean  Set to false if no graphic is desired. */
    public $graphic;

    /** @var Number  Pixel point radius.  Default is 6. */
    public $pointRadius;

    /** @var String  Default is “visiblePainted”. */
    public $pointerEvents;

    /** @var String  Default is “”. */
    public $cursor;

    /** @var String  Url to an external graphic that will be used for rendering points. */
    public $externalGraphic;

    /** @var Number  Pixel width for sizing an external graphic. */
    public $graphicWidth;

    /** @var Number  Pixel height for sizing an external graphic. */
    public $graphicHeight;

    /** @var Number  Opacity (0-1) for an external graphic. */
    public $graphicOpacity;

    /** @var Number  Pixel offset along the positive x axis for displacing an external graphic. */
    public $graphicXOffset;

    /** @var Number  Pixel offset along the positive y axis for displacing an external graphic. */
    public $graphicYOffset;

    /** @var Number  For point symbolizers, this is the rotation of a graphic in the clockwise direction about its center point (or any point off center as specified by graphicXOffset and graphicYOffset). */
    public $rotation;

    /** @var Number  The integer z-index value to use in rendering. */
    public $graphicZIndex;

    /** @var String  Named graphic to use when rendering points.  Supported values include “circle” (default), “square”, “star”, “x”, “cross”, “triangle”. */
    public $graphicName;

    /** @var String  Tooltip when hovering over a feature.  deprecated, use title instead */
    public $graphicTitle;

    /** @var String  Tooltip when hovering over a feature.  Not supported by the canvas renderer. */
    public $title;

    /** @var String  Url to a graphic to be used as the background under an externalGraphic. */
    public $backgroundGraphic;

    /** @var Number  The integer z-index value to use in rendering the background graphic. */
    public $backgroundGraphicZIndex;

    /** @var Number  The x offset (in pixels) for the background graphic. */
    public $backgroundXOffset;

    /** @var Number  The y offset (in pixels) for the background graphic. */
    public $backgroundYOffset;

    /** @var Number  The height of the background graphic.  If not provided, the graphicHeight will be used. */
    public $backgroundHeight;

    /** @var Number  The width of the background width.  If not provided, the graphicWidth will be used. */
    public $backgroundWidth;

    /** @var String  The text for an optional label.  For browsers that use the canvas renderer, this requires either fillText or mozDrawText to be available. */
    public $label;

    /** @var String  Label alignment.  This specifies the insertion point relative to the text.  It is a string composed of two characters.  The first character is for the horizontal alignment, the second for the vertical alignment.  Valid values for horizontal alignment: “l”=left, “c”=center, “r”=right.  Valid values for vertical alignment: “t”=top, “m”=middle, “b”=bottom.  Example values: “lt”, “cm”, “rb”.  Default is “cm”. */
    public $labelAlign;

    /** @var Number  Pixel offset along the positive x axis for displacing the label.  Not supported by the canvas renderer. */
    public $labelXOffset;

    /** @var Number  Pixel offset along the positive y axis for displacing the label.  Not supported by the canvas renderer. */
    public $labelYOffset;

    /** @var Boolean  If set to true, labels will be selectable using SelectFeature or similar controls.  Default is false. */
    public $labelSelect;

    /** @var String  The color of the label outline.  Default is ‘white’.  Only supported by the canvas & SVG renderers. */
    public $labelOutlineColor;

    /** @var Number  The width of the label outline.  Default is 3, set to 0 or null to disable.  Only supported by the SVG renderers. */
    public $labelOutlineWidth;

    /** @var Number  The opacity (0-1) of the label outline.  Default is fontOpacity.  Only supported by the canvas & SVG renderers. */
    public $labelOutlineOpacity;

    /** @var String  The font color for the label, to be provided like CSS. */
    public $fontColor;

    /** @var Number  Opacity (0-1) for the label */
    public $fontOpacity;

    /** @var String  The font family for the label, to be provided like in CSS. */
    public $fontFamily;

    /** @var String  The font size for the label, to be provided like in CSS. */
    public $fontSize;

    /** @var String  The font style for the label, to be provided like in CSS. */
    public $fontStyle;

    /** @var String  The font weight for the label, to be provided like in CSS. */
    public $fontWeight;

    /** @var String  Symbolizers will have no effect if display is set to “none”.  All other values have no effect. */
    public $display;

    /** @var int User ID */
    protected $userId;

    /** @var String[] Style Maps which contain this style */
    protected $styleMaps;

    /** @var */
    public $featureId;

    /** @var */
    public $schemaName;

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
     * Set user ID
     *
     * @param $userId
     */
    public function setUserId($userId)
    {
        $this->userId = $userId;
    }

    /**
     * @return int
     */
    public function getUserId()
    {
        return $this->userId;
    }

    /**
     * @param \String[] $styleMaps
     * @return Style
     */
    public function setStyleMaps($styleMaps)
    {
        $this->styleMaps = $styleMaps;
        return $this;
    }

    /**
     * @return \String[]
     */
    public function getStyleMaps()
    {
        return $this->styleMaps;
    }

    /**
     * @return bool
     */
    public function canBeDeleted()
    {
        return empty($this->styleMaps);
    }


    /**
     * @param string $id
     * @return string|boolean
     */
    public function removeStyleMapById($id)
    {
        $wasRemoved = isset($this->styleMaps[ $id ]);
        unset($this->styleMaps[ $id ]);
        return $wasRemoved;
    }


    /**
     * @param $id
     * @return $this
     */
    public function addStyleMap($id)
    {
        $this->styleMaps[ $id ] = $id;
        return $this;
    }
}