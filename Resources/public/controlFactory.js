(function () {
    "use strict";

    var createFeatureAddedMethod = function (injectedMethods) { // injectedMethods is actually not much more than a restricted Version of Scheme

        var func = function (feature) {
            var control = this;

            _.each(injectedMethods.getDefaultAttributes(), function (prop) {
                feature.attributes[prop] = "";
            });

            feature.attributes.schemaName = control.schemaName;

            feature.isNew = true;
            injectedMethods.introduceFeature(feature);


            injectedMethods.setModifiedState(feature, this);

            injectedMethods.openFeatureEditDialog(feature,'add');
            feature.layer.drawFeature(feature);

            control.deactivate();
        };

        return func;

    };

    var finalizeDrawFeatureWithValidityTest = function (cancel) {
        if (this.polygon) {
            var wkt = this.polygon.geometry.toString();
            var reader = new jsts.io.WKTReader();
            try {
                var geom = reader.read(wkt);

                if (!geom.isValid()) {
                    $.notify("Geometry not valid");
                    this.destroyActiveComponent(cancel);
                    this.control.deactivate();
                    return;
                }
            } catch (e) {
                console.warn("error in validation of geometry", e);
            } //In case of Error thrown in read, because there is no complete linear ring in the geometry
        }

        return OpenLayers.Handler.Polygon.prototype.finalize.apply(this, arguments);
    };


    Mapbender.Digitizer.DigitizingControlFactory = function (layer, injectedMethods, controlEvents) {

        this.layer = layer;
        this.injectedMethods = injectedMethods;
        this.controlEvents = controlEvents;

    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {

        drawPoint: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Point, {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            });
        },


        drawLine: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Path, {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },


        drawPolygon: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Polygon, {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    finalize: finalizeDrawFeatureWithValidityTest,

                    destroyActiveComponent: function (cancel) {
                        this.destroyFeature(cancel);
                    }
                },
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },


        drawRectangle: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.RegularPolygon, {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    sides: 4,
                    irregular: true
                },
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },

        drawCircle: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.RegularPolygon, {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    sides: 40
                },
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },

        drawEllipse: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.RegularPolygon, {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    sides: 40,
                    irregular: true
                },
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },

        drawDonut: function () {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Polygon, {

                eventListeners: controlFactory.controlEvents,

                featureAdded: function () {
                    console.warn("donut should not be created")
                },

                handlerOptions: {
                    holeModifier: 'element',
                    // Allow control only to draw holes in polygon, not to draw polygons themselves.
                    // Outsource old geometry
                    addPoint: function (pixel) {
                        if (!this.drawingHole && this.evt && this.evt[this.holeModifier]) {
                            var geometry = this.point.geometry;
                            var features = this.control.layer.features;
                            var candidate, polygon;
                            // look for intersections, last drawn gets priority
                            for (var i = features.length - 1; i >= 0; --i) {
                                candidate = features[i].geometry;
                                if ((candidate instanceof OpenLayers.Geometry.Polygon ||
                                    candidate instanceof OpenLayers.Geometry.MultiPolygon) &&
                                    candidate.intersects(geometry)) {
                                    polygon = features[i];
                                    this.control.layer.removeFeatures([polygon], {silent: true});
                                    this.control.layer.events.registerPriority(
                                        "sketchcomplete", this, this.finalizeInteriorRing
                                    );
                                    this.control.layer.events.registerPriority(
                                        "sketchmodified", this, this.enforceTopology
                                    );
                                    this.polygon = polygon;
                                    this.polygon.oldGeometry = this.polygon.geometry.clone();
                                    polygon.geometry.addComponent(this.line.geometry);

                                    this.drawingHole = true;
                                    break;
                                }
                            }
                        }
                        if (!this.drawingHole) {
                            return;
                        }
                        OpenLayers.Handler.Path.prototype.addPoint.apply(this, arguments);
                    },
                    finalize: finalizeDrawFeatureWithValidityTest,
                    destroyActiveComponent: function (cancel) {
                        this.polygon.geometry.removeComponent(this.line.geometry);
                    },
                    finalizeInteriorRing: function (event) {

                        var fir = OpenLayers.Handler.Polygon.prototype.finalizeInteriorRing.apply(this, arguments);
                        var feature = this.polygon;
                        controlFactory.injectedMethods.setModifiedState(feature, this.control);
                        controlFactory.injectedMethods.openFeatureEditDialog(feature,'donut');
                        return fir;
                    },
                },

                activate: function () {
                    this.layer.map.controls.forEach(function (control) {
                        if (control.dragPan) {
                            control.dragPan.deactivate();
                        }
                    });
                    OpenLayers.Control.DrawFeature.prototype.activate.apply(this, arguments);
                },

                deactivate: function () {
                    this.layer.map.controls.forEach(function (control) {
                        if (control.dragPan) {
                            control.dragPan.activate();
                        }
                    });
                    OpenLayers.Control.DrawFeature.prototype.deactivate.apply(this, arguments);
                },


            })
        },

        modifyFeature: function () {
            var controlFactory = this;
            return new OpenLayers.Control.ModifyFeature(controlFactory.layer, {

                eventListeners: controlFactory.controlEvents,

                onModificationStart: function (feature) {

                    feature.oldGeometry = feature.geometry.clone();

                    if (controlFactory.injectedMethods.preventModification(feature)) {
                        this.deactivate();
                        this.activate();
                        $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                    }


                },

                onModification: function (feature) {

                    var wkt = feature.geometry.toString();
                    var reader = new jsts.io.WKTReader();
                    var geom = reader.read(wkt);
                    if (geom.isValid()) {
                        controlFactory.injectedMethods.setModifiedState(feature, this);
                        controlFactory.injectedMethods.openFeatureEditDialog(feature,'modify');
                    } else {
                        // TODO there might be a better way to revert feature
                        controlFactory.layer.removeFeatures([feature]);
                        feature.geometry = feature.modified.geometry;
                        feature.modified = false;
                        controlFactory.layer.addFeatures([feature]);
                        // deactivation is necessary because the vertice features dont move back
                        this.deactivate();
                    }

                },

            })
        },

        moveFeature: function () {
            var controlFactory = this;
            return new OpenLayers.Control.DragFeature(controlFactory.layer, {

                eventListeners: controlFactory.controlEvents,

                onStart: function (feature, px) {

                    feature.oldGeometry = feature.geometry.clone();

                    if (controlFactory.injectedMethods.preventMove(feature)) {
                        this.cancel();
                        $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                    }

                },

                onComplete: function (feature) {
                    controlFactory.injectedMethods.setModifiedState(feature, this);
                    controlFactory.injectedMethods.openFeatureEditDialog(feature,'move');


                }
            })
        }


    }

})();
