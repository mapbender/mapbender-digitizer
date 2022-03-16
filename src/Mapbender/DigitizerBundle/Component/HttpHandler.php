<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Mapbender\DataSourceBundle\Entity\Feature;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Bundle\FrameworkBundle\Templating\EngineInterface;

/**
 * @property SchemaFilter $schemaFilter
 * @method Feature[] searchSchema(Element $element, $schemaName, Request $request)
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
    protected function getUpdateMultipleActionResponseData(Element $element, Request $request)
    {
        $dataOut = array(
            'saved' => array(),
        );
        /** @var FeatureType[] $schemaRepositories */
        $schemaRepositories = array();
        // NOTE: Client always sends geometry as a separate "geometry" attribute, while
        //       Feature creation expects an attribute matching the (configured) geometry
        //       column name. Adapt incoming data.
        $requestData = json_decode($request->getContent(), true);
        $srid = $requestData['srid'];
        foreach ($requestData['features'] as $featureData) {
            $schemaName = $featureData['schemaName'];
            if (empty($schemaRepositories[$schemaName])) {
                $schemaRepositories[$schemaName] = $this->schemaFilter->getDataStore($element, $schemaName);
            }
            $repository = $schemaRepositories[$schemaName];
            $feature = $repository->getById($featureData['idInSchema']);
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
            $dataOut['saved'][] = $this->formatResponseItem($repository, $updatedFeature, $schemaName) + array(
                'uniqueId' => $featureData['uniqueId'],
            );
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
            'dataItem' => $this->formatResponseItem($repository, $updatedItem, $schemaName),
        );
    }

    /**
     * @param FeatureType $repository
     * @param Request $request
     * @param array $schemaConfig
     * @return mixed[]
     * @throws \Doctrine\DBAL\DBALException
     */
    protected function getSelectCriteria(DataStore $repository, Request $request, array $schemaConfig)
    {
        $geomReference = $repository->getConnection()->getDatabasePlatform()->quoteIdentifier($repository->getGeomField());
        $criteria = parent::getSelectCriteria($repository, $request, $schemaConfig) + array(
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
     * @param FeatureType $repository
     * @param Feature $item
     * @param string $schemaName
     * @return array
     */
    protected function formatResponseItem(DataStore $repository, DataItem $item, $schemaName)
    {
        $formatted = parent::formatResponseItem($repository, $item, $schemaName) + array(
            'geometry' => $item->getGeom(),
        );
        unset($formatted['properties'][$repository->getGeomField()]);
        return $formatted;
    }
}
