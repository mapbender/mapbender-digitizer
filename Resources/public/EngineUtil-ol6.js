;!(function () {
    "use strict";

    var wktFormat_;
    function getWktFormat_() {
        wktFormat_ = wktFormat_ || new ol.format.WKT();
        return wktFormat_;
    }


    window.Mapbender = window.Mapbender || {};
    Mapbender.Digitizer = Mapbender.Digitizer || {};
    Mapbender.Digitizer.EngineUtil = {
        dumpWkt: function(geometry) {
            return getWktFormat_().writeGeometryText(geometry);
        },
        dumpFeatureWkt: function(feature) {
            return getWktFormat_().writeGeometryText(feature.getGeometry());
        },
        featureFromWkt: function(wkt) {
            return getWktFormat_().readFeatureFromText(wkt);
        },
        geometryFromWkt: function(wkt) {
            return getWktFormat_().readGeometryFromText(wkt);
        },
        onLayerFeatureAdded: function(layer, callback, syncExisting) {
            layer.getSource().on('addfeature', function(event) {
                callback(event.feature);
            });
            if (syncExisting) {
                layer.getSource().getFeatures().forEach(callback);
            }
        },
        onLayerFeatureRemoved: function(layer, callback) {
            layer.getSource().on('removefeature', function(event) {
                callback(event.feature);
            });
        },
        patchFeature: function() { /** noop */ },
        __dummy__: null
    };
})();
