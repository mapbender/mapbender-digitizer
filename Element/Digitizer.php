<?php

namespace Mapbender\DigitizerBundle\Element;

use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Component\FeatureTypeService;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DataManagerBundle\Element\DataManagerElement;
use Symfony\Component\HttpFoundation\Request;


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
                "@MapbenderDigitizerBundle/Resources/public/toolset.js",
                "@MapbenderDigitizerBundle/Resources/public/FeatureRenderer.js",
                "@MapbenderDigitizerBundle/Resources/public/TableRenderer.js",
                "@MapbenderDigitizerBundle/Resources/public/contextMenu.js",
                "@MapbenderDigitizerBundle/Resources/public/utilities.js",
                "@MapbenderDigitizerBundle/Resources/public/controlFactory.js",
                "@MapbenderDigitizerBundle/Resources/public/featureStyleEditor.js",
                '../../vendor/mapbender/ol4-extensions/drawdonut.js',
                '../../vendor/mapbender/ol4-extensions/styleConverter.js',
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
            )),
            'trans' => array_merge($dataManagerAssets['trans'], array(
                'mb.digitizer.*',
            )),
        );
    }

    /**
     * @param string $schemaName
     * @return FeatureType
     * @throws ConfigurationErrorException
     */
    protected function getDataStoreBySchemaName($schemaName)
    {
        return $this->getDataStoreService()->featureTypeFactory($this->getDataStoreConfigForSchema($schemaName));
    }

    /**
     * @return FeatureTypeService
     */
    protected function getDataStoreService()
    {
        // HACK: instantiate for temp decoupling from DataSourceBundle services config (not available if bundle not
        //       registered)
        // @todo: bring your own service definition
        /** @var FeatureTypeService $service */
        // $service = $this->container->get('features');
        $service = new FeatureTypeService($this->container);
        return $service;
    }

    protected function getSelectActionResponseData(Request $request)
    {
        // @todo: implement current extent search
        // @todo data-source: allow disabling maxResults completely (only makes sense for text term search)
        $maxResults = 100000000;


        $schemaName = $request->query->get('schema');
        $repository = $this->getDataStoreBySchemaName($schemaName);
        $results = array();
        $criteria = array(
            'maxResults' => $maxResults,
            'srid' => intval($request->query->get('srid')),
        );
        if ($extent = $request->query->get('extent')) {
            $extentCoordinates = explode(',', $extent);
            $polygonCoordinates = array(
                // CCW, lb => rb => rt => lt => back to lb
                "{$extentCoordinates[0]} {$extentCoordinates[1]}",
                "{$extentCoordinates[2]} {$extentCoordinates[1]}",
                "{$extentCoordinates[2]} {$extentCoordinates[3]}",
                "{$extentCoordinates[0]} {$extentCoordinates[3]}",
                "{$extentCoordinates[0]} {$extentCoordinates[1]}",
            );
            $polygonWkt = 'POLYGON((' . implode(',', $polygonCoordinates) . '))';
            $criteria['intersect'] = $polygonWkt;
        }

        foreach ($repository->search($criteria) as $feature) {
            $results[] = $this->formatResponseFeature($repository, $feature);
        }
        return $results;
    }

    protected function getSaveActionResponseData(Request $request)
    {
        $itemId = $request->query->get('id', null);
        $schemaName = $request->query->get('schema');
        $repository = $this->getDataStoreBySchemaName($schemaName);
        // NOTE: Client always sends geometry as a separate "geometry" attribute, while
        //       Feature creation expects an attribute matching the (configured) geometry
        //       column name. Adapt incoming data.
        if ($itemId) {
            $feature = $repository->getById($itemId);
        } else {
            $feature = $repository->itemFactory();
        }
        $requestData = json_decode($request->getContent(), true);
        if (!empty($requestData['geometry'])) {
            $feature->setGeom($requestData['geometry']);
        }
        if (!empty($requestData['properties'])) {
            $feature->setAttributes($requestData['properties']);
        }
        $updatedItem = $repository->save($feature);
        return array(
            'dataItem' => $this->formatResponseFeature($repository, $updatedItem),
        );
    }

    /**
     * Convert feature back into serializable and client-consumable form.
     *
     * @param FeatureType $repository
     * @param Feature $feature
     * @return array
     */
    protected function formatResponseFeature(FeatureType $repository, Feature $feature)
    {
        // @todo: expose native srid?
        $properties = $feature->toArray();
        $geometryField = $repository->getGeomField();
        unset($properties[$geometryField]);
        return array(
            'properties' => $properties,
            'geometry' => $feature->getGeom(),
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

    protected function getSchemaBaseConfig($schemaName)
    {
        $values = parent::getSchemaBaseConfig($schemaName);
        // resolve aliasing DM "allowEdit" vs historical Digitizer "allowEditData"
        $values['allowEdit'] = !!$values['allowEditData'];
        // Digitzer quirk: there is no "allowCreate" in any historical default or example configuration
        $values['allowCreate'] = $values['allowEdit'];

        // Disallow style editing if editing is disabled
        if (!$values['allowEdit']) {
            $values['allowCustomStyle'] = false;
        }

        if ($values['allowCustomStyle']) {
            $featureTypeConfigKey = $this->getDataStoreKeyInSchemaConfig();
            if (empty($values[$featureTypeConfigKey])) {
                throw new ConfigurationErrorException("Missing {$featureTypeConfigKey} for schema {$schemaName})");
            }
            $featureTypeConfig = $this->resolveDataStoreConfig($values[$featureTypeConfigKey]);
            if (empty($featureTypeConfig['styleField'])) {
                @trigger_error("WARNING: disabling 'allowCustomStyle' option for schema {$schemaName}. Missing 'styleField' setting.", E_USER_DEPRECATED);
                $values['allowCustomStyle'] = false;
            }
        }
        return $values;
    }

    protected function getSchemaConfigDefaults()
    {
        return array_replace(parent::getSchemaConfigDefaults(), array(
            'styles' => $this->getDefaultStyles(),
            // @todo: no form items is an error if the popup ever opens
            'formItems' => array(),
            'allowDigitize' => true,
            // @todo: default allow or default deny?
            'allowEditData' => true,
            // @todo: default allow or default deny?
            'allowDelete' => true,
            'allowCustomStyle' => false,
            // @todo: undocumented; should default to true; may not need configurability at all
            'allowChangeVisibility' => false,
            'displayPermanent' => false,
            'printable' => false,
            'inlineSearch' => true,
            'pageLength' => 16,
            'minScale' => null,
            'maxScale' => null,
            'searchType' => 'currentExtent',
            // @todo: specify, document
            'copy' => array(
                'enable' => false,
                'overwriteValuesWithDefault' => false,
                'data' => null, // @todo: specify, document
            ),
            // @todo: specify, document
            'refreshFeaturesAfterSave' => false,
            // @todo: specify, document; current implementation does not work on Openlayers 4/5/6
            'refreshLayersAfterFeatureSave' => false,
            // @todo: specify, document; reverting geometry modification on attribute editor cancel is a confusing
            //        workflow event. Should distinctly offer revert of geometry modification.
            'revertChangedGeometryOnCancel' => false,

            // @todo: "tableTranslation"?

            // Inherited:
            // * popup.title
            // * popup.width


            // no defaults:
            // * tableFields
            // * toolset
        ));
    }

    protected function getDefaultStyles()
    {
        return array(
            'default' => array(
                'strokeWidth' => 1,
                'strokeColor' => '#6fb536',
                'fillColor' => '#6fb536',
                'fillOpacity' => 0.3,
            ),
            'select' => array(
                'strokeWidth' => 3,
                'fillColor' => '#F7F79A',
                'strokeColor' => '#6fb536',
                'fillOpacity' => 0.5,
            ),
            'unsaved' => array(
                'strokeWidth' =>  3,
                'fillColor' => '#FFD14F',
                'strokeColor' => '#F5663C',
                'fillOpacity' => 0.5,
            ),
        );
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
                'sInfoFiltered' => $translator->trans("mb.digitizer.search.table.info.filtered"),
            );
        }
        return $this->defaultTableTranslation;
    }
}
