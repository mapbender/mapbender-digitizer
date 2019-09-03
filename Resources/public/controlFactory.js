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
            var controlFactory = this;

            interaction.on(ol.interaction.DrawEventType.DRAWEND,function(event) {
                var feature = event.feature;
                source.dispatchEvent({ type: 'controlFactory.FeatureAdded', feature: feature});

            });
        },

        createActivator_: function(interaction) {

            return function(active) {
                var setActive = ol.interaction.Interaction.prototype.setActive;
                setActive.apply(this,arguments);
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
                source.dispatchEvent({ type: 'controlFactory.FeatureModified', feature: event.feature});
            });

            return interaction;
        },

        modifyFeature: function (source,defaultStyle) {
            var controlFactory = this;

            var verticesStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 3,
                    fill: new ol.style.Fill({
                        color: "#ffcc33"
                    })
                })
            });

            var edgesStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 3,
                    stroke: new ol.style.Stroke({
                        color: "#ffcc33",
                        width: 4
                    })
                })
            });

            var vertices;
            var edges;


            var Modify = {
                init: function() {

                    this.select = new ol.interaction.Select({
                        style: function(feature) {
                            var styles = [defaultStyle];
                            if (feature.getGeometry().getType() == "Polygon") {
                                var coords = feature.getGeometry().getCoordinates()[0];
                                vertices = new ol.geom.MultiPoint(coords.slice(0, -1));
                                verticesStyle.setGeometry(vertices);
                                styles.push(verticesStyle);
                                var line = new ol.geom.LineString(coords);
                                var midpoints = [];
                                line.forEachSegment(function(start, end) {
                                    midpoints.push([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]);
                                });
                                edges = new ol.geom.MultiPoint(midpoints);
                                edgesStyle.setGeometry(edges);
                                styles.push(edgesStyle);
                            } else {
                                vertices = undefined;
                                edges = undefined;
                            }
                            return styles;
                        }
                    });
                    controlFactory.map.addInteraction(this.select);

                    this.select.on('select',function(event) {
                        var features = event.selected;

                        features.forEach(function(feature){
                            feature.setStyle(null);
                        });
                    });
                    var selectedFeatures = this.select.getFeatures();


                    this.modify = new ol.interaction.Modify({
                        condition: function(event) {
                            if (event.type == "pointerdown") {
                                if (edges) {
                                    var point = controlFactory.map.getPixelFromCoordinate(
                                        new ol.geom.GeometryCollection([edges, vertices]).getClosestPoint(
                                            event.coordinate
                                        )
                                    );
                                    var dx = point[0] - event.pixel[0];
                                    var dy = point[1] - event.pixel[1];
                                    var ds = dx * dx + dy * dy;
                                    return ds < 100;
                                } else {
                                    return true;
                                }
                            }
                        },


                        features: selectedFeatures
                    });

                    this.modify.setActive = controlFactory.createActivator_(this.modify);

                    controlFactory.map.addInteraction(this.modify);

                    this.select.on("change:active", function() {
                        selectedFeatures.forEach(function(each) {
                            selectedFeatures.remove(each);
                        });
                    });
                },

                on: function() {
                    return this.modify.on.apply(this.modify,arguments);
                },

                dispatchEvent: function() {
                    return this.modify.dispatchEvent.apply(this.modify,arguments);
                },

                setActive: function(active) {
                    this.select.setActive.apply(this.modify,arguments);
                    return this.modify.setActive.apply(this.modify,arguments);
                },

                getActive: function() {
                    return this.modify.getActive.apply(this.modify,arguments);
                }
            };

            Modify.init();

            return Modify;

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
                    source.dispatchEvent({ type: 'controlFactory.FeatureMoved', feature: feature});
                });

            });

            return interaction;

        }


    }

})();
