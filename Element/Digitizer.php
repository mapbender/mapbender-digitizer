<?php

namespace Mapbender\DigitizerBundle\Element;

use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataSourceBundle\Component\RepositoryRegistry;
use Mapbender\DataManagerBundle\Element\DataManagerElement;
use Mapbender\DigitizerBundle\Component\HttpHandler;
use Mapbender\DigitizerBundle\Component\SchemaFilter;
use Symfony\Component\HttpFoundation\Request;


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
        return 'MapbenderDigitizerBundle:Element:digitizer.html.twig';
    }

    public static function getDefaultConfiguration()
    {
        return array(
            "target" => null
        );
    }

    /**
     * @inheritdoc
     */
    public function getAssets()
    {
        $dataManagerAssets = parent::getAssets() + array(
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
                '/components/select2/select2-built.js',
                '/components/select2/dist/js/i18n/de.js',
                '@MapbenderDigitizerBundle/Resources/public/polyfill/setprototype.polyfill.js',
                '@MapbenderDigitizerBundle/Resources/public/lib/ol-contextmenu.js',
                '@MapbenderDigitizerBundle/Resources/public/lib/layerManager.js',
            )),
            'css' => array_merge($dataManagerAssets["css"], array(
                '/components/select2/select2-built.css',
                '/components/bootstrap-colorpicker/css/bootstrap-colorpicker.min.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
                '@MapbenderDigitizerBundle/Resources/public/lib/ol-contextmenu.css',
            )),
            'trans' => array_merge($dataManagerAssets['trans'], array(
                'mb.digitizer.*',
            )),
        );
    }

    public function handleHttpRequest(Request $request)
    {
        return $this->getHttpHandler()->handleRequest($this->entity, $request);
    }

    protected function getSchemaBaseConfig($schemaName)
    {
        $values = parent::getSchemaBaseConfig($schemaName);
        $values = $this->getSchemaFilter()->processSchemaBaseConfig($values, $schemaName);
        // @todo: untangle / resolve dependency on feature type config (potentially by string reference)
        if ($values['allowCustomStyle']) {
            if (empty($values['featureType'])) {
                throw new ConfigurationErrorException("Missing featureType for schema {$schemaName})");
            }
            $featureTypeConfig = $this->resolveDataStoreConfig($values['featureType']);
            if (empty($featureTypeConfig['styleField'])) {
                @trigger_error("WARNING: disabling 'allowCustomStyle' option for schema {$schemaName}. Missing 'styleField' setting.", E_USER_DEPRECATED);
                $values['allowCustomStyle'] = false;
            }
        }
        return $values;
    }

    protected function getSchemaConfigDefaults()
    {
        return $this->getSchemaFilter()->getConfigDefaults();
    }

    public function getPublicConfiguration()
    {
        $defaultStyles = $this->getSchemaFilter()->getDefaultStyles();
        return array_replace(parent::getPublicConfiguration(), array(
            'fallbackStyle' => $defaultStyles['default'],
        ));
    }

    /**
     * @return RepositoryRegistry
     */
    protected function getDataStoreService()
    {
        /** @var RepositoryRegistry $service */
        $service = $this->container->get('mb.digitizer.registry');
        return $service;
    }

    private function getHttpHandler()
    {
        /** @var HttpHandler $handler */
        $handler = $this->container->get('mb.digitizer.http_handler');
        return $handler;
    }

    /**
     * @return SchemaFilter
     */
    private function getSchemaFilter()
    {
        /** @var SchemaFilter $schemaFilter */
        $filter = $this->container->get('mb.digitizer.schema_filter');
        return $filter;
    }
}
