<?php

namespace Mapbender\DigitizerBundle\Element;

use Doctrine\DBAL\DBALException;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\DataStoreService;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Component\FeatureTypeService;
use Mapbender\DataSourceBundle\Element\BaseElement;
use Mapbender\DataSourceBundle\Entity\Feature;
use Mapbender\DigitizerBundle\Component\Uploader;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 *
 */
class Digitizer extends BaseElement
{
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
            'js' => array(
                "@MapbenderCoreBundle/Resources/public/mapbender.container.info.js",
                '../../vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js',
                '../../vendor/blueimp/jquery-file-upload/js/jquery.iframe-transport.js',
                "/components/jquery-context-menu/jquery-context-menu-built.js",
                '@MapbenderDigitizerBundle/Resources/public/digitizingToolset.js',
                '@MapbenderDigitizerBundle/Resources/public/mapbender.element.digitizer.js',
            ),
             'css' => array(
                 '@MapbenderDigitizerBundle/Resources/public/sass/element/context-menu.scss',
                 '@MapbenderDigitizerBundle/Resources/public/sass/element/digitizer.scss',
                 '@MapbenderDigitizerBundle/Resources/public/sass/element/temp_adjustment.css',
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
     * @param Request $requestService
     * @return \Symfony\Component\HttpFoundation\Response
     * @throws \Exception
     */
    public function handleHttpRequest(Request $requestService)
    {
        $action = $requestService->attributes->get('action');
        $request         = json_decode($requestService->getContent(), true);

        switch ($action) {
            case 'select':
                return new JsonResponse($this->selectAction($requestService));
            case 'save':
                return new JsonResponse($this->saveAction($request));
            case 'delete':
                return new JsonResponse($this->deleteAction($requestService));
            case 'uploadFile':
            case 'file/upload':
            case 'file-upload': // super legacy mode
                // @todo: all '*Action' methods should return responses
                return new JsonResponse($this->uploadFileAction($requestService));
            case 'datastore/get':
            case 'getDatastore':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->getDatastoreAction($request));
            case 'datastore/save':
            case 'saveDatastore':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->saveDatastoreAction($request));
            case 'removeDatastore':
            case 'datastore/remove':
                // @todo: all '*Action' methods should return responses
                // @todo: all '*Action' methods should deal with the framework's Request object directly
                return new JsonResponse($this->removeDatastoreAction($request));
            default:
                // @todo: 404 please!
                $results = array(
                    array('errors' => array(
                        array('message' => $action . " not defined!")
                    ))
                );
        }
        return new JsonResponse($results);
    }

    /**
     * Select/search features and return feature collection
     *
     * @param Request $requestService
     * @return array
     */
    public function selectAction(Request $requestService)
    {
        $request = json_decode($requestService->getContent(), true);
        $defaultCriteria = array('returnType' => 'FeatureCollection',
                                 'maxResults' => 2500);
        $schemaName = isset($request["schema"]) ? $request["schema"] : $requestService->get("schema");
        $featureType = $this->getFeatureTypeForSchema($schemaName);
        return $featureType->search(array_merge($defaultCriteria, $request));
    }

    /**
     * Remove feature
     *
     * @param Request $requestService
     * @return int
     * @throws \Exception
     */
    public function deleteAction(Request $requestService)
    {
        $request = json_decode($requestService->getContent(), true);
        $schemaName = isset($request["schema"]) ? $request["schema"] : $requestService->get("schema");
        $featureType = $this->getFeatureTypeForSchema($schemaName);
        return $featureType->remove($request['feature']);
    }

    /**
     * Save feature by request data
     *
     * @param array $request
     * @return array
     */
    public function saveAction($request)
    {
        $schemaName = $request["schema"];
        $configuration = $this->getConfiguration(false);
        $featureType = $this->getFeatureTypeForSchema($schemaName);
        $schema = $this->getSchemaConfig($schemaName, true);
        $results       = array();
        $debugMode     = $configuration['debug'] || $this->container->get('kernel')->getEnvironment() == "dev";

        // save once
        if (isset($request['feature'])) {
            $request['features'] = array($request['feature']);
        }

        $connection = $featureType->getDriver()->getConnection();

        try {
            // save collection
            if (isset($request['features']) && is_array($request['features'])) {
                foreach ($request['features'] as $feature) {
                    /**
                     * @var $feature Feature
                     */
                    $featureData = $this->prepareQueriedFeatureData($feature, $schema['formItems']);

                    foreach ($featureType->getFileInfo() as $fileConfig) {
                        if (!isset($fileConfig['field']) || !isset($featureData["properties"][$fileConfig['field']])) {
                            continue;
                        }
                        $url                                             = $featureType->getFileUrl($fileConfig['field']);
                        $requestUrl                                      = $featureData["properties"][$fileConfig['field']];
                        $newUrl                                          = str_replace($url . "/", "", $requestUrl);
                        $featureData["properties"][$fileConfig['field']] = $newUrl;
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
                "For more information have a look at the webserver log file. \n Error code: " .$e->getCode();
            $results = array('errors' => array(
                array('message' => $message, 'code' => $e->getCode())
            ));
        }

        return $results;
    }

    public function uploadFileAction(Request $requestService)
    {
        $request         = json_decode($requestService->getContent(), true);
        $schemaName      = isset($request["schema"]) ? $request["schema"] : $requestService->get("schema");
        $featureType = $this->getFeatureTypeForSchema($schemaName);

        $fieldName     = $requestService->get('field');
        $urlParameters = array('schema' => $schemaName,
                               'fid'    => $requestService->get('fid'),
                               'field'  => $fieldName);
        $serverUrl     = preg_replace('/\\?.+$/', "", $_SERVER["REQUEST_URI"]) . "?" . http_build_query($urlParameters);
        $uploadDir     = $featureType->getFilePath($fieldName);
        $uploadUrl = $featureType->getFileUrl($fieldName) . "/";
        $urlParameters['uploadUrl'] = $uploadUrl;
        $uploadHandler = new Uploader(array(
            'upload_dir'                   => $uploadDir . "/",
            'script_url'                   => $serverUrl,
            'upload_url'                   => $uploadUrl,
            'accept_file_types'            => '/\.(gif|jpe?g|png)$/i',
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
        return array_merge($uploadHandler->get_response(), $urlParameters);
    }

    /**
     * @param array $request
     * @return array
     */
    public function saveDatastoreAction($request)
    {
        $id          = $request['id'];
        $dataItem    = $request['dataItem'];
        $dataStore = $this->getDataStoreById($id);
        $uniqueIdKey = $dataStore->getDriver()->getUniqueId();
        if (empty($request['dataItem'][ $uniqueIdKey ])) {
            unset($request['dataItem'][ $uniqueIdKey ]);
        }

        $dataIems = $dataStore->save($dataItem);
        return $dataIems->toArray();
    }

    /**
     * @param array $request
     * @return array
     * @throws NotFoundHttpException
     */
    public function getDatastoreAction($request)
    {
        $id           = $request['id'];
        $dataItemId   = $request['dataItemId'];
        $dataStore = $this->getDataStoreById($id);
        if (!$dataStore) {
            throw new NotFoundHttpException("No such datastore");
        }
        $entity = $dataStore->get($dataItemId);
        if (!$entity) {
            throw new NotFoundHttpException("No such entity");
        }
        return $entity->toArray();
    }

    /**
     * @param array $request
     * @return array
     */
    public function removeDatastoreAction($request)
    {
        $id          = $request['id'];
        $dataStore = $this->getDataStoreById($id);
        $uniqueIdKey = $dataStore->getDriver()->getUniqueId();
        $dataItemId  = $request['dataItem'][ $uniqueIdKey ];
        $dataStore->remove($dataItemId);
        return array(); // really?
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
                     'table',
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
     * Get a mapping of ALL schema configurations, transformed. Transformed means
     * * formItems prepared
     * * featureType string reference resolved to full featureType configuration + featureTypeName entry
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
                $this->getSchemaConfig($schemaName, false);
            }
        }
        return $this->schemaConfigs;
    }

    /**
     * Get a single (default: transformed) schema configuration. Transformed means
     * * formItems prepared
     * * featureType string reference resolved to full featureType configuration + featureTypeName entry
     *
     * Pass $raw = true to skip prepareItems / featureType resolution
     *
     * @param string $schemaName
     * @param bool $raw
     * @return mixed[]
     * @throws \RuntimeException for unknown $schemaName
     */
    protected function getSchemaConfig($schemaName, $raw = false)
    {
        if (!array_key_exists($schemaName, $this->schemaConfigs)) {
            $entityConfig = $this->entity->getConfiguration() + array(
                'schemes' => array(),
            );
            if (empty($entityConfig['schemes'][$schemaName])) {
                throw new \RuntimeException("No such schema " . print_r($schemaName));
            }
            $schemaConfig = $entityConfig['schemes'][$schemaName];
            if ($raw) {
                // no point "caching" this
                return $schemaConfig;
            }
            if (is_string($schemaConfig['featureType'])) {
                $schemaConfig['featureTypeName'] = $schemaConfig['featureType'];
                $schemaConfig['featureType'] = $this->getFeatureTypeConfig($schemaConfig['featureType']);
            }
            if (isset($schemaConfig['formItems'])) {
                $schemaConfig['formItems'] = $this->prepareItems($schemaConfig['formItems']);
            }
            $this->schemaConfigs[$schemaName] = $schemaConfig;
            $this->schemaConfigsComplete = !array_diff(array_keys($entityConfig['schemes']), array_keys($this->schemaConfigs));
        }
        // NOTE: this may return a prepared config with $raw = true, if it was already prepared fully. This should be
        //       transparent to callers.
        return $this->schemaConfigs[$schemaName];
    }

    /**
     * @param string $schemaName
     * @return FeatureType
     * @throws \RuntimeException for missing featureType configuration
     * @throws \LogicException for invalid featureType configuration
     * @throws \RuntimeException for unknown $schemaName
     */
    protected function getFeatureTypeForSchema($schemaName)
    {
        $config = $this->getFeatureTypeConfigForSchema($schemaName);
        $featureTypeService = $this->getFeatureTypeService();
        if (\method_exists($featureTypeService, 'featureTypeFactory')) {
            // data-source >= 0.1.15
            return $featureTypeService->featureTypeFactory($config);
        } else {
            return new FeatureType($this->container, $config);
        }
    }

    /**
     * @param string $schemaName
     * @return mixed[]
     * @throws \RuntimeException for missing featureType configuration
     * @throws \LogicException for invalid featureType configuration
     * @throws \RuntimeException for unknown $schemaName
     */
    protected function getFeatureTypeConfigForSchema($schemaName)
    {
        $schemaConfig = $this->getSchemaConfig($schemaName, true);
        if (empty($schemaConfig['featureType'])) {
            throw new \RuntimeException("No featureType configuration in schema " . print_r($schemaName, true));
        }
        $spec = $schemaConfig['featureType'];
        if (is_string($spec)) {
            return $this->getFeatureTypeConfig($spec);
        } else {
            if (!is_array($spec)) {
                throw new \LogicException("Invalid featureType configuration in schema " . print_r($schemaName, true) . ". Expected string or array, got " . \gettype($spec));
            }
            return $spec;
        }
    }
}
