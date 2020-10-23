(function () {
    "use strict";

    /**
     * @classdesc
     * Factory for Interactions.
     *
     * @constructor
     * @param {ol.Map} map.
     * @api
     */


    Mapbender.Digitizer.DigitizingControlFactory = function (map) {

        this.map = map;

    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {
        drawPoint: function (source) {
            var interaction = new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                type: "Point"
            });
            return interaction;
        },


        drawLine: function (source) {
            var interaction =  new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                type: "LineString"
            });
            return interaction;
        },


        drawPolygon: function (source) {
            var interaction =  new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                type: 'Polygon'
            });
            return interaction;
        },


        drawRectangle: function (source) {
            var interaction = new ol.interaction.Draw({
                source: source,
                stopClick: true,    // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
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
                type: 'Polygon'
            });

            interaction.on(ol.interaction.DrawDonutEventType.DRAWDONUTEND,function(event) {
                event.feature.set('dirty', true);
            });

            return interaction;
        },

        modifyFeature: function (source) {
            var interaction = new ol.interaction.SelectableModify({
            });

            interaction.on(ol.interaction.ModifyEventType.MODIFYEND,function(event) {
                var feature = event.features.item(0);
                feature.set('dirty', true);
            });
            // NOTE: select event is only triggered by custom SelectableModify, not on basic ol.interaction.Modify
            interaction.on('select', function(event) {
                // Style editor interactions...
                event.selected && event.selected.forEach(function (feature) {
                    feature.set("featureStyleDisabled", true);
                });

                event.deselected && event.deselected.forEach(function (feature) {
                    feature.unset("featureStyleDisabled");
                });
            });

            return interaction;

        },

        moveFeature: function (source) {
            var interaction = new ol.interaction.Translate({
                source: source
            });

            interaction.on(ol.interaction.TranslateEventType.TRANSLATEEND,function(event) {
                var features = event.features;
                features.forEach(function(feature) {
                    feature.set('dirty', true);
                });

            });

            return interaction;

        }


    }

})();
