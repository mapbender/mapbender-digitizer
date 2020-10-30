(function () {
    "use strict";

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
            var interaction = new ol.interaction.DrawDonut({
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
