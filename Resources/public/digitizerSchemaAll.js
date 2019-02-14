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
    toolset: [{type: 'drawPoint'},{type: 'drawLine'},{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
    zoomDependentVisibility: [{max: 10000}],
    confirmSaveOnDeactivate: true
});


AllScheme.prototype._createStyleMap = function (labels, styleContext) {
    var schema = this;
    var widget = schema.widget;
    var styleMapObject = {};

    _.each(widget.options.schemes, function (scheme, schemaName) {
        if (schemaName === schema.schemaName) {
            return;
        }
        labels.forEach(function (rawLabel) {
            var label = rawLabel + "-" + scheme.featureType.geomType;
            var styleOL = OpenLayers.Feature.Vector.style[rawLabel] || OpenLayers.Feature.Vector.style['default'];

            styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, scheme.styles[rawLabel] || widget.styles[rawLabel]), styleContext);
        });
    });
    return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});
};


AllScheme.prototype.redesignLayerFunctions = function () {

    var schema = this;
    var widget = schema.widget;
    var layer = schema.layer;

    var drawFeature = OpenLayers.Layer.Vector.prototype.drawFeature;


    layer.drawFeature = function (feature, styleId) {
        var newStyleId = (styleId || 'default') + "-" + widget.getGeometryNameByFeatureClass(feature.geometry.CLASS_NAME);
        return drawFeature.apply(this, [feature, newStyleId]);
    };

};

AllScheme.prototype.getFormItems = function(feature) {
    var schema = this;
    var widget = schema.widget;
    var featureSchema = widget.getSchemaByOLFeature(feature);
    return featureSchema.getFormItems(feature);
};


AllScheme.prototype.getSchemaName = function(feature) {
    var schema = this;;
    var widget = schema.widget;
    return widget.getSchemaByOLFeature(feature).schemaName;
};

