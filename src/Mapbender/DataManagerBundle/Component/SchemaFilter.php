<?php


namespace Mapbender\DataManagerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataManagerBundle\Exception\UnknownSchemaException;
use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Component\RepositoryRegistry;

class SchemaFilter
{
    /** @var RepositoryRegistry */
    protected $registry;
    /** @var FormItemFilter */
    protected $formItemFilter;
    /** @var string */
    protected $uploadsBasePath;
    /** @var boolean|null lazy-init */
    protected $isFeatureTypeRegistry;

    /**
     * @param RepositoryRegistry $registry
     * @param FormItemFilter $formItemFilter
     * @param string $uploadsBasePath
     */
    public function __construct(RepositoryRegistry $registry,
                                FormItemFilter $formItemFilter,
                                $uploadsBasePath)
    {
        $this->registry = $registry;
        $this->formItemFilter = $formItemFilter;
        $this->uploadsBasePath = trim($uploadsBasePath, '/\\');
    }

    /**
     * @return mixed[]
     */
    public static function getConfigDefaults()
    {
        return array(
            'allowEdit' => true,
            'allowRefresh' => false,
            'allowCreate' => true,
            'allowDelete' => true,
            'popup' => array(
                'width' => '550px',
            ),
            'table' => array(
                'searching' => true,
                'pageLength' => 16,
            ),
            'listed' => true,
        );
    }

    /**
     * @param Element $element
     * @return mixed[][]
     */
    public function prepareConfigs(Element $element)
    {
        $configsOut = array();
        $configsIn = $this->getAllConfigs($element);
        $storeConfigs = DataStoreUtil::configsFromSchemaConfigs($this->registry, $configsIn);

        foreach ($configsIn as $schemaName => $configIn) {
            if (\array_key_exists('combine', $configIn)) {
                $configOut = $this->prepareCombinationSchema($schemaName, $configIn, $configsIn, $storeConfigs);
            } else {
                $configOut = $this->prepareInlineSchema($schemaName, $configIn, $storeConfigs);
            }
            $configsOut[$schemaName] = $this->amendBaseProperties($configOut, $schemaName);
        }
        return $configsOut;
    }

    /**
     * @param Element $element
     * @return mixed[]
     */
    protected function getAllConfigs(Element $element)
    {
        return $element->getConfiguration()['schemes'];
    }

    protected function prepareInlineSchema($name, $schemaConfig, $storeConfigs)
    {
        $schemaConfig += $this->getConfigDefaults();
        $schemaConfig = $this->processSchemaBaseConfig($schemaConfig, $name);
        $haveDs = false;
        foreach (array('dataStore', 'featureType') as $dsKey) {
            if (\array_key_exists($dsKey, $schemaConfig)) {
                $schemaConfig[$dsKey] = $storeConfigs[$name];
                $haveDs = true;
            }
        }
        if (!$haveDs) {
            throw new ConfigurationErrorException("No dataStore / featureType in schema {$name}");
        }
        if (!empty($schemaConfig['formItems'])) {
            $schemaConfig['formItems'] = $this->formItemFilter->prepareItems($schemaConfig['formItems']);
        } else {
            @trigger_error("WARNING: no formItems in schema {$name}. Object detail view will not work", E_USER_DEPRECATED);
            $schemaConfig['formItems'] = array();
        }
        return $schemaConfig;
    }

    protected static function getInvalidCombinationKeys()
    {
        return array(
            'featureType',
            'dataStore',
            'formItems',
            'popup',
        );
    }

    protected function prepareCombinationSchema($name, $schemaConfig, $others, $storeConfigs)
    {
        if (empty($schemaConfig['combine'])) {
            throw new ConfigurationErrorException("Combination schema {$name} combines nothing");
        }
        if (isset($schemaConfig['listed']) && !$schemaConfig['listed']) {
            throw new ConfigurationErrorException("Combination schema {$name} cannot be unlisted");
        }
        $otherKeys = \array_keys($schemaConfig);
        $notAllowed = \array_intersect($otherKeys, $this->getInvalidCombinationKeys());
        foreach ($otherKeys as $otherKey) {
            if (\preg_match('#^allow#', $otherKey)) {
                $notAllowed[] = $otherKey;
            }
        }
        if ($notAllowed) {
            throw new ConfigurationErrorException("Combination schema {$name} cannot define its own value(s) for " . \implode(', ', $notAllowed));
        }
        foreach ($schemaConfig['combine'] as $other) {
            if (isset($others[$other]['combine'])) {
                throw new ConfigurationErrorException("Combination schema {$name} cannot combine other combinations");
            }
        }
        $schemaConfig['listed'] = true;

        return $schemaConfig;
    }

    /**
     * @param Element $element
     * @param string $schemaName
     * @return boolean
     */
    public function checkAllowDelete(Element $element, $schemaName)
    {
        $schemaConfig = $this->getRawSchemaConfig($element, $schemaName, true);
        return $this->checkAllowDeleteInternal($schemaConfig);
    }

    /**
     * @param array $schemaConfig
     * @return boolean
     */
    protected function checkAllowDeleteInternal(array $schemaConfig)
    {
        return !empty($schemaConfig['allowDelete']);
    }

    /**
     * @param Element $element
     * @param string $schemaName
     * @param boolean $isNew
     * @return boolean
     */
    public function checkAllowSave(Element $element, $schemaName, $isNew)
    {
        $schemaConfig = $this->getRawSchemaConfig($element, $schemaName, true);
        return $this->checkAllowSaveInternal($schemaConfig, $isNew);
    }

    /**
     * @param array $schemaConfig
     * @param boolean $isNew
     * @return boolean
     */
    protected function checkAllowSaveInternal(array $schemaConfig, $isNew)
    {
        if (!$isNew || !\array_key_exists('allowCreate', $schemaConfig)) {
            // "allowEditData": Digitizer quirk
            return !empty($schemaConfig['allowEdit']) || !empty($schemaConfig['allowEditData']);
        } else {
            return !empty($schemaConfig['allowCreate']);
        }
    }

    /**
     * @param Element $element
     * @param string $schemaName
     * @return mixed[]
     */
    public function getDataStoreConfig(Element $element, $schemaName)
    {
        $elementConfig = $element->getConfiguration();
        $schemaConfigs = $elementConfig['schemes'];
        $storeConfigs = DataStoreUtil::configsFromSchemaConfigs($this->registry, $schemaConfigs);
        return $storeConfigs[$schemaName];
    }

    /**
     * @param Element $element
     * @param string $schemaName
     * @return DataStore
     */
    public function getDataStore(Element $element, $schemaName)
    {
        $config = $this->getDataStoreConfig($element, $schemaName);
        return $this->registry->dataStoreFactory($config);
    }

    /**
     * @param Element $element
     * @param string $schemaName
     * @param bool $addDefaults
     * @return mixed[]
     */
    public function getRawSchemaConfig(Element $element, $schemaName, $addDefaults = false)
    {
        $allConfigs = $this->getAllConfigs($element);
        if (empty($allConfigs[$schemaName])) {
            throw new UnknownSchemaException("No such schema " . print_r($schemaName, true));
        }
        $schemaConfig = $allConfigs[$schemaName];
        if ($addDefaults) {
            $schemaConfig += $this->getConfigDefaults();
        }
        return $this->amendBaseProperties($schemaConfig, $schemaName);
    }

    protected function amendBaseProperties($schemaConfig, $schemaName)
    {
        // Always guarantee "schemaName" and "label" properties
        $schemaConfig['schemaName'] = $schemaName;
        if (empty($schemaConfig['label'])) {
            $schemaConfig['label'] = $schemaName;
        }
        return $schemaConfig;
    }

    /**
     * Returns storage path for new file uploads.
     *
     * @param Element $element
     * @param $schemaName
     * @param $fieldName
     * @return string
     */
    public function getUploadPath(Element $element, $schemaName, $fieldName)
    {
        $paths = $this->getUploadPaths($element, $schemaName, $fieldName);
        return $paths[0];
    }

    /**
     * Returns possible paths to preeexisting file uploads.
     *
     * @param Element $element
     * @param string $schemaName
     * @param string $fieldName
     * @return string[]
     */
    public function getUploadPaths(Element $element, $schemaName, $fieldName)
    {
        $paths = array();
        $storeConfig = $this->getDataStoreConfig($element, $schemaName);
        $overrides = DataStoreUtil::getFileConfigOverrides($storeConfig);
        if (!empty($overrides[$fieldName]['path'])) {
            $paths[] = $overrides[$fieldName]['path'];
        }
        $defaultPath = $this->getExtendedUploadsBasePath($storeConfig);
        if (!empty($storeConfig['table'])) {
            $defaultPath = "{$defaultPath}/{$storeConfig['table']}";
        }
        $paths[] ="{$defaultPath}/{$fieldName}";
        return $paths;
    }

    /**
     * @param mixed[] $schemaConfig
     * @param $schemaName
     * @return mixed[]
     */
    public function processSchemaBaseConfig(array $schemaConfig, $schemaName)
    {
        // Re-merge "popup" sub-array
        if (!empty($schemaConfig['popup']) && !empty($defaults['popup'])) {
            $schemaConfig['popup'] = array_replace($defaults['popup'], $schemaConfig['popup']);
        }
        // Re-merge "table" sub-array
        if (!empty($schemaConfig['table']) && !empty($defaults['table'])) {
            $schemaConfig['table'] = array_replace($defaults['table'], $schemaConfig['table']);
        }
        if (!empty($schemaConfig['table']['columns'])) {
            $schemaConfig['table']['columns'] = $this->normalizeColumnsConfigs($schemaConfig['table']['columns']);
        }
        return $schemaConfig;
    }

    /**
     * Normalize legacy configuration quirks for table columns into
     * homogenuous list-of-objects, with at least "title" and "data" keys
     * 1) Digitizer using key:value mapping for columns instead of lists
     * 2) Digitizer allowing scalar strings instead of objects

     * @param array $rawColumns
     * @throws \Exception
     * @return array
     */
    protected function normalizeColumnsConfigs(array $rawColumns)
    {
        $columnsOut = array();
        foreach ($rawColumns as $key => $columnDef) {
            if (\is_string($columnDef)) {
                $columnDef = array(
                    'data' => $columnDef,
                );
            } else {
                if (empty($columnDef['data'])) {

                $columnDef = array_replace($columnDef, array(
                    'data' => $key,
                ));
                }
            }
            // Historical digitizer quirk: uses "label" (does nothing)
            // instead of "title" (column header)
            if (empty($columnDef['title']) && \array_key_exists('label', $columnDef)) {
                $columnDef['title'] = $columnDef['label'];
            }
            unset($columnDef['label']);
            $columnDef += array(
                'title' => ucfirst($columnDef['data']),
            );
            $columnsOut[] = $columnDef;
        }
        return $columnsOut;
    }

    protected function getExtendedUploadsBasePath($storeConfig)
    {
        if (null === $this->isFeatureTypeRegistry) {
            $this->isFeatureTypeRegistry = (($this->registry->dataStoreFactory($storeConfig)) instanceof FeatureType);
        }
        return $this->uploadsBasePath . '/' . ($this->isFeatureTypeRegistry ? 'featureTypes' : 'ds-uploads');
    }
}