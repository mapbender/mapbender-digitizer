<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Component\Schema;
use Mapbender\DataManagerBundle\Component\UserFilterProvider;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Mapbender\DataSourceBundle\Entity\Feature;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Twig\Environment;

/**
 * @property SchemaFilter $schemaFilter
 * @method Feature[] searchSchema(Element $element, $schemaName, Request $request)
 */
class HttpHandler extends \Mapbender\DataManagerBundle\Component\HttpHandler
{
    /** @var Environment */
    protected $twig;

    public function __construct(Environment $twig,
                                FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter,
                                UserFilterProvider $userFilterProvider)
    {
        parent::__construct($formFactory, $schemaFilter, $userFilterProvider);
        $this->twig = $twig;
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
        $content = $this->twig->render('MapbenderDigitizerBundle:Element:style-editor.html.twig');
        return new Response($content);
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     */
    protected function getUpdateMultipleActionResponseData(Element $element, Request $request)
    {
        $dataOut = array(
            'saved' => array(),
        );
        // NOTE: Client always sends geometry as a separate "geometry" attribute, while
        //       Feature creation expects an attribute matching the (configured) geometry
        //       column name. Adapt incoming data.
        $requestData = json_decode($request->getContent(), true);
        $common = array(
            'srid' => $requestData['srid'],
        );
        foreach ($requestData['features'] as $featureData) {
            $schemaName = $featureData['schemaName'];
            $schema = $this->schemaFilter->getSchema($element, $schemaName);
            $feature = $schema->getRepository()->getById($featureData['idInSchema']);
            if (!$feature) {
                // uh-oh!
                continue;
            }
            $updatedFeature = $this->saveItem($schema, $feature, $common + $featureData);
            $dataOut['saved'][] = $this->formatResponseItem($schema->getRepository(), $updatedFeature, $schemaName) + array(
                'uniqueId' => $featureData['uniqueId'],
            );
        }
        return $dataOut;
    }

    /**
     * @param Schema $schema
     * @param Feature $item
     * @param array $postData
     * @return Feature
     */
    protected function saveItem(Schema $schema, DataItem $item, array $postData)
    {
        /** @var Feature $item */
        if (!empty($postData['geometry'])) {
            $item->setGeom($postData['geometry']);
            $item->setSrid($postData['srid']);
        }
        return parent::saveItem($schema, $item, $postData);
    }

    protected function getSelectCriteria(Schema $schema, Request $request)
    {
        $connection = $schema->getRepository()->getConnection();
        $geomReference = $connection->quoteIdentifier($schema->getRepository()->getGeomField());
        $criteria = parent::getSelectCriteria($schema, $request) + array(
            'srid' => intval($request->query->get('srid')),
        );
        $where = "$geomReference IS NOT NULL";
        if (!empty($criteria['where'])) {
            $where = \implode(' AND ', array($criteria['where'], $where));
        }
        $criteria['where'] = $where;
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
