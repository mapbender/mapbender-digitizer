<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataSourceBundle\Component\FeatureType;

/**
 * @method FeatureType getDataStore(Element $element, $schemaName)
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
            'allowEditData' => true,
            // @todo: default allow or default deny?
            'allowDelete' => true,
            'allowCustomStyle' => false,
            // @todo: may not need configurability at all. Who doesn't want this?
            'allowChangeVisibility' => true,
            'continueDrawingAfterSave' => false,
            'displayPermanent' => false,
            'printable' => false,
            'inlineSearch' => true,
            'pageLength' => 16,
            'minScale' => null,
            'maxScale' => null,
            'searchType' => 'currentExtent',
            // @todo: specify, document
            'copy' => array(
                'enable' => false,
                'overwriteValuesWithDefault' => false,
                'data' => null, // @todo: specify, document
            ),
            // @todo: specify, document
            'refreshFeaturesAfterSave' => false,
            // @todo: specify, document; current implementation does not work on Openlayers 4/5/6
            'refreshLayersAfterFeatureSave' => false,

            // Inherited:
            // * popup.title
            // * popup.width


            // no defaults:
            // * tableFields
            // * toolset
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
        $schemaConfig = parent::processSchemaBaseConfig($schemaConfig, $schemaName);
        // resolve aliasing DM "allowEdit" vs historical Digitizer "allowEditData"
        $schemaConfig['allowEdit'] = !!$schemaConfig['allowEditData'];
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
}
