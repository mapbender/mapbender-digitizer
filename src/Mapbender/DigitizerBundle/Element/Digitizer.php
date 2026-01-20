<?php

namespace Mapbender\DigitizerBundle\Element;

use Mapbender\Component\Element\TemplateView;
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
        return "mb.digitizer.class.title";
    }

    public static function getClassDescription()
    {
        return "mb.digitizer.class.description";
    }

    public function getWidgetName(Element $element)
    {
        return 'MbDigitizer';
    }

    public function getView(Element $element)
    {
        $view = new TemplateView('@MapbenderDigitizer/Element/Digitizer.html.twig');
        $view->attributes += parent::getView($element)->attributes;
        $parentCssClass = !empty($view->attributes['class']) ? $view->attributes['class'] : '';
        $view->attributes['class'] = trim('mb-element-digitizer ' . $parentCssClass);
        return $view;
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
                "@MapbenderDigitizerBundle/Resources/public/MbDigitizer.js",
                "@MapbenderDigitizerBundle/Resources/public/Toolset.js",
                "@MapbenderDigitizerBundle/Resources/public/FeatureRenderer.js",
                '@MapbenderDigitizerBundle/Resources/public/FeatureEditor.js',
                '@MapbenderDigitizerBundle/Resources/public/DrawDonut.js',
                "@MapbenderDigitizerBundle/Resources/public/TableRenderer.js",
                "@MapbenderDigitizerBundle/Resources/public/ContextMenu.js",
                "@MapbenderDigitizerBundle/Resources/public/FeatureStyleEditor.js",
                "@MapbenderDigitizerBundle/Resources/public/StyleAdapter.js",
                '/components/bootstrap-colorpicker/js/bootstrap-colorpicker.min.js',
                '../vendor/select2/select2/dist/js/select2.js',
                '../vendor/select2/select2/dist/js/i18n/de.js',
                '@MapbenderDigitizerBundle/Resources/public/polyfill/setprototype.polyfill.js',
            )),
            'css' => array_merge($dataManagerAssets["css"], array(
                '../vendor/select2/select2/dist/css/select2.css',
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
        $defaultStyles = $this->schemaFilter->getDefaultStyles();
        $configuration['fallbackStyle'] = $defaultStyles['default'];
        return $configuration;
    }

    public static function getDefaultConfiguration()
    {
        $config = parent::getDefaultConfiguration();
        $config['element_icon'] = self::getDefaultIcon();
        return $config;
    }

    public static function getDefaultIcon()
    {
        return 'iconEdit';
    }
}
