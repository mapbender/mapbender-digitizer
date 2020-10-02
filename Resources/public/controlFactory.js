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


        addDrawEndEventListener_: function(interaction,source) {
            interaction.on(ol.interaction.DrawEventType.DRAWEND,function(event) {
                // @todo: button sync? activeInteraction sync?
                event.target.setActive(false);
                var feature = event.feature;
                feature.set("modificationState", "isNew");
                feature.set('dirty', true);
                source.dispatchEvent({ type: 'controlFactory.FeatureAdded', feature: feature});
            });
        },

        createActivator_: function(interaction) {
            var setActiveOriginal = interaction.setActive;

            return function(active) {
                setActiveOriginal.apply(this, arguments);
                interaction.dispatchEvent({ type: 'controlFactory.Activation', active: active});
            };
        },

        drawPoint: function (source) {
            var controlFactory = this;
            var interaction = new ol.interaction.Draw({
               source: source,
                type: "Point",
            });

            interaction.setActive = controlFactory.createActivator_(interaction);
            controlFactory.addDrawEndEventListener_(interaction,source);

            return interaction;
        },


        drawLine: function (source) {
            var controlFactory = this;
            var interaction =  new ol.interaction.Draw({
                source: source,
                type: "LineString",
            });

            interaction.setActive = controlFactory.createActivator_(interaction);
            controlFactory.addDrawEndEventListener_(interaction,source);

            return interaction;
        },


        drawPolygon: function (source) {
            var controlFactory = this;
            var interaction =  new ol.interaction.Draw({
                source: source,
                type: 'Polygon',
            });

            interaction.setActive = controlFactory.createActivator_(interaction);
            controlFactory.addDrawEndEventListener_(interaction,source);

            return interaction;
        },


        drawRectangle: function (source) {
            var controlFactory = this;
            var interaction = new ol.interaction.Draw({
                source: source,
                type: 'Circle',
                geometryFunction: ol.interaction.Draw.createBox(),
                freehand: true

            });

            interaction.setActive = controlFactory.createActivator_(interaction);
            controlFactory.addDrawEndEventListener_(interaction,source);

            return interaction;
        },

        drawCircle: function (source) {
            var controlFactory = this;
            var interaction =  new ol.interaction.Draw({
                source: source,
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

            interaction.setActive = controlFactory.createActivator_(interaction);
            controlFactory.addDrawEndEventListener_(interaction,source);

            return interaction;
        },

        drawEllipse: function (source) {
            var controlFactory = this;
            var interaction =  new ol.interaction.Draw({
                source: source,
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

            interaction.setActive = controlFactory.createActivator_(interaction);
            controlFactory.addDrawEndEventListener_(interaction,source);

            return interaction;
        },

        drawDonut: function (source) {
            var controlFactory = this;

            var interaction = new ol.interaction.DrawDonut({
                source: source,
                type: 'Polygon',

            });


            interaction.setActive = controlFactory.createActivator_(interaction);


            interaction.on(ol.interaction.DrawDonutEventType.DRAWDONUTEND,function(event) {
                event.feature.set("modificationState", "isChanged");
                event.feature.set('dirty', true);
                source.dispatchEvent({ type: 'controlFactory.FeatureModified', feature: event.feature});
            });

            return interaction;
        },

        modifyFeature: function (source) {
            var controlFactory = this;

            var interaction = new ol.interaction.SelectableModify({
            });
            interaction.setActive = controlFactory.createActivator_(interaction);

            interaction.on(ol.interaction.ModifyEventType.MODIFYEND,function(event) {
                // HACK: access modified feature via private interaction property
                var feature = event.target.vertexFeature_;
                feature.set("modificationState", "isChanged");
                feature.set('dirty', true);
                source.dispatchEvent({
                    type: 'controlFactory.FeatureModified',
                    features: new ol.Collection([feature])
                });
            });

            return interaction;

        },

        moveFeature: function (source) {
            var controlFactory = this;

            var interaction = new ol.interaction.Translate({
                source: source
            });

            interaction.setActive = controlFactory.createActivator_(interaction);
            interaction.on(ol.interaction.TranslateEventType.TRANSLATEEND,function(event) {
                var features = event.features;
                features.forEach(function(feature) {
                    feature.set("modificationState", "isChanged");
                    feature.set('dirty', true);
                });

            });

            return interaction;

        }


    }

})();
