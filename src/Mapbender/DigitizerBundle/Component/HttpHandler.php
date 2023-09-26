<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Entity\Feature;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Bundle\FrameworkBundle\Templating\EngineInterface;

/**
 * @property SchemaFilter $schemaFilter
 */
class HttpHandler extends \Mapbender\DataManagerBundle\Component\HttpHandler
{
    /** @var EngineInterface */
    protected $templateEngine;

    public function __construct(EngineInterface $templateEngine,
                                FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter)
    {
        parent::__construct($formFactory, $schemaFilter);
        $this->templateEngine = $templateEngine;
    }

    public function dispatchRequest(Element $element, Request $request)
    {
        $action = $request->attributes->get('action');
        switch ($action) {
            case 'style-editor':
                return $this->getStyleEditorResponse();
            case 'update-multiple':
                return new JsonResponse($this->getUpdateMultipleActionResponseData($element, $request));
            default:
                return parent::dispatchRequest($element, $request);
        }
    }

    protected function getStyleEditorResponse()
    {
        return $this->templateEngine->renderResponse('MapbenderDigitizerBundle:Element:style-editor.html.twig');
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     * @todo 1.5: make protected
     */
    public function getSelectActionResponseData(Element $element, Request $request)
    {
        $schemaName = $request->query->get('schema');
        $schemaConfig = $this->schemaFilter->getRawSchemaConfig($element, $schemaName, true);
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
        $criteria = $this->getSelectCriteria($repository, $request);
        if (!empty($schemaConfig['maxResults'])) {
            $criteria['maxResults'] = $schemaConfig['maxResults'];
        }
        $results = array();
        foreach ($repository->search($criteria) as $feature) {
            $results[] = $this->formatResponseFeature($repository, $feature);
        }
        return $results;
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     * @todo 1.5: make protected
     */
    public function getUpdateMultipleActionResponseData(Element $element, Request $request)
    {
        $dataOut = array(
            'saved' => array(),
        );
        $schemaName = $request->query->get('schema');
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
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

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     * @todo 1.5: make protected
     */
    public function getSaveActionResponseData(Element $element, Request $request)
    {
        $itemId = $request->query->get('id', null);
        $schemaName = $request->query->get('schema');
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
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
     * @param FeatureType $repository
     * @param Request $request
     * @return mixed[]
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
}
