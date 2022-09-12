;!(function() {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};
    window.Mapbender.Digitizer.Interactions = Mapbender.Digitizer.Interactions || {};

    function DrawDonut(options) {
        this.originalFeature_ = null;
        ol.interaction.Draw.apply(this, [options]);
    }
    DrawDonut.prototype = Object.create(ol.interaction.Draw.prototype);
    Object.assign(DrawDonut.prototype, {
        constructor: DrawDonut,
        startDrawing_: function() {
            ol.interaction.Draw.prototype.startDrawing_.apply(this, arguments);
            var map = this.getMap();
            var coordinate = this.sketchFeature_.getGeometry().getFirstCoordinate();

            this.originalFeature_ = map.forEachFeatureAtPixel(map.getPixelFromCoordinate(coordinate), function (feature) {
                if (feature.getGeometry().getType() === 'Polygon') {
                    return feature;
                }
            });

            if (!this.originalFeature_) {
                this.abortDrawing_();
            } else {
                this.dispatchEvent({type: 'modifystart', features: new ol.Collection([this.originalFeature_])});
            }
        },
        finishDrawing: function() {
            var sketchFeature = this.abortDrawing_();
            var coordinates = this.sketchCoords_;
            var geometry = /** @type {ol.geom.SimpleGeometry} */ (sketchFeature.getGeometry());
            if (this.mode_ === ol.interaction.Draw.Mode_.LINE_STRING) {
                // remove the redundant last point
                coordinates.pop();
                this.geometryFunction_(coordinates, geometry);
            } else if (this.mode_ === ol.interaction.Draw.Mode_.POLYGON) {
                // remove the redundant last point in ring
                coordinates[0].pop();
                this.geometryFunction_(coordinates, geometry);
                coordinates = geometry.getCoordinates();
            }

            // cast multi-part geometries
            if (this.type_ === ol.geom.GeometryType.MULTI_POINT) {
                sketchFeature.setGeometry(new ol.geom.MultiPoint([coordinates]));
            } else if (this.type_ === ol.geom.GeometryType.MULTI_LINE_STRING) {
                sketchFeature.setGeometry(new ol.geom.MultiLineString([coordinates]));
            } else if (this.type_ === ol.geom.GeometryType.MULTI_POLYGON) {
                sketchFeature.setGeometry(new ol.geom.MultiPolygon([coordinates]));
            }
            if (this.originalFeature_) {
                var ringCoordinates = sketchFeature.getGeometry().getCoordinates()[0];
                this.originalFeature_.getGeometry().appendLinearRing(new ol.geom.LinearRing(ringCoordinates));
                this.dispatchEvent({type: 'modifyend', features: new ol.Collection([this.originalFeature_])});
            }
        }
    });

    window.Mapbender.Digitizer.Interactions.DrawDonut = DrawDonut;
}());
