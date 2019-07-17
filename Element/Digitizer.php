<?php

namespace Mapbender\DigitizerBundle\Element;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DBALException;
use Mapbender\CoreBundle\Component\Exception\InvalidElementClassException;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\DataStoreService;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Element\BaseElement;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DigitizerBundle\Component\Uploader;
use Mapbender\DigitizerBundle\Component\DigitizerStyleManager;
use Mapbender\DigitizerBundle\Component\Style;
use Mapbender\DigitizerBundle\Entity\Condition;
use Symfony\Component\Config\Definition\Exception\Exception;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;





/**
 * Digitizer Mapbender3 element
 */
class Digitizer extends BaseElement
{
    /** @var string Digitizer element title */
    protected static $title = 'Digitizer';

    /** @var string Digitizer element description */
    protected static $description = 'Georeferencing and Digitizing';

    /** @var int Default maximal search results number */
    protected $maxResults = 2500;

    protected $styleManager;

    /**
     * @inheritdoc
     */
    public function getAssets()
    {

        $mainFiles = array('mapbender.element.digitizer','toolset','schema','schemaAll','clustering.mixin',
                           'menu','contextMenu', 'utilities',
                           'featureEditDialog','controlFactory','featureStyleEditor','mapbender.layermanager',
                           'mapbender.digitizer-translator',
                           'queryEngine');


//        $formItemFiles = array("formItem","formItemBreakLine","formItemButton","formItemCheckbox","formItemContainer","formItemDate",
//            "formItemFieldSet","formItemFile","formItemForm","formItemImage","formItemInput","formItemLabel",
//            "formItemResultTable","formItemSelect","formItemTabs","formItemTextArea","formItemText");

        $js = array();

        foreach($mainFiles as $file) {
            $js[] = "@MapbenderDigitizerBundle/Resources/public/$file.js";
        }

//        foreach($formItemFiles as $file) {
//            $js[] = "@MapbenderDigitizerBundle/Resources/public/formItems/$file.js";
//        }

        $js[] = "@MapbenderDigitizerBundle/Resources/public/vis-ui/vis-ui.js-built.js";

        $js = array_merge($js,array(
            '@MapbenderCoreBundle/Resources/public/mapbender.container.info.js',
            '../../vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js',
            '../../vendor/blueimp/jquery-file-upload/js/jquery.iframe-transport.js',
            '../../vendor/mapbender/ol4-extensions/drawdonut.js',
            '/components/bootstrap-colorpicker/js/bootstrap-colorpicker.min.js',
            '/components/jquery-context-menu/jquery-context-menu-built.js',
            '/components/select2/select2-built.js',
            '/components/select2/dist/js/i18n/de.js',
            '@MapbenderDigitizerBundle/Resources/public/polyfill/setprototype.polyfill.js',
            '@MapbenderDigitizerBundle/Resources/public/polyfill/confirmDialog.js',
            '@MapbenderDigitizerBundle/Resources/public/plugins/printPlugin.js',
            '@MapbenderDigitizerBundle/Resources/public/lib/jsts.min.js',

        ));




        return array(
            'js'    => $js,
            'css'   => array(
                '/components/select2/select2-built.css',
                '/components/bootstrap-colorpicker/css/bootstrap-colorpicker.min.css',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/context-menu.scss',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
                '@MapbenderDigitizerBundle/Resources/public/sass/element/modal.scss',
                "@MapbenderDigitizerBundle/Resources/public/vis-ui/vis-ui.js-built.css"

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
            "target" => null
        );
    }

    /**
     * @return mixed[]
     */
    /**
     * @return mixed[]
     */
    protected function getFeatureTypeDeclarations()
    {
        return $this->container->getParameter('featureTypes');
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
        $configuration            = parent::getConfiguration();
        $configuration['debug']   = isset($configuration['debug']) ? $configuration['debug'] : false;
        $configuration['fileUri'] = $this->container->getParameter('mapbender.uploads_dir') . "/" . FeatureType::UPLOAD_DIR_NAME;
        $featureTypes = null;


        if (isset($configuration["schemes"]) && is_array($configuration["schemes"])) {
            foreach ($configuration['schemes'] as $key => &$scheme) {
                $this->adjustScheme($scheme, $featureTypes, $public);
            }
        }
        return $configuration;
    }

    public function adjustScheme(&$scheme, &$featureTypes,$public) {
        if (is_string($scheme['featureType'])) {
            if ($featureTypes === null) {
                $featureTypes = $this->getFeatureTypeDeclarations();
            }
            $featureTypeName           = $scheme['featureType'];
            $scheme['featureType']     = $featureTypes[ $featureTypeName ];
            $scheme['featureTypeName'] = $featureTypeName;
        }

        if ($public) {
            $this->cleanFromInternConfiguration($scheme['featureType']);
        }

        if (isset($scheme['formItems'])) {
            $scheme['formItems'] = $this->prepareItems($scheme['formItems']);
        }


    }

    public function getConfigurationAction(){
        return $this->getConfiguration(true);
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
     * Get schema by name
     *
     * @param string $name Feature type name
     * @return FeatureType
     * @throws \Symfony\Component\Config\Definition\Exception\Exception
     */
    protected function getFeatureTypeBySchemaName($name)
    {
        if ($name=='all') {
            return null;
        }
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

        if ($schemaName == 'all') {
            $config = $this->getConfiguration();
            $schemes = $config["schemes"];
            $features = array();
            foreach($schemes as $subSchemaName => $scheme) {
                if ($subSchemaName == 'all') {
                    continue;
                }
                $request["schema"] = $subSchemaName;
                $featureCollection = $this->selectAction($request);
                foreach ($featureCollection["features"] as &$feature) {

                    $feature["properties"]["schemaName"] = $subSchemaName;
                };
                $features = array_merge($features,$featureCollection["features"]);
            }
            $featureCollection = array("type" => "FeatureCollection",  "features" => $features);
        } else {

            $featureCollection = $featureType->search(
                array_merge(
                    array(
                        'returnType' => 'FeatureCollection',
                        'maxResults' => $this->maxResults
                    ),
                    $request
                )
            );
        }

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
     * @throws \Exception
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
            foreach($results as &$result) {
                $result->setAttributes(array("schemaName" => $schemaName));
            }
            $results = $featureType->toFeatureCollection($results);
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
        $dataSets = array();
        $remoteData = ($this->getSchemaByName($schemaName))["popup"]["remoteData"];
        $responseArray = array('dataSets' => array());
        $responseArray = array('errors' => array());
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
            } catch (\Exception $e) {
                $this->container->get('logger')->error('Digitizer WMS GetFeatureInfo: '. $e->getMessage());
                $responseArray['error']  = $e->getMessage();
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
        if ($name == 'all') {
            return null;
        }
        $configuration = $this->getConfiguration(false);
        $schemas       = $configuration["schemes"];

        if (!isset($schemas[ $name ])) {
            throw new Exception("Feature type schema name '$name' isn't defined", 2);
        }

        $schema = $schemas[ $name ];
        return $schema;
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
     * @param string $id
     * @return DataStore
     */
    protected function getDataStoreById($id)
    {
        /** @var DataStoreService $dataStoreService */
        $dataStoreService = $this->container->get('data.source');
        return $dataStoreService->get($id);
    }



    /**
     * Save feature style
     *
     * @param $postData
     * @return mixed
     */
    protected function saveStyleAction($postData)
    {
        $this->styleManager = new DigitizerStyleManager($this->container);
        $userId = $this->getCurrentUserId();
        $parameters = array(
            //'schemaName' => $postData['schema'],
            'featureId'  => $postData['featureId'],
            'userId'     => $userId,
        );
        $newStyle = $postData['style'];
        $styleParameters = array_merge($newStyle, $parameters);

        $style  = new Style($styleParameters);
        $styleData = $this->styleManager->save($style, $userId)->toArray();
        unset($styleData['userId']);
        unset($styleData['name']);
        unset($styleData['styleMaps']);
        unset($styleData['title']);
        $results['style']   = $styleData;

        return $results;
    }

    /**
     * Get styles list
     *
     * @param $postData
     * @return mixed
     */
    protected function listStyleAction($postData)
    {

        $this->styleManager = new DigitizerStyleManager($this->container);
        $results['featureStyles'] = $this->styleManager->getSchemaStyles($postData["schema"], $this->getCurrentUserId());

        return $results;
    }

    /**
     * @param Request $request
     * @param string[]|string $allowedMethods
     * @throws BadRequestHttpException
     *
     */
    protected static function requireMethod($request, $allowedMethods)
    {
        if (!is_array($allowedMethods)) {
            $allowedMethods = explode(',', strtoupper($allowedMethods));
        } else {
            $allowedMethods = array_map('strtoupper', $allowedMethods);
        }
        $method = $request->getMethod();
        if (!in_array($method, $allowedMethods)) {
            throw new BadRequestHttpException("Unsupported method $method");
        }
    }

    /**
     * @return mixed
     */
    // This supports different Mapbender Versions
    protected function getCurrentUserId()
    {
        if (method_exists($this,"getUser")) {
            $user = $this->getUser();
            if (is_object($user)) {
                return $user->getId();
            } else {
                return $user;
            }
        } else {
            return $this->getUserId();
        }
    }
}
