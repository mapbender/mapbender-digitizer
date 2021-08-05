<?php

namespace Mapbender\DigitizerBundle\Element;

use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataManagerBundle\Exception\UnknownSchemaException;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Component\RepositoryRegistry;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DataManagerBundle\Element\DataManagerElement;
use Mapbender\DigitizerBundle\Component\HttpHandler;
use Mapbender\DigitizerBundle\Component\SchemaFilter;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;


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

    /**
     * @param Request $request
     * @return Response|null
     * @throws UnknownSchemaException
     * @throws ConfigurationErrorException
     */
    protected function dispatchRequest(Request $request)
    {
        $action = $request->attributes->get('action');
        switch ($action) {
            default:
                return parent::dispatchRequest($request);
            case 'update-multiple':
                return new JsonResponse($this->getUpdateMultipleActionResponseData($request));
            case 'style-editor':
                return $this->getHttpHandler()->dispatchRequest($this->entity, $request);
        }
    }

    /**
     * @param string $schemaName
     * @return FeatureType
     * @throws ConfigurationErrorException
     */
    protected function getDataStoreBySchemaName($schemaName)
    {
        /** @var FeatureType $repository */
        $repository = $this->getDataStoreService()->dataStoreFactory($this->getDataStoreConfigForSchema($schemaName));
        return $repository;
    }

    protected function getSelectActionResponseData(Request $request)
    {
        $schemaName = $request->query->get('schema');
        // HACK: call to parent to bypass custom style shenanigans. We only need "maxResults" from this.
        $schemaConfigMinimal = parent::getSchemaBaseConfig($schemaName);
        $repository = $this->getDataStoreBySchemaName($schemaName);
        $criteria = $this->getSelectCriteria($repository, $request);
        if (!empty($schemaConfigMinimal['maxResults'])) {
            $criteria['maxResults'] = $schemaConfigMinimal['maxResults'];
        }
        $results = array();
        foreach ($repository->search($criteria) as $feature) {
            $results[] = $this->formatResponseFeature($repository, $feature);
        }
        return $results;
    }

    /**
     * @param FeatureType $repository
     * @param Request $request
     * @return mixed[]
     * @throws \Doctrine\DBAL\DBALException
     */
    protected function getSelectCriteria(FeatureType $repository, Request $request)
    {
        $geomReference = $repository->getConnection()->getDatabasePlatform()->quoteIdentifier($repository->getGeomField());
        $criteria = array(
            'srid' => intval($request->query->get('srid')),
            'where' => "$geomReference IS NOT NULL",
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
        return $criteria;
    }

    protected function getUpdateMultipleActionResponseData(Request $request)
    {
        $dataOut = array(
            'saved' => array(),
        );
        $schemaName = $request->query->get('schema');
        $repository = $this->getDataStoreBySchemaName($schemaName);
        // NOTE: Client always sends geometry as a separate "geometry" attribute, while
        //       Feature creation expects an attribute matching the (configured) geometry
        //       column name. Adapt incoming data.
        $requestData = json_decode($request->getContent(), true);
        $srid = $requestData['srid'];
        foreach ($requestData['features'] as $id => $featureData) {
            $feature = $repository->getById($id);
            if (!$feature) {
                // uh-oh!
                continue;
            }
            if (!empty($featureData['geometry'])) {
                $feature->setGeom($featureData['geometry']);
                $feature->setSrid($srid);
            }
            if (!empty($featureData['properties'])) {
                $feature->setAttributes($featureData['properties']);
            }
            $updatedFeature = $repository->save($feature);
            $dataOut['saved'][] = $this->formatResponseFeature($repository, $updatedFeature);
        }
        return $dataOut;
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
            $feature->setSrid($requestData['srid']);
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
