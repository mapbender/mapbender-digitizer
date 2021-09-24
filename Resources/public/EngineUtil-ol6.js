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
        }
    };
})();
