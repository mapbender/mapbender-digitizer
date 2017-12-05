<?php

namespace Mapbender\DigitizerBundle\Element;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DBALException;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Element\BaseElement;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DigitizerBundle\Component\Uploader;
use Mapbender\DigitizerBundle\Entity\Condition;
use Mapbender\DigitizerBundle\Entity\Style;
use Symfony\Component\Config\Definition\Exception\Exception;

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

    /**
     * @inheritdoc
     */
    static public function listAssets()
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
                'feature-style-editor.js',
                'mapbender.element.digitizer.js'
            ),
            'css'   => array(
                'sass/element/digitizer.scss'
            ),
            'trans' => array(
                'MapbenderDigitizerBundle:Element:digitizer.json.twig'
            ));
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

        if (isset($configuration["schemes"]) && is_array($configuration["schemes"])) {
            foreach ($configuration['schemes'] as $key => &$scheme) {
                if (is_string($scheme['featureType'])) {
                    $featureTypeName           = $scheme['featureType'];
                    $featureTypes              = $this->container->getParameter('featureTypes');
                    $scheme['featureType']     = $featureTypes[ $featureTypeName ];
                    $scheme['featureTypeName'] = $featureTypeName;
                }

                if ($public) {
                    $this->cleanFromInternConfiguration($scheme['featureType']);
                }

                if (isset($scheme['formItems'])) {
                    $scheme['formItems'] = $this->prepareItems($scheme['formItems']);
                }

                if (isset($scheme['search']) && isset($scheme['search']["form"])) {
                    $scheme['search']["form"] = $this->prepareItems($scheme['search']["form"]);
                }
            }
        }
        return $configuration;
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
     * @return \Mapbender\DataSourceBundle\Entity\DataItem
     */
    public function saveDatastoreAction ($request)
    {
        $id          = $request['id'];
        $dataItem    = $request['dataItem'];
        $dataStore   = $this->container->get("data.source")->get($id);
        $uniqueIdKey = $dataStore->getDriver()->getUniqueId();
        if (empty($request['dataItem'][ $uniqueIdKey ])) {
            unset($request['dataItem'][ $uniqueIdKey ]);
        }
        return $dataStore->save($dataItem);
    }

    /**
     * @param $request
     * @return mixed|null
     */
    public function getDatastoreAction($request)
    {
        if (!isset($request['id']) || !isset($request['dataItemId'])) {
            $results = array(
                array('errors' => array(
                    array('message' => "datastore/get: id or dataItemId not defined!")
                ))
            );
            return $results;
        }

        $id           = $request['id'];
        $dataItemId   = $request['dataItemId'];
        $dataStore    = $this->container->get("data.source")->get($id);
        $dataItem     = $dataStore->get($dataItemId);
        $dataItemData = null;
        if ($dataItem) {
            $dataItemData = $dataItem->toArray();
        }

        return $dataItemData;
    }

    /**
     * Remove data store item
     *
     * @param $request
     * @return bool|mixed|null
     */
    public function removeDatastoreAction($request)
    {
        $id          = $request['id'];
        $dataStore   = $this->container->get("data.source")->get($id);
        $uniqueIdKey = $dataStore->getDriver()->getUniqueId();
        $dataItemId  = $request['dataItem'][ $uniqueIdKey ];
        return $dataStore->remove($dataItemId);
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
                     'uniqueId',
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
            $dataStore = $this->container->get('data.source')->get($settings);
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
}