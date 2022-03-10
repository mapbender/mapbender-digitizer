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
        );
    }

    /**
     * @param mixed[][] $schemaConfigs
     * @return mixed[][]
     */
    public function prepareConfigs($schemaConfigs)
    {
        $storeConfigs = DataStoreUtil::configsFromSchemaConfigs($this->registry, $schemaConfigs);

        foreach ($schemaConfigs as $schemaName => $schemaConfig) {
            $haveDs = false;
            foreach (array('dataStore', 'featureType') as $dsKey) {
                if (\array_key_exists($dsKey, $schemaConfig)) {
                    $schemaConfig[$dsKey] = $storeConfigs[$schemaName];
                    $haveDs = true;
                }
            }
            if (!$haveDs) {
                throw new ConfigurationErrorException("No dataStore / featureType in schema {$schemaName}");
            }
            if (!empty($schemaConfig['formItems'])) {
                $schemaConfig['formItems'] = $this->formItemFilter->prepareItems($schemaConfig['formItems']);
            } else {
                @trigger_error("WARNING: no formItems in schema {$schemaName}. Object detail view will not work", E_USER_DEPRECATED);
                $schemaConfig['formItems'] = array();
            }
            $schemaConfigs[$schemaName] = $schemaConfig;
        }
        return $schemaConfigs;
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
        $elementConfig = $element->getConfiguration();
        if (empty($elementConfig['schemes'])) {
            throw new ConfigurationErrorException("Schema configuration completely empty");
        }
        if (empty($elementConfig['schemes'][$schemaName])) {
            throw new UnknownSchemaException("No such schema " . print_r($schemaName, true));
        }
        $rawSchemaConfig = $elementConfig['schemes'][$schemaName];
        if ($addDefaults) {
            $rawSchemaConfig += $this->getConfigDefaults();
        }
        return $rawSchemaConfig;
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
        // always guarantee "schemaName" and "label" properties, even with $raw = true
        $schemaConfig['schemaName'] = $schemaName;
        if (empty($schemaConfig['label'])) {
            $schemaConfig['label'] = $schemaName;
        }
        // Re-merge "popup" sub-array
        if (!empty($rawConfig['popup']) && !empty($defaults['popup'])) {
            $schemaConfig['popup'] = array_replace($defaults['popup'], $rawConfig['popup']);
        }
        // Re-merge "table" sub-array
        if (!empty($rawConfig['table']) && !empty($defaults['table'])) {
            $schemaConfig['table'] = array_replace($defaults['table'], $rawConfig['table']);
        }
        return $schemaConfig;
    }

    protected function getExtendedUploadsBasePath($storeConfig)
    {
        if (null === $this->isFeatureTypeRegistry) {
            $this->isFeatureTypeRegistry = (($this->registry->dataStoreFactory($storeConfig)) instanceof FeatureType);
        }
        return $this->uploadsBasePath . '/' . ($this->isFeatureTypeRegistry ? 'featureTypes' : 'ds-uploads');
    }
}
