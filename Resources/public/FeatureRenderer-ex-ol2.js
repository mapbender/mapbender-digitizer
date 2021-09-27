;!(function() {
    "use strict";

    var Ol2LayerEx = function() {
        OpenLayers.Layer.Vector.apply(this, arguments);
    };
    Ol2LayerEx.prototype = Object.create(OpenLayers.Layer.Vector.prototype);
    Object.assign(Ol2LayerEx.prototype, {
        constructor: Ol2LayerEx,
        getMaxResolution: function() {
            return this.maxResolution;
        },
        getMinResolution: function() {
            return this.minResolution;
        },
        setVisible: function() {
            this.setVisibility.apply(this, arguments);
        },
        getSource: function() {
            return this;
        },
        getFeatures: function() {
            return this.features;
        }
    });

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        initializeGlobalStyles_: function() {
            return {
                invisible: new OpenLayers.Style({
                    fillOpacity: 0,
                    strokeOpacity: 0,
                    fontOpacity: 0,
                    label: null
                }),
                editing: this.createEditingStyle_()
            };
        },
        createEditingStyle_: function() {
            // @todo: nice editing style?
            return new OpenLayers.Style(OpenLayers.Feature.Vector.style.temporary);
        },
        createSchemaFeatureLayer_: function (schema, defaultStyleConfig) {
            var layer = new Ol2LayerEx({
                visibility: true,
                minResolution: Mapbender.Model.scaleToResolution(schema.maxScale || 0),
                maxResolution: Mapbender.Model.scaleToResolution(schema.minScale || Infinity)
            });
            layer.styleMap.styles.default = new OpenLayers.Style(defaultStyleConfig);
            return layer;
        },
        initializeStyles_: function(styleConfigs) {
            var styles = {};
            var keys = Object.keys(styleConfigs);
            for (var i = 0; i < keys.length; ++ i) {
                var key = keys[i];
                styles[key] = new OpenLayers.Style(Object.assign({}, styleConfigs['default'], styleConfigs[key]));
            }
            return styles;
        },
        __dummy__: null
    });

}());
