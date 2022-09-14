(function () {
    "use strict";

    /**
     * @param options
     * @constructor
     */
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

    /**
     * @classdesc
     * Factory for Interactions.
     *
     * @constructor
     */
    Mapbender.Digitizer.DigitizingControlFactory = function() {
        this.leftClickOnly_ = function(event) {
            if (event.pointerEvent && event.pointerEvent.button !== 0) {
                return false;
            } else {
                return ol.events.condition.noModifierKeys(event);
            }
        }
    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {
        drawPoint: function (source) {
            var interaction = new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                type: "Point",
                condition: this.leftClickOnly_
            });
            return interaction;
        },


        drawLine: function (source) {
            var interaction =  new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                type: "LineString",
                condition: this.leftClickOnly_
            });
            return interaction;
        },


        drawPolygon: function (source) {
            var interaction =  new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                condition: this.leftClickOnly_,
                type: 'Polygon'
            });
            return interaction;
        },


        drawRectangle: function (source) {
            var interaction = new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                condition: this.leftClickOnly_,
                type: 'Circle',
                geometryFunction: ol.interaction.Draw.createBox(),
                freehand: true

            });
            return interaction;
        },

        drawCircle: function (source) {
            var interaction =  new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                condition: this.leftClickOnly_,
                type: 'Circle',
                geometryFunction: function(coordinates, geometry) {
                    // var circle = opt_geometry ? /** @type {ol.geom.Circle} */ (opt_geometry) :
                    //     new ol.geom.Circle([NaN, NaN]);
                    // var squaredLength = ol.coordinate.squaredDistance(
                    //     coordinates[0], coordinates[1]);
                    // circle.setCenterAndRadius(coordinates[0], Math.sqrt(squaredLength));
                    // return ol.geom.Polygon.fromCircle(circle, 64);

                    var center = coordinates[0];
                    var last = coordinates[1];
                    var dx = center[0] - last[0];
                    var radius = Math.sqrt(dx * dx + dx * dx);
                    var circle = new ol.geom.Circle(center, radius);
                    var polygon = ol.geom.Polygon.fromCircle(circle, 64);
                    polygon.scale(dx/radius, dx/radius);
                    if (!geometry) {
                        geometry = polygon;
                    } else {
                        geometry.setCoordinates(polygon.getCoordinates());
                    }
                    return geometry;
                },
                freehand: true
            });

            return interaction;
        },

        drawEllipse: function (source) {
            var interaction =  new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                type: 'Circle',
                condition: this.leftClickOnly_,
                geometryFunction: function(coordinates, geometry) {
                    var center = coordinates[0];
                    var last = coordinates[1];
                    var dx = center[0] - last[0];
                    var dy = center[1] - last[1];
                    var radius = Math.sqrt(dx * dx + dy * dy);
                    var circle = new ol.geom.Circle(center, radius);
                    var polygon = ol.geom.Polygon.fromCircle(circle, 64);
                    polygon.scale(dx/radius, dy/radius);
                    if (!geometry) {
                        geometry = polygon;
                    } else {
                        geometry.setCoordinates(polygon.getCoordinates());
                    }
                    return geometry;
                },
                freehand: true
            });
            return interaction;
        },

        drawDonut: function (source) {
            var interaction = new DrawDonut({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                condition: this.leftClickOnly_,
                type: 'Polygon'
            });

            return interaction;
        },
        moveFeature: function (source) {
            var self = this;
            // ol.interaction.Translate does not have a "condition" option, but it
            // supports completely replacing the handleDownEvent method via Pointer
            // base class.
            // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Pointer.js#L57
            var handleDownEvent = function(event) {
                return self.leftClickOnly_(event) && ol.interaction.Translate.prototype.handleDownEvent.call(this, event);
            };

            var interaction = new ol.interaction.Translate({
                source: source,
                handleDownEvent: handleDownEvent
            });

            return interaction;
        }
    }

})();
