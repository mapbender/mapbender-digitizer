<?php

namespace Mapbender\DigitizerBundle\Element;

use Mapbender\Component\Element\StaticView;
use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Element\DataManager;
use Mapbender\DigitizerBundle\Component\SchemaFilter;


/**
 * Digitizer Mapbender3 element
 * @property SchemaFilter $schemaFilter
 */
class Digitizer extends DataManager
{
    public static function getClassTitle()
    {
        return "Digitizer";
    }

    public static function getClassDescription()
    {
        return "Georeferencing and Digitizing";
    }

    public function getWidgetName(Element $element)
    {
        return 'mapbender.mbDigitizer';
    }

    public static function getType()
    {
        return 'Mapbender\DigitizerBundle\Element\Type\DigitizerAdminType';
    }

    public static function getFormTemplate()
    {
        return 'MapbenderDigitizerBundle:ElementAdmin:digitizer.html.twig';
    }

    public function getView(Element $element)
    {
        // no content
        $view = new StaticView('');
        $view->attributes += parent::getView($element)->attributes;
        $parentCssClass = !empty($view->attributes['class']) ? $view->attributes['class'] : '';
        $view->attributes['class'] = trim('mb-element-digitizer ' . $parentCssClass);
        return $view;
    }

    public static function getDefaultConfiguration()
    {
        return array(
            "target" => null
        );
    }

    public function getRequiredAssets(Element $element)
    {
        $dataManagerAssets = parent::getRequiredAssets($element) + array(
            // provide empty array stubs for missing upstream entries
            'js' => array(),
            'css' => array(),
            'trans' => array(),
        );

        return array(
            'js' => array_merge($dataManagerAssets["js"], array(
                "@MapbenderDigitizerBundle/Resources/public/ol6-compat.js",
                "@MapbenderDigitizerBundle/Resources/public/mapbender.element.digitizer.js",
                "@MapbenderDigitizerBundle/Resources/public/toolset.js",
                "@MapbenderDigitizerBundle/Resources/public/FeatureRenderer.js",
                "@MapbenderDigitizerBundle/Resources/public/TableRenderer.js",
                "@MapbenderDigitizerBundle/Resources/public/contextMenu.js",
                "@MapbenderDigitizerBundle/Resources/public/controlFactory.js",
                "@MapbenderDigitizerBundle/Resources/public/featureStyleEditor.js",
                "@MapbenderDigitizerBundle/Resources/public/StyleAdapter.js",
                '/components/bootstrap-colorpicker/js/bootstrap-colorpicker.min.js',
                '../../vendor/select2/select2/dist/js/select2.js',
                '../../vendor/select2/select2/dist/js/i18n/de.js',
                '@MapbenderDigitizerBundle/Resources/public/polyfill/setprototype.polyfill.js',
            )),
            'css' => array_merge($dataManagerAssets["css"], array(
                '../../vendor/select2/select2/dist/css/select2.css',
                '/components/bootstrap-colorpicker/css/bootstrap-colorpicker.min.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
            )),
            'trans' => array_merge($dataManagerAssets['trans'], array(
                'mb.digitizer.*',
            )),
        );
    }

    public function getClientConfiguration(Element $element)
    {
        $configuration = parent::getClientConfiguration($element);
        foreach ($configuration['schemes'] as $schemaName => $schemaConfig) {
            $schemaConfig = $this->schemaFilter->postProcessSchemaBaseConfig($element, $schemaConfig, $schemaName);
            $configuration['schemes'][$schemaName] = $schemaConfig;
        }
        $defaultStyles = $this->schemaFilter->getDefaultStyles();
        $configuration['fallbackStyle'] = $defaultStyles['default'];
        return $configuration;
    }
}
