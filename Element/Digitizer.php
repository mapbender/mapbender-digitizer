<?php

namespace Mapbender\DigitizerBundle\Element;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\DataStoreService;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Element\BaseElement;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DigitizerBundle\Component\Uploader;
use Mapbender\DigitizerBundle\Entity\Condition;
use RuntimeException;
use Symfony\Component\Config\Definition\Exception\Exception;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\DependencyInjection\Exception\InvalidArgumentException;
use Symfony\Component\DependencyInjection\Exception\ServiceCircularReferenceException;
use Symfony\Component\DependencyInjection\Exception\ServiceNotFoundException;
use Mapbender\DataManagerBundle\Element\DataManagerElement;


/**
 * Digitizer Mapbender3 element
 */
class Digitizer extends DataManagerElement
{

    /**
     * @inheritdoc
     */
    public static function getClassTitle()
    {
        return "Digitizer";
    }

    /**
     * @inheritdoc
     */
    public static function getClassDescription()
    {
        return "Georeferencing and Digitizing";
    }

    /**
     * @inheritdoc
     */
    public function getWidgetName()
    {
        return 'mapbender.mbDigitizer';
    }

    /**
     * @inheritdoc
     */
    public static function getType()
    {
        return 'Mapbender\DigitizerBundle\Element\Type\DigitizerAdminType';
    }

    /**
     * @inheritdoc
     */
    public static function getFormTemplate()
    {
        return 'MapbenderDigitizerBundle:ElementAdmin:digitizer.html.twig';
    }

    public function getFrontendTemplatePath($suffix = '.html.twig')
    {
        return "MapbenderDigitizerBundle:Element:digitizer{$suffix}";
    }

    public function getFrontendTemplatePath($suffix = '.html.twig')
    {
        return 'MapbenderDigitizerBundle:Element:digitizer.html.twig';
    }


    /**
     * @inheritdoc
     */
    public function getAssets()
    {

        $dataManagerAssets = parent::getAssets();

        $mainFiles = array('mapbender.element.digitizer', 'digitizer', 'toolset', 'schema',
            'menu', 'contextMenu', 'utilities',
            'featureEditDialog', 'controlFactory', 'featureStyleEditor',
        );


        $js = array();

        foreach ($mainFiles as $file) {
            $js[] = "@MapbenderDigitizerBundle/Resources/public/$file.js";
        }

        $js = array_merge($js, array(
            '@MapbenderCoreBundle/Resources/public/mapbender.container.info.js',
            '../../vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js',
            '../../vendor/blueimp/jquery-file-upload/js/jquery.iframe-transport.js',
            '../../vendor/mapbender/ol4-extensions/drawdonut.js',
            '../../vendor/mapbender/ol4-extensions/styleConverter.js',
            '../../vendor/mapbender/ol4-extensions/geoJSONWithSeperateData.js',
            '../../vendor/mapbender/ol4-extensions/setStyleWithLabel.js',
            '../../vendor/mapbender/ol4-extensions/selectableModify.js',
            '/components/bootstrap-colorpicker/js/bootstrap-colorpicker.min.js',
            '/components/jquery-context-menu/jquery-context-menu-built.js',
            '/components/select2/select2-built.js',
            '/components/select2/dist/js/i18n/de.js',
            '@MapbenderDigitizerBundle/Resources/public/polyfill/setprototype.polyfill.js',
            '@MapbenderDigitizerBundle/Resources/public/plugins/printPlugin.js',
            '@MapbenderDigitizerBundle/Resources/public/lib/jsts.min.js',
            '@MapbenderDigitizerBundle/Resources/public/lib/ol-contextmenu.js',
            '@MapbenderDigitizerBundle/Resources/public/lib/layerManager.js',

        ));


        return array(
            'js' => array_merge($dataManagerAssets["js"],$js),
            'css' => array_merge($dataManagerAssets["css"], array(
                '/components/select2/select2-built.css',
                '/components/bootstrap-colorpicker/css/bootstrap-colorpicker.min.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
                '@MapbenderDigitizerBundle/Resources/public/lib/ol-contextmenu.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/modal.scss',


            )),
            'trans' => array(
                'MapbenderDigitizerBundle:Element:digitizer.json.twig',
            ),
        );
    }





}
