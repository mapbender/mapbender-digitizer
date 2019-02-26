var AllScheme = function () {

    Scheme.apply(this, arguments);


    this.featureType = {
        geomType : 'all'
    };

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

    _.each(widget.schemes, function (scheme, schemaName) {
        if (schemaName === schema.schemaName) {
            return;
        }
        labels.forEach(function (rawLabel) {
            var label = scheme.getStyleMapLabelForAllScheme(rawLabel);
            var styleOL = OpenLayers.Feature.Vector.style[rawLabel] || OpenLayers.Feature.Vector.style['default'];

            styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, scheme.styles[rawLabel] || widget.styles[rawLabel]), styleContext);
        });

        if (!schema.markUnsavedFeatures) {
            styleMapObject["unsaved-"+scheme.featureType.geomType] = styleMapObject["default-"+scheme.featureType.geomType];
        }


    });
    return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});
};

AllScheme.prototype.createToolset = function() {
    var schema = this;
    var widget = schema.widget;
    var toolset = [];
    _.each(widget.schemes, function (scheme, schemaName) {
        $.each(scheme.toolset, function(i,element) {

            // Avoid duplicates, i.e. elements with same 'type' property
            if (toolset.filter(function(t) { return t.type === element.type }).length === 0) {
                toolset.push(element);
            }

        });

    });

    // TODO find better place for all possible controls in array
    var config = ['drawPoint','drawLine','drawPolygon','drawRectangle','drawCircle','drawEllipse','drawDonut','drawText','modifyFeature','moveFeature','selectFeature','removeSelected'];

    toolset = toolset.sort(function(a,b) { return config.indexOf(a.type) > config.indexOf(b.type) ? 1 : -1; });

    return toolset;
};

AllScheme.prototype.redesignLayerFunctions = function () {

    var schema = this;
    var widget = schema.widget;
    var layer = schema.layer;

    var drawFeature = OpenLayers.Layer.Vector.prototype.drawFeature;


    layer.drawFeature = function (feature, styleId) {
        console.warn(feature,styleId);
        if (!styleId || styleId.length <= 20) { // simple way to detect if it is an individual style
            var newStyleId = (styleId || 'default') + "-" +feature.attributes.geomType;
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
    console.assert(!!feature.attributes.geomType, "geometry type of new Feature must be set");
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
