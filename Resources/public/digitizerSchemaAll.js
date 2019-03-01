var AllScheme = function () {

    Scheme.apply(this, arguments);


    this.featureType = {
        geomType: 'all'
    };

};


AllScheme.prototype = {

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
    zoomDependentVisibility: [{max: 10000}],
    confirmSaveOnDeactivate: true,

    getStyleMapOptions : function (label) {
        var schema = this;
        var widget = schema.widget;

        var rules = [];

        _.each(widget.schemes, function (scheme) {

            var rule = new OpenLayers.Rule({
                symbolizer: scheme.layer.styleMap.styles[label].defaultStyle,
                evaluate: function (feature) {
                    var equals = feature.attributes.geomType === scheme.featureType.geomType;
                    return equals;
                }
            });

            rules.push(rule);
        });

        return {
            rules: rules
        }
    },

    createToolset : function () {
        var schema = this;
        var widget = schema.widget;
        var toolset = [];
        _.each(widget.schemes, function (scheme, schemaName) {
            $.each(scheme.toolset, function (i, element) {

                // Avoid duplicates, i.e. elements with same 'type' property
                if (toolset.filter(function (t) {
                    return t.type === element.type
                }).length === 0) {
                    toolset.push(element);
                }

            });

        });

        // TODO find better place for all possible controls in array
        var config = ['drawPoint', 'drawLine', 'drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut', 'drawText', 'modifyFeature', 'moveFeature', 'selectFeature', 'removeSelected'];

        toolset = toolset.sort(function (a, b) {
            return config.indexOf(a.type) > config.indexOf(b.type) ? 1 : -1;
        });

        return toolset;
    },



    getFormItems: function (feature) {
        var schema = this;
        var widget = schema.widget;
        console.assert(!!feature.attributes.geomType, "geometry type of new Feature must be set");
        var featureSchema = widget.getSchemaByGeomType(feature.attributes.geomType);
        return featureSchema.getFormItems(feature);
    },


// TODO merge this methods
    getSchemaName: function (feature) {
        var schema = this;
        var widget = schema.widget;
        return widget.getSchemaByGeomType(feature.attributes.geomType).schemaName;
    },

    getSchemaByFeature: function (feature) {
        var schema = this;
        var widget = schema.widget;

        return widget.getSchemaByGeomType(feature.attributes.geomType);
    }
};




Object.setPrototypeOf(AllScheme.prototype,Scheme.prototype);
