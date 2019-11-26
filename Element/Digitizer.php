<?php

namespace Mapbender\DigitizerBundle\Element;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DBALException;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\DataStoreService;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Component\FeatureTypeService;
use Mapbender\DataSourceBundle\Element\BaseElement;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DigitizerBundle\Component\Uploader;
use Mapbender\DigitizerBundle\Entity\Condition;
use Mapbender\DigitizerBundle\Entity\Style;
use Symfony\Component\Config\Definition\Exception\Exception;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Digitizer Mapbender3 element
 */
class Digitizer extends BaseElement
{

    /** @var int Default maximal search results number */
    protected $maxResults = 2500;
    /** @var mixed[]|null lazy-initialized */
    protected $featureTypeConfigs;
    /** @var mixed[] lazy-initialized entries */
    protected $schemaConfigs = array();
    /** @var bool */
    protected $schemaConfigsComplete = false;

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
    public function getAssets()
    {
        return array(
            'js'    => array(
                '@MapbenderCoreBundle/Resources/public/mapbender.container.info.js',
                '../../vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js',
                '../../vendor/blueimp/jquery-file-upload/js/jquery.iframe-transport.js',
                '/components/bootstrap-colorpicker/js/bootstrap-colorpicker.min.js',
                '/components/jquery-context-menu/jquery-context-menu-built.js',
                '/components/select2/select2-built.js',
                '/components/select2/dist/js/i18n/de.js',
                '@MapbenderDigitizerBundle/Resources/public/digitizingToolset.js',
                '@MapbenderDigitizerBundle/Resources/public/digitizerSchema.js',
                '@MapbenderDigitizerBundle/Resources/public/digitizingControlFactory.js',
                '@MapbenderDigitizerBundle/Resources/public/feature-style-editor.js',
                '@MapbenderDigitizerBundle/Resources/public/mapbender.element.digitizer.js',
                '@MapbenderDigitizerBundle/Resources/public/plugins/printPlugin.js',
                '@MapbenderDigitizerBundle/Resources/public/plugins/coordinatesTransformation.js',
                '@MapbenderDigitizerBundle/Resources/public/plugins/geometrylessFeatureAdd.js'
            ),
            'css'   => array(
                '/components/select2/select2-built.css',
                '/components/bootstrap-colorpicker/css/bootstrap-colorpicker.min.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/context-menu.scss',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
            ),
            'trans' => array(
                'MapbenderDigitizerBundle:Element:digitizer.json.twig',
            ),
        );
    }

    /**
     * @inheritdoc
     */
    public static function getDefaultConfiguration()
    {
        return array(
            "target" => null,
            'schemes' => null,
        );
    }

    /**
     * @return mixed[]
     */
    protected function getFeatureTypeDeclarations()
    {
        return $this->container->getParameter('featureTypes');
    }

    /**
     * @param string $name
     * @return mixed[]
     */
    protected function getFeatureTypeConfig($name)
    {
        if (null === $this->featureTypeConfigs) {
            $this->featureTypeConfigs = $this->getFeatureTypeDeclarations() ?: array();
        }
        return $this->featureTypeConfigs[$name];
    }

    /**
     * Prepare form items for each scheme definition
     * Optional: get featureType by name from global context.
     *
     * @inheritdoc
     * @throws \RuntimeException
     * @throws \Symfony\Component\DependencyInjection\Exception\InvalidArgumentException
     */
    public function getConfiguration($public = true)
    {
        $configuration = $this->entity->getConfiguration() + array(
            'debug' => false,
            'fileUri' => $this->getFileUri(),
        );
        $configuration['schemes'] = array();
        foreach ($this->getSchemaConfigs() as $schemaName => $schemaConfig) {
            if ($public && !empty($schemaConfig['featureType'])) {
                $schemaConfig['featureType'] = $this->cleanFromInternConfiguration($schemaConfig['featureType']);
            }
            $configuration['schemes'][$schemaName] = $schemaConfig;
        }
        return $configuration;
    }

    public function getConfigurationAction(){
        return $this->getConfiguration(true);
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
        return 'MapbenderDigitizerBundle:ElementAdmin:digitizeradmin.html.twig';
    }

    public function getFrontendTemplatePath($suffix = '.html.twig')
    {
        return 'MapbenderDigitizerBundle:Element:digitizer.html.twig';
    }

    /**
     * Prepare request feautre data by the form definition
     *
     * @param $feature
     * @param $formItems
     * @return array
     */
    protected function prepareQueriedFeatureData($feature, $formItems)
    {
        foreach ($formItems as $key => $formItem) {
            if (isset($formItem['children'])) {
                $feature = array_merge($feature, $this->prepareQueriedFeatureData($feature, $formItem['children']));
            } elseif (isset($formItem['type']) && isset($formItem['name'])) {
                switch ($formItem['type']) {
                    case 'select':
                        if (isset($formItem['multiple'])) {
                            $separator                  = isset($formItem['separator']) ? $formItem['separator'] : ',';
                            if(is_array($feature["properties"][$formItem['name']])){
                                $feature["properties"][$formItem['name']] = implode($separator, $feature["properties"][$formItem['name']]);
                            }
                        }
                        break;
                }
            }
        }
        return $feature;
    }

    /**
     * Request handling adapter for old Mapbender < 3.0.8-beta1
     * @param string $action ignored
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function httpAction($action)
    {
        /** @var $requestService Request */
        $request = $this->container->get('request_stack')->getCurrentRequest();
        return $this->handleHttpRequest($request);
    }

    /**
     * @param Request $request
     * @return \Symfony\Component\HttpFoundation\Response
     * @throws \Exception
     */
    public function handleHttpRequest(Request $request)
    {
        $action = $request->attributes->get('action');
        switch ($action) {
            case 'getConfiguration':
            case 'configuration/get':
                // @todo: all '*Action' methods should return responses
                return new JsonResponse($this->getConfigurationAction());
            case 'select':
                return new JsonResponse($this->selectAction($this->getRequestData()));
            case 'save':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->saveAction($this->getRequestData()));
            case 'delete':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->deleteAction($this->getRequestData()));
            case 'selectForm':
            case 'form/select':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->selectFormAction($this->getRequestData()));
            case 'uploadFile':
            case 'file/upload':
            case 'file-upload': // super legacy mode
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->uploadFileAction($this->getRequestData()));
            case 'datastore/save':
            case 'saveDatastore':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->saveDatastoreAction($this->getRequestData()));
            case 'datastore/get':
            case 'getDatastore':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->getDatastoreAction($this->getRequestData()));
            case 'removeDatastore':
            case 'datastore/remove':
            // @todo: all '*Action' methods should return responses
            // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->removeDatastoreAction($this->getRequestData()));
            case 'listStyle':
            case 'style/list':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->listStyleAction($this->getRequestData()));
            case 'saveStyle':
            case 'style/save':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->saveStyleAction($this->getRequestData()));
            case 'getFeatureInfo':
            case 'featureInfo/get':
            case 'info/getFeature':     // srsly (emulating BaseElement magic)
            case 'info/feature/get':    // ...
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->getFeatureInfoAction($this->getRequestData()));
            default:
                throw new NotFoundHttpException("No such action " . print_r($action, true));
        }
    }

    /**
     * Get schema by name
     *
     * @param string $name Feature type name
     * @return FeatureType
     * @throws \Symfony\Component\Config\Definition\Exception\Exception
     */
    protected function getFeatureTypeBySchemaName($name)
    {
        $schema = $this->getSchemaByName($name);

        if (is_array($schema['featureType'])) {
            $featureType = new FeatureType($this->container, $schema['featureType']);
        } else {
            throw new Exception('Feature type schema settings not correct', 2);
        }

        return $featureType;
    }

    /**
     * Eval code string
     *
     * Example:
     *  self::evalString('Hello, $name', array('name' => 'John'))
     *  returns 'Hello, John'
     *
     * @param string $code Code string.
     * @param array  $args Variables this should be able by evaluating.
     * @return string Returns evaluated result.
     * @throws \Exception
     */
    protected static function evalString($code, $args)
    {
        foreach ($args as $key => &$value) {
            ${$key} = &$value;
        }

        $_return = null;
        if (eval("\$_return = \"" . str_replace('"', '\"', $code) . "\";") === false && ($errorDetails = error_get_last())) {
            $lastError = end($errorDetails);
            throw new \Exception($lastError["message"], $lastError["type"]);
        }
        return $_return;
    }

    /**
     * Get form item by name
     *
     * @param $items
     * @param $name
     */
    public function getFormItemByName($items, $name)
    {
        foreach ($items as $item) {
            if (isset($item['name']) && $item['name'] == $name) {
                return $item;
            }
            if (isset($item['children']) && is_array($item['children'])) {
                return $this->getFormItemByName($item['children'], $name);
            }
        }
    }

    /**
     * Search form fields AJAX API
     *
     * @param $request
     * @return array
     */
    public function selectFormAction($request)
    {
        /** @var Connection $connection */
        $itemDefinition = $request["item"];
        $schemaName     = $request["schema"];
        $formData       = $request["form"];
        $params         = $request["params"];
        $config         = $this->getConfiguration();
        $schemaConfig   = $config['schemes'][ $schemaName ];
        $searchConfig   = $schemaConfig["search"];
        $searchForm     = $searchConfig["form"];
        $item           = $this->getFormItemByName($searchForm, $itemDefinition["name"]);
        $query          = isset($params["term"]) ? $params["term"] : '';
        $ajaxSettings   = $item['ajax'];
        $connection     = $this->container->get("doctrine.dbal." . $ajaxSettings['connection'] . "_connection");
        $formData       = array_merge($formData, array($item["name"] => $query));
        $sql            = self::evalString($ajaxSettings["sql"], $formData);
        $rows           = $connection->fetchAll($sql);
        $results        = array();

        foreach ($rows as $row) {
            $results[] = array(
                'id'   => current($row),
                'text' => end($row),
            );
        }

        return array('results' => $results);
    }


    /**
     * Select/search features and return feature collection
     *
     * @param array $request
     * @return array Feature collection
     * @throws \Symfony\Component\DependencyInjection\Exception\ServiceNotFoundException
     * @throws \Symfony\Component\DependencyInjection\Exception\ServiceCircularReferenceException
     */
    public function selectAction($request)
    {
        $schemaName  = $request["schema"];
        $featureType = $this->getFeatureTypeBySchemaName($schemaName);

        if (isset($request["where"])) {
            unset($request["where"]);
        }

        if (isset($request["search"])) {
            $connection = $featureType->getConnection();
            $schema = $this->getSchemaByName($schemaName);
            $vars = $this->escapeValues($request["search"], $connection);

            $whereConditions = array();
            foreach ($schema['search']['conditions'] as $condition) {
                $condition = new Condition($condition);
                if ($condition->isSql()) {
                    $whereConditions[] = $condition->getOperator();
                    $whereConditions[] = '(' . static::evalString($condition->getCode(), $vars) . ')';
                }

                if ($condition->isSqlArray()) {
                    $subConditions = array();
                    $arrayVars     = $vars[ $condition->getKey() ];

                    if (!is_array($arrayVars)) {
                        continue;
                    }

                    foreach ($arrayVars as $value) {
                        $subConditions[] = '(' .
                            static::evalString(
                                $condition->getCode(),
                                array_merge($vars, array('value' => $value)))
                            . ')';
                    }
                    $whereConditions[] = 'AND';
                    $whereConditions[] = '(' . implode(' ' . $condition->getOperator() . ' ', $subConditions) . ')';
                }
            }

            // Remove first operator
            array_splice($whereConditions, 0, 1);

            $request["where"] = implode(' ', $whereConditions);
        }

        $featureCollection = $featureType->search(
            array_merge(
                array(
                    'returnType' => 'FeatureCollection',
                    'maxResults' => $this->maxResults
                ),
                $request
            )
        );

        //if(count($featureCollection["features"]) ==  $this->maxResults){
        //    $featureCollection["info"] = "Limit erreicht";
        //}

        return $featureCollection;
    }

    /**
     * Remove feature
     *
     * @param $request
     * @return array
     * @throws \Symfony\Component\Config\Definition\Exception\Exception
     */
    public function deleteAction($request)
    {
        $schemaName = $request["schema"];
        $schema     = $this->getSchemaByName($schemaName);

        if ((isset($schema['allowDelete']) && !$schema['allowDelete']) || (isset($schema["allowEditData"]) && !$schema['allowEditData'])) {
            throw new Exception('It is forbidden to delete objects', 2);
        }

        $featureType = $this->getFeatureTypeBySchemaName($schemaName);

        return array(
            'result' => $featureType->remove($request['feature'])
        );
    }

    /**
     * Clone feature
     *
     * @param $request
     * @return array
     * @throws \Symfony\Component\Config\Definition\Exception\Exception
     */
    public function cloneFeature($request)
    {
        $schemaName = $request["schema"];
        $schema      = $this->getSchemaByName($schemaName);
        $featureType = $this->getFeatureTypeBySchemaName($schemaName);
        $results = array();

        if (isset($schema['allowDuplicate']) && !$schema['allowDuplicate']) {
            throw new Exception('Clone feature is forbidden', 2);
        }

        $baseId  = $request['id'];
        $feature = $featureType->getById($baseId);
        $feature->setId(null);
        $feature = $featureType->save($feature);

        return array(
            'baseId'  => $baseId,
            'feature' => $feature,
        );
    }

    /**
     * Save feature by request data
     *
     * @param array $request
     * @return array
     */
    public function saveAction($request)
    {
        $schemaName    = $request["schema"];
        $configuration = $this->getConfiguration(false);
        $schema        = $this->getSchemaByName($schemaName);
        $featureType   = $this->getFeatureTypeBySchemaName($schemaName);
        $connection    = $featureType->getDriver()->getConnection();
        $results       = array();
        $debugMode     = $configuration['debug'] || $this->container->get('kernel')->getEnvironment() == "dev";

        if (isset($schema["allowEditData"]) && !$schema["allowEditData"]) {
            throw new Exception("It is forbidden to save objects", 2);
        }

        if (isset($schema["allowSave"]) && !$schema["allowSave"]) {
            throw new Exception("It is forbidden to save objects", 2);
        }

        // save once
        if (isset($request['feature'])) {
            $request['features'] = array($request['feature']);
        }

        try {
            // save collection
            if (isset($request['features']) && is_array($request['features'])) {
                foreach ($request['features'] as $feature) {
                    /**
                     * @var $feature Feature
                     */
                    $featureData = $this->prepareQueriedFeatureData($feature, $schema['formItems']);

                    foreach ($featureType->getFileInfo() as $fileConfig) {
                        if (!isset($fileConfig['field']) || !isset($featureData["properties"][ $fileConfig['field'] ])) {
                            continue;
                        }
                        $url                                               = $featureType->getFileUrl($fileConfig['field']);
                        $requestUrl                                        = $featureData["properties"][ $fileConfig['field'] ];
                        $newUrl                                            = str_replace($url . "/", "", $requestUrl);
                        $featureData["properties"][ $fileConfig['field'] ] = $newUrl;
                    }

                    $feature = $featureType->save($featureData);
                    $results = array_merge($featureType->search(array(
                        'srid'  => $feature->getSrid(),
                        'where' => $connection->quoteIdentifier($featureType->getUniqueId()) . '=' . $connection->quote($feature->getId()))));
                }

            }
            $results = $featureType->toFeatureCollection($results);
            $results['solrImportStatus'] = $this->solrImport($request);
        } catch (DBALException $e) {
            $message = $debugMode ? $e->getMessage() : "Feature can't be saved. Maybe something is wrong configured or your database isn't available?\n" .
                "For more information have a look at the webserver log file. \n Error code: " . $e->getCode();
            $results = array('errors' => array(
                array('message' => $message, 'code' => $e->getCode())
            ));
        }

        return $results;

    }

    /**
     * Updates the index of solr (full import) and returns the status 
     * @param $request
     * @return int status
     */
    public function solrImport($request) {
        $configuration = $this->getConfiguration(false);
        $schemas       = $configuration["schemes"];
        $schemaName  = $request["schema"];
        $schema = $this->getSchemaByName($schemaName);
        if (isset($schema['dataSourceImportHandler'])  && isset($schema['dataSourceImportHandler']['url'])) {
            $data = json_decode(file_get_contents($schema['dataSourceImportHandler']['url']));
            return $data->responseHeader->status;
        }
        return null;
    }

    /**
     * Upload file
     *
     * @param $request
     * @return array
     */
    public function uploadFileAction($request)
    {
        $schemaName                 = $request["schema"];
        $schema                     = $this->getSchemaByName($schemaName);

        if (isset($schema['allowEditData']) && !$schema['allowEditData']) {
            throw new Exception("It is forbidden to save objects", 2);
        }

        $featureType                = $this->getFeatureTypeBySchemaName($schemaName);
        $fieldName                  = $request['field'];
        $urlParameters              = array('schema' => $schemaName,
                                            'fid'    => $request["fid"],
                                            'field'  => $fieldName);
        $serverUrl                  = preg_replace('/\\?.+$/', "", $_SERVER["REQUEST_URI"]) . "?" . http_build_query($urlParameters);
        $uploadDir                  = $featureType->getFilePath($fieldName);
        $uploadUrl                  = $featureType->getFileUrl($fieldName) . "/";
        $urlParameters['uploadUrl'] = $uploadUrl;
        $uploadHandler              = new Uploader(array(
            'upload_dir'                   => $uploadDir . "/",
            'script_url'                   => $serverUrl,
            'upload_url'                   => $uploadUrl,
            'accept_file_types'            => '/\.(gif|jpe?g|png|pdf|zip)$/i',
            'print_response'               => false,
            'access_control_allow_methods' => array(
                'OPTIONS',
                'HEAD',
                'GET',
                'POST',
                'PUT',
                'PATCH',
                //                        'DELETE'
            ),
        ));

        return array_merge(
            $uploadHandler->get_response(),
            $urlParameters
        );
    }

    /**
     * Save data store item
     *
     * @param $request
     * @return array
     */
    public function saveDatastoreAction ($request)
    {
        $schema          = $request['schema'];
        $dataStoreLinkFieldName          = $request['dataStoreLinkFieldName'];
        $linkId  = $request['linkId'];
        $dataItem    = $request['dataItem'];

        $dataStore = $this->getDataStoreById($schema);
        $uniqueIdKey = $dataStore->getDriver()->getUniqueId();


        //var_dump($dataItem);die;
        $f = $dataStore->save($dataItem);
        $a = $this->getDatastoreAction(array('dataStoreLinkName'=>$schema , 'fid' =>$linkId, 'fieldName'=>$dataStoreLinkFieldName ));
        return array('processedItem' => $f, 'dataItems'  => $a);
    }

    /**
     * @param $request
     * @return mixed|null
     */
    public function getDatastoreAction($request)
    {
        if (!isset($request['dataStoreLinkName']) || !isset($request['fid']) || !isset($request['fieldName']) ) {
            $results = array(
                array('errors' => array(
                    array('message' => "datastore/get: id or dataItemId not defined!")
                ))
            );
            return $results;
        }
        $dataStoreLinkName           = $request['dataStoreLinkName'];
        $dataItemId   = $request['fid'];
        /** @var DataStore $dataStore */
        $dataStore    = $this->getDataStore($dataStoreLinkName);
        $fieldName = $request['fieldName'];
        $criteria['where'] = $fieldName . ' = '  . $dataItemId;

        $dataItem     = $dataStore->search($criteria);




        return $dataItem;
    }

    /**
     * Remove data store item
     *
     * @param $request
     * @return bool|mixed|null
     */
    public function removeDatastoreAction($request)
    {
        $schema          = $request['schema'];
        $dataStoreLinkFieldName          = $request['dataStoreLinkFieldName'];
        $dataItemId  = $request['dataItemId'];
        $linkId   = $request['linkId'];

        $dataStore = $this->getDataStoreById($schema);

        $f = $dataStore->remove($dataItemId);
        $a = $this->getDatastoreAction(array('dataStoreLinkName'=>$schema , 'fid' =>$linkId, 'fieldName'=>$dataStoreLinkFieldName ));
        return array('processedItem'=>$f,'dataItems' =>$a) ;
    }

    public function getFeatureInfoAction($request){
        $bbox = $request['bbox'];
        $schemaName = $request['schema'];
        $srid = $request['srid'];
        $dataSets = [];
        $remoteData = $this->getSchemaByName($schemaName)["popup"]["remoteData"];
        $responseArray = ['dataSets' => []];
        $responseArray = ['errors' => []];
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
                $this->container->get('logger')->error('Digitizer WMS GetFeatureInfo: '. $e->getMessage());
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
     * Clean feature type configuration for public use
     *
     * @param array $featureType
     * @return array
     * @todo: remove reference abuse, callers should use the return value
     */
    protected function cleanFromInternConfiguration(array &$featureType)
    {
        foreach (array(
                     'filter',
                     'geomField',
                     'connection',
                     'sql',
                     'events'
                 ) as $keyName) {
            unset($featureType[ $keyName ]);
        }
        return $featureType;
    }

    /**
     * Get schema by name
     *
     * @param $name
     * @return mixed
     * @throws \Symfony\Component\Config\Definition\Exception\Exception
     */
    protected function getSchemaByName($name)
    {
        $configuration = $this->getConfiguration(false);
        $schemas       = $configuration["schemes"];

        if (!isset($schemas[ $name ])) {
            throw new Exception("Feature type schema name '$name' isn't defined", 2);
        }

        $schema = $schemas[ $name ];
        return $schema;
    }

    /**
     * @param $request
     * @return array
     */
    public function listStyleAction($request)
    {
        return array();
    }

    /**
     * @param $request
     * @return array
     */
    public function saveStyleAction($request)
    {
        $style = new Style($request['style']);
        return array(
            'style' => $style->toArray()
        );
    }

    /**
     * Get data store by settings or name
     *
     * @param $settings
     * @return DataStore
     * @internal param $ajaxSettings
     */
    public function getDataStore($settings)
    {
        if (is_array($settings)) {
            $dataStore = new DataStore($settings);
        } else {
            $dataStore = $this->getDataStoreById($settings);
        }
        return $dataStore;
    }

    /**
     * Escape request variables.
     * Deny SQL injections.
     *
     * @param array $vars
     * @param Connection $connection
     * @return array
     */
    protected function escapeValues($vars, $connection)
    {
        $results = array();
        foreach ($vars as $key => $value) {
            $quotedValue = null;
            if (is_numeric($value)) {
                $quotedValue = intval($value);
            } elseif (is_array($value)) {
                $quotedValue = $this->escapeValues($value, $connection);
            } else {
                $quotedValue = $connection->quote($value);
                if ($quotedValue[0] === '\'') {
                    $quotedValue = preg_replace("/^\'|\'$/", null, $quotedValue);
                }
            }
            $results[ $key ] = $quotedValue;
        }
        return $results;
    }

    /**
     * @return string
     */
    protected function getFileUri()
    {
        return $this->container->getParameter("mapbender.uploads_dir") . "/" . FeatureType::UPLOAD_DIR_NAME;
    }

    /**
     * @param string $id
     * @return DataStore
     */
    protected function getDataStoreById($id)
    {
        return $this->getDataStoreService()->get($id);
    }

    /**
     * Override hook for child classes
     *
     * @return DataStoreService
     */
    protected function getDataStoreService()
    {
        /** @var DataStoreService $service */
        $service = $this->container->get('data.source');
        return $service;
    }

    /**
     * Override hook for child classes
     *
     * @return FeatureTypeService
     */
    protected function getFeatureTypeService()
    {
        /** @var FeatureTypeService $service */
        $service = $this->container->get('features');
        return $service;
    }

    /**
     * Get a mapping of ALL schema configurations
     *
     * @return mixed[] with schema names as string keys
     */
    protected function getSchemaConfigs()
    {
        if (!$this->schemaConfigsComplete) {
            $entityConfig = $this->entity->getConfiguration() + array(
                'schemes' => array(),
            );
            foreach (array_keys($entityConfig['schemes'] ?: array()) as $schemaName) {
                $this->getSchemaConfig($schemaName);
            }
        }
        return $this->schemaConfigs;
    }

    /**
     * Get a single (transformed) schema configuration. Transformed means
     * * formItems prepared
     * * featureType string reference resolved to full featureType configuration + featureTypeName entry
     * NOTE: the getSchemaByName method (introduced on newer branches) only returns the RAW config
     *
     * @param string $schemaName
     * @return mixed[]
     * @throws \RuntimeException for unknown $schemaName
     */
    protected function getSchemaConfig($schemaName)
    {
        if (!array_key_exists($schemaName, $this->schemaConfigs)) {
            $entityConfig = $this->entity->getConfiguration() + array(
                'schemes' => array(),
            );
            if (empty($entityConfig['schemes'][$schemaName])) {
                throw new \RuntimeException("No such schema " . print_r($schemaName));
            }
            $schemaConfig = $entityConfig['schemes'][$schemaName];
            if (is_string($schemaConfig['featureType'])) {
                $schemaConfig['featureTypeName'] = $schemaConfig['featureType'];
                $schemaConfig['featureType'] = $this->getFeatureTypeConfig($schemaConfig['featureType']);
            }
            if (isset($schemaConfig['formItems'])) {
                $schemaConfig['formItems'] = $this->prepareItems($schemaConfig['formItems']);
            }
            if (isset($schemaConfig['search']) && isset($schemaConfig['search']['form'])) {
                $schemaConfig['search']["form"] = $this->prepareItems($schemaConfig['search']['form']);
            }

            $this->schemaConfigs[$schemaName] = $schemaConfig;
            $this->schemaConfigsComplete = !array_diff(array_keys($entityConfig['schemes']), array_keys($this->schemaConfigs));
        }
        return $this->schemaConfigs[$schemaName];
    }
}
