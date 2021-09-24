;!(function() {
    "use strict";
    var layerMethodsPatch_ = {
        getMaxResolution: function() {
            return this.maxResolution;
        },
        getMinResolution: function() {
            return this.minResolution;
        }
    };

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
            var layer = new OpenLayers.Layer.Vector({
                visibility: true,
                minResolution: Mapbender.Model.scaleToResolution(schema.maxScale || 0),
                maxResolution: Mapbender.Model.scaleToResolution(schema.minScale || Infinity)
            });
            layer.styleMap.styles.default = new OpenLayers.Style(defaultStyleConfig);
            Object.assign(layer, layerMethodsPatch_);
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
