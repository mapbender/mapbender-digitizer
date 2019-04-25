(function () {
    "use strict";
    window.AllScheme = function () {

        Scheme.apply(this, arguments);

        this.featureType = {
            geomType: 'all'
        };

    };


    AllScheme.prototype = {

        schemaName: 'all',

        getStyleMapOptions: function (label) {
            var schema = this;
            var widget = schema.widget;

            var rules = [];

            _.each(widget.getBasicSchemes(), function (scheme) {

                var rule = new OpenLayers.Rule({
                    symbolizer: scheme.layer.styleMap.styles[label].defaultStyle,
                    evaluate: function (feature) {
                        var equals = feature.attributes.geomType === scheme.featureType.geomType;
                        return equals;
                    }
                });

                rules.push(rule);
            });

            // Regel zur Darstellung von nicht-digitizer Features wie den Modification Vertices
            rules.push(new OpenLayers.Rule({

                symbolizer: OpenLayers.Feature.Vector.style['default'],
                evaluate: function (feature) {
                    return !feature.attributes.geomType;
                }
            }));

            return {
                rules: rules
            }
        },

        createToolset: function () {
            var schema = this;
            var widget = schema.widget;
            var toolset = [];
            _.each(widget.getBasicSchemes(), function (scheme) {
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

        createFormItemsCollection: function(formItems) {
            //Do Nothing - All Scheme does not administer formItemsCollection
        },

        updateConfigurationAfterSwitching: function(updatedSchemes) {
            var schema = this;
            var widget = schema.widget;
            _.each(widget.getBasicSchemes(), function (scheme,schemaName) {
                scheme.createFormItemsCollection(updatedSchemes[schemaName].formItems); // Update formItems Of All Schemes when switiching
            });
        },


        initTableFields: function() {
            var schemes = this.widget.schemes;
            this.tableFields = schemes[Object.keys(schemes)[1]].tableFields; // TODO only valid solution is yaml Configuration of allScheme

        },


        getSchemaByFeature: function (feature) {
            var schema = this;
            var widget = schema.widget;

            return widget.getSchemaByGeomType(feature.attributes.geomType);
        }
    };


    Object.setPrototypeOf(AllScheme.prototype, Scheme.prototype);

})();
