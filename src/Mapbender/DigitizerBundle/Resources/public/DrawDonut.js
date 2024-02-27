;(function() {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};
    window.Mapbender.Digitizer.Interactions = Mapbender.Digitizer.Interactions || {};

    class DrawDonut extends ol.interaction.Draw {
        constructor(options) {
            super(options);
            this.originalFeature_ = null;
        }

        startDrawing_() {
            super.startDrawing_(...arguments);
            const map = this.getMap();
            const coordinate = this.sketchFeature_.getGeometry().getFirstCoordinate();

            this.originalFeature_ = map.forEachFeatureAtPixel(map.getPixelFromCoordinate(coordinate), (feature) => {
                if (feature.getGeometry().getType() === 'Polygon') {
                    return feature;
                }
            });

            if (!this.originalFeature_) {
                this.abortDrawing_();
            } else {
                this.dispatchEvent({type: 'modifystart', features: new ol.Collection([this.originalFeature_])});
            }
        }

        finishDrawing() {
            const sketchFeature = this.abortDrawing_();
            let coordinates = this.sketchCoords_;
            const geometry = sketchFeature.getGeometry();

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
                const ringCoordinates = sketchFeature.getGeometry().getCoordinates()[0];
                this.originalFeature_.getGeometry().appendLinearRing(new ol.geom.LinearRing(ringCoordinates));
                this.dispatchEvent({type: 'modifyend', features: new ol.Collection([this.originalFeature_])});
            }
        }
    }

    window.Mapbender.Digitizer.Interactions.DrawDonut = DrawDonut;
}());
