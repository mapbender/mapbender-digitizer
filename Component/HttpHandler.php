<?php


namespace Mapbender\DigitizerBundle\Component;


use Doctrine\Persistence\ConnectionRegistry;
use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Entity\Feature;
use Symfony\Component\Config\Definition\Exception\Exception;
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

    protected ConnectionRegistry $connectionRegistry;

    public function __construct(EngineInterface $templateEngine,
                                FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter, ConnectionRegistry $connectionRegistry)
    {
        parent::__construct($formFactory, $schemaFilter);
        $this->templateEngine = $templateEngine;
        $this->connectionRegistry = $connectionRegistry;
    }

    public function dispatchRequest(Element $element, Request $request)
    {
        $action = $request->attributes->get('action');
        switch ($action) {
            case 'style-editor':
                return $this->getStyleEditorResponse();
            case 'update-multiple':
                return new JsonResponse($this->getUpdateMultipleActionResponseData($element, $request));
            case 'getMaxElevation':
                return new JsonResponse($this->getMaxElevation($element,$request));
            case 'getFeatureInfo':
                return new JsonResponse($this->getFeatureInfo($element,$request));
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


    public function getFeatureInfo($element,$request){

        $query = $request->query;
        $schemaName = $request->query->get('schema');
        $config = $this->schemaFilter->getRawSchemaConfig($element, $schemaName);

        $bbox = $query->get('bbox');
        $srid = $query->get('srid');
        $dataSets = [];
        $responseArray = ['errors' => []];
        $remoteData = isset($config["popup"]) && isset($config["popup"]["remoteData"]) ? $config["popup"]["remoteData"]  : [];
        if (empty($remoteData)) {
            throw new \Exception("$schemaName does not support remote Data");
        }
        foreach ($remoteData as $url){
            $url = str_replace("{bbox}", $bbox, $url);
            $url = str_replace("{BBOX}", $bbox, $url);
            $url = str_replace("{srid}", $srid, $url);
            $url = str_replace("{SRID}", $srid, $url);
            try {
                $context = stream_context_create(array(
                    'http' => array(
                        'ignore_errors' => true
                    )
                ));
                $response  = file_get_contents($url, false, $context);
            } catch (\Exception $e) {
                $responseArray['error']  = $e->getMessage();
            }
            if(is_array($http_response_header)){
                $head = array();
                foreach( $http_response_header as $k=>$v )
                {
                    $t = explode( ':', $v, 2 );
                    if( isset( $t[1] ) )
                        $head[ trim($t[0]) ] = trim( $t[1] );
                    else
                    {
                        $head[] = $v;
                        if( preg_match( "#HTTP/[0-9\.]+\s+([0-9]+)#",$v, $out ) )
                            $head['reponse_code'] = intval($out[1]);
                    }
                }
                if($head["reponse_code"] !== 200){
                    $responseArray['error'][] = array('response' => $response, 'code' => $head['reponse_code']);
                } else if (!!(json_decode($response))) {

                    $dataSets[] = $response;
                } else {
                    $responseArray['error'][]  = array('response' => $response, 'code' => "Response of url: {$url} is not a JSON");
                }

            } else  {
                $responseArray['error'][]  = "Unknown error for url: {$url}";
            }

        }

        $responseArray['dataSets'] = $dataSets;
        return $responseArray;
    }


    /**
     * Select/search features and return feature collection
     *
     * @param Request $request
     * @return JsonResponse Feature collection
     * @throws \Symfony\Component\DependencyInjection\Exception\ServiceNotFoundException
     * @throws \Symfony\Component\DependencyInjection\Exception\ServiceCircularReferenceException
     */
    public function getMaxElevation(Element $element, Request $request)
    {
        $query =  json_decode($request->getContent(), true);
        $schemaName = $query['schema'];
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
        $val = $query["curveseg_id"];
        $srs = $query["srs"];
        $connection     = $repository->getConnection();

        $sql            = "Select ST_ASText(geom) as linestring, vertex1_point_id as p1, vertex2_point_id as p2 from data.curveseg_line where curveseg_id = ?";
        $curveseg_line   = $connection->fetchAssoc($sql,[$val]);
        $p1 = $curveseg_line["p1"];
        $p2 = $curveseg_line["p2"];
        $lineString = $curveseg_line["linestring"];

        $sql            = "Select ST_ASText(coordinate) as coord, elevation_top, elevation_base, height from data.point where point_id = ?";
        $point1   = $connection->fetchAssoc($sql,[$p1]);
        $point2   = $connection->fetchAssoc($sql,[$p2]);
        $elevation1 = $point1["elevation_top"] ?:  $point1["elevation_base"];
        $elevation2 = $point2["elevation_top"]  ?: $point2["elevation_base"];
        $elevation_connection = $this->connectionRegistry->getConnection('elevation');

        $sql = "SELECT st_x(st_transform(point, $srs)) as x, st_y(st_transform(point, $srs)) as y, z AS elevation, line_frac AS fraction
        FROM get_base_elevation_data(st_transform(st_geomfromtext(?, ?), 31287), ?)";
        //$sql = 'SELECT SELECT * FROM get_elevation_data(?, ?, ?)';
        $arr =  [$lineString, '4326', 300 ];
        $stmt = $elevation_connection->executeQuery($sql,$arr);
        $result = $stmt->fetchAll();

        $json = json_encode($result);
        $found = $this->calculateMaxElevation($result,$elevation1,$elevation2);

        return $found;

    }

    function calculateMaxElevation($result,$elevation1,$elevation2, $reverse = false) {

        if ($elevation2 > $elevation1) {
            return $this->calculateMaxElevation(array_reverse($result),$elevation2,$elevation1, true);
        }

        $height_diff = floatval($elevation1)-floatval($elevation2);
        $size = sizeof($result);
        foreach($result as $k => &$res) {
            $fraction = (1 / $size) * $k;
            $res["connecting_line_height"] =  $height_diff - ($height_diff*$fraction);
            if ($res["connecting_line_height"] < 0) {
                throw new Exception("calculation Error: ".$res["connecting_line_height"]." must be > 0");
            }
            if ($res["connecting_line_height"] > abs($height_diff)) {
                throw new Exception("calculation Error: ".$res["connecting_line_height"]." must be < $height_diff");
            }
            $res["height_max_curveseg"] = ($elevation2-$res["elevation"])+$res["connecting_line_height"];

        }

        $max = -INF;
        $found = null;
        foreach($result as $r) {
            if ($r["height_max_curveseg"] > $max) {
                $found = $r;
                $max = $r["height_max_curveseg"];
            }

        }

        return $found;
    }
}
