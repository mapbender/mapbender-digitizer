;!(function () {
    "use strict";

    var wktFormat_;
    function getWktFormat_() {
        wktFormat_ = wktFormat_ || new OpenLayers.Format.WKT();
        return wktFormat_;
    }


    window.Mapbender = window.Mapbender || {};
    Mapbender.Digitizer = Mapbender.Digitizer || {};
    Mapbender.Digitizer.EngineUtil = {
        dumpWkt: function(geometry) {
            // OpenLayer.Format.WKT.write needs a feature
            var dummyFeature = new OpenLayers.Feature.Vector(geometry);
            return this.dumpFeatureWkt(dummyFeature);
        },
        dumpFeatureWkt: function(feature) {
            return getWktFormat_().write(feature);
        },
        featureFromWkt: function(wkt) {
            return new OpenLayers.Feature.Vector(this.geometryFromWKT(wkt));
        },
        geometryFromWkt: function(wkt) {
            return OpenLayers.Geometry.fromWKT(wkt);
        },
        onLayerFeatureAdded: function(layer, callback, syncExisting) {
            layer.events.register('featureadded', null, function(data) {
                callback(data.feature);
            });
            if (syncExisting) {
                layer.features.forEach(callback);
            }
        },
        onLayerFeatureRemoved: function(layer, callback) {
            layer.events.register('featureremoved', null, function(data) {
                callback(data.feature);
            });
        },
        __dummy__: null
    };
})();
