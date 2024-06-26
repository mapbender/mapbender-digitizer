<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataSourceBundle\Component\FeatureType;

/**
 * @method FeatureType getDataStore(Element $element, $schemaName)
 * @method FeatureType storeFromConfig(array $config)
 */
class SchemaFilter extends \Mapbender\DataManagerBundle\Component\SchemaFilter
{
    public static function getConfigDefaults()
    {
        return array_replace(parent::getConfigDefaults(), array(
            'styles' => static::getDefaultStyles(),
            // @todo: no form items is an error if the popup ever opens
            'formItems' => array(),
            'allowDigitize' => true,
            // @todo: default allow or default deny?
            'allowDelete' => true,
            'allowCustomStyle' => false,
            // @todo: may not need configurability at all. Who doesn't want this?
            'allowChangeVisibility' => true,
            'continueDrawingAfterSave' => false,
            'displayPermanent' => false,
            'printable' => false,
            'minScale' => null,
            'maxScale' => null,
            'searchType' => 'currentExtent',
            // @todo: specify, document
            'copy' => array(
                'enable' => false,
                'overwriteValuesWithDefault' => false,
                'data' => null, // @todo: specify, document
            ),
            // @todo: specify, document; current implementation does not work on Openlayers 4/5/6
            'refreshLayersAfterFeatureSave' => false,

            // Inherited:
            // * popup.title
            // * popup.width

            // no defaults:
            // * toolset
        ));
    }

    public static function getGrantFlagNames()
    {
        return \array_merge(parent::getGrantFlagNames(), array(
            'allowDigitize',
        ));
    }

    /**
     * @return array[]
     * @todo: make protected
     */
    public static function getDefaultStyles()
    {
        return array(
            'default' => array(
                'strokeWidth' => 1,
                'strokeColor' => '#6fb536',
                'fillColor' => '#6fb536',
                'fillOpacity' => 0.3,
            ),
            'select' => array(
                'strokeWidth' => 3,
                'fillColor' => '#F7F79A',
                'strokeColor' => '#6fb536',
                'fillOpacity' => 0.5,
            ),
            'unsaved' => array(
                'strokeWidth' =>  3,
                'fillColor' => '#FFD14F',
                'strokeColor' => '#F5663C',
                'fillOpacity' => 0.5,
            ),
        );
    }

    public function processSchemaBaseConfig(array $schemaConfig, $schemaName)
    {
        // Resolve aliased "tableFields" (Digitizer legacy) vs "table.column" (DM)
        $schemaConfig += array('table' => array());
        if (!empty($schemaConfig['tableFields'])) {
            $schemaConfig['table'] += array('columns' => $schemaConfig['tableFields']);
        }
        unset($schemaConfig['tableFields']);

        // resolve aliasing DM "allowEdit" vs historical Digitizer "allowEditData"
        if (\array_key_exists('allowEditData', $schemaConfig)) {
            $schemaConfig['allowEdit'] = $schemaConfig['allowEditData'];
            unset($schemaConfig['allowEditData']);
        }
        $schemaConfig = parent::processSchemaBaseConfig($schemaConfig, $schemaName);

        // Digitzer quirk: there is no "allowCreate" in any historical default or example configuration
        $schemaConfig['allowCreate'] = $schemaConfig['allowEdit'];

        // re-merge styles (upstream merge is not recursive, we may be missing entries depending on config)
        $schemaConfig['styles'] = array_replace_recursive($this->getDefaultStyles(), $schemaConfig['styles']);

        // Disallow style editing if editing is disabled
        if (!$schemaConfig['allowEdit']) {
            $schemaConfig['allowCustomStyle'] = false;
        }

        return $schemaConfig;
    }

    protected function prepareInlineSchema($name, $schemaConfig, $storeConfigs)
    {
        $schemaConfig = parent::prepareInlineSchema($name, $schemaConfig, $storeConfigs);

        if ($schemaConfig['allowCustomStyle']) {
            $featureTypeConfig = $storeConfigs[$name];
            if (empty($featureTypeConfig['styleField'])) {
                @trigger_error("WARNING: disabling 'allowCustomStyle' option for schema {$name}. Missing 'styleField' setting.", E_USER_DEPRECATED);
                $schemaConfig['allowCustomStyle'] = false;
            }
        }
        return $schemaConfig;
    }
}
