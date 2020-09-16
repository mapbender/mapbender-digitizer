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
     * @var array
     * Nested string mapping structure, ultimately passed to dataTables JavaScript widget as "oLanguage" option
     */
    protected $defaultTableTranslation = array();

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
                "@MapbenderDigitizerBundle/Resources/public/digitizer.js",
                "@MapbenderDigitizerBundle/Resources/public/toolset.js",
                "@MapbenderDigitizerBundle/Resources/public/schema.js",
                "@MapbenderDigitizerBundle/Resources/public/menu.js",
                "@MapbenderDigitizerBundle/Resources/public/contextMenu.js",
                "@MapbenderDigitizerBundle/Resources/public/utilities.js",
                "@MapbenderDigitizerBundle/Resources/public/featureEditDialog.js",
                "@MapbenderDigitizerBundle/Resources/public/controlFactory.js",
                "@MapbenderDigitizerBundle/Resources/public/featureStyleEditor.js",
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
            )),
            'css' => array_merge($dataManagerAssets["css"], array(
                '/components/select2/select2-built.css',
                '/components/bootstrap-colorpicker/css/bootstrap-colorpicker.min.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
                '@MapbenderDigitizerBundle/Resources/public/lib/ol-contextmenu.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/modal.scss',


            )),
            'trans' => array_merge($dataManagerAssets['trans'], array(
                'mb.digitizer.*',
            )),
        );
    }


    /**
     * @return string
     */
    protected function getDefaultUploadsPath()
    {
        return $this->container->getParameter("mapbender.uploads_dir") . "/" . FeatureType::UPLOAD_DIR_NAME;
    }


    /**
     * Digitizer renames "dataStore" to "featureType" in schema configs.
     * @return string
     */
    protected function getDataStoreKeyInSchemaConfig()
    {
        return 'featureType';
    }

    public function getConfiguration()
    {
        $config = parent::getConfiguration();
        $tableTranslation = $this->getDefaultTableTranslation();
        if (empty($config['tableTranslation'])) {
            $config['tableTranslation'] = $tableTranslation;
        } else {
            $config['tableTranslation'] = array_replace_recursive($tableTranslation, $config['tableTranslation']);
        }
        return $config;
    }

    protected function getDefaultTableTranslation()
    {
        if (!$this->defaultTableTranslation) {
            $translator = $this->getTranslator();
            $this->defaultTableTranslation = array(
                // @see https://legacy.datatables.net/usage/i18n
                'sSearch' => $translator->trans("mb.digitizer.search.title") . ':',
                'sEmptyTable' => $translator->trans("mb.digitizer.search.table.empty"),
                'sZeroRecords' => $translator->trans("mb.digitizer.search.table.zerorecords"),
                'sInfo' => $translator->trans("mb.digitizer.search.table.info.status"),
                'sInfoEmpty' => $translator->trans("mb.digitizer.search.table.info.empty"),
                'sInfoFilter' => $translator->trans("mb.digitizer.search.table.info.filtered"),
            );
        }
        return $this->defaultTableTranslation;
    }
}
