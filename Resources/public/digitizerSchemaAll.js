var AllScheme = function () {

    Scheme.apply(this, arguments);

};

AllScheme.prototype = Object.create(Scheme.prototype);

AllScheme.prototype = $.extend({},AllScheme.prototype,{

    showExtendSearchSwitch: true,
    openFormAfterEdit: true,
    allowEditData: true,
    allowDelete: true,
    allowPrintMetadata: true,
    allowDigitize: true,
    displayPermanent: false,
    displayOnSelect: true,
    inlineSearch: true,
    allowCustomerStyle: true,
    useContextMenu: true,
    schemaName: 'all',
    featureType: 'all',
    toolset: [{type: 'drawPoint'},{type: 'drawText'},{type: 'drawLine'},{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
    zoomDependentVisibility: [{max: 10000}],
    confirmSaveOnDeactivate: true
});


AllScheme.prototype._createStyleMap = function (labels, styleContext) {
    var schema = this;
    var widget = schema.widget;
    var styleMapObject = {};

    console.log(widget.schemes,"@@@");
    _.each(widget.schemes, function (scheme, schemaName) {
        if (schemaName === schema.schemaName) {
            return;
        }
        labels.forEach(function (rawLabel) {
            var label = rawLabel + "-" + scheme.featureType.geomType;
            var styleOL = OpenLayers.Feature.Vector.style[rawLabel] || OpenLayers.Feature.Vector.style['default'];

            styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, scheme.styles[rawLabel] || widget.styles[rawLabel]), styleContext);
        });

        if (!schema.markUnsavedFeatures) {
            styleMapObject["unsaved-"+scheme.featureType.geomType] = styleMapObject["default-"+scheme.featureType.geomType];
        }


    });
    return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});
};


AllScheme.prototype.redesignLayerFunctions = function () {

    var schema = this;
    var widget = schema.widget;
    var layer = schema.layer;

    var drawFeature = OpenLayers.Layer.Vector.prototype.drawFeature;


    layer.drawFeature = function (feature, styleId) {
        if (!styleId || styleId.length <= 20) { // simple way to detect if it is an individual style
            var newStyleId = (styleId || 'default') + "-" + widget.getGeometryNameByGeomType(feature.attributes.geomType);
        } else {
            newStyleId = styleId;
        }
        var ret = drawFeature.apply(this, [feature, newStyleId]);
        return ret;
    };

};

AllScheme.prototype.getFormItems = function(feature) {
    var schema = this;
    var widget = schema.widget;
    var featureSchema = widget.getSchemaByGeomType(feature.attributes.geomType);
    return featureSchema.getFormItems(feature);
};


// TODO merge this methods
AllScheme.prototype.getSchemaName = function(feature) {
    var schema = this;
    var widget = schema.widget;
    return widget.getSchemaByGeomType(feature.attributes.geomType).schemaName;
};

AllScheme.prototype.getSchemaByFeature = function(feature) {
    var schema = this;
    var widget = schema.widget;

    return widget.getSchemaByGeomType(feature.attributes.geomType);
};
