<?php

namespace Mapbender\DigitizerBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Class SchemaConfiguration
 *
 * @package Mapbender\DigitizerBundle\Entity
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class SchemaConfiguration
{
    /**
     * @var string Title showed in selector.
     */
    public $label = null;

    /**
     * @var int Maximal feature count .Default: 1000
     */
    public $maxResults = 1500;

    /**
     * @var bool Nach dem die Feature auf der Karte digitalisiert ist, Datenformular eröfnen.
     */
    public $openFormAfterEdit = true;

    /**
     * @var bool Das Löschen von einzelnen Features erlauben. Default: true
     */
    public $allowDelete = true;

    /**
     * @var bool Features Digitalisieren auf der Karte (Verändern und Erstellen). Default: true
     */
    public $allowDigitize = true;

    /**
     * @var bool Formular Daten Änderungen
     */
    public $allowEditData    = true;

    /**
     * @var bool Den Layer dauerhaft anzeigen.
     * Oder nur wenn explicit über Select gewählt und nur wenn active ist
     * Default: false
     */
    public $displayPermanent = false;

    /**
     * @var bool
     */
    public $displayOnInactive = false;


    /**
     * @var ToolSetConfiguration
     */
    public $toolset = array();
}