(function () {
    "use strict";

    var createFeatureAddedMethod = function (injectedMethods) { // injectedMethods is actually not much more than a restricted Version of Scheme

        var func = function (feature) {
            var control = this;


        //    injectedMethods.layer.getSource().addFeature(feature);

            // _.each(injectedMethods.getDefaultAttributes(), function (prop) {
            //     feature.getProperties()[prop] = "";
            // });

            // feature.setProperties({ schemaName: control.get('schemaName') });
            //
            // feature.isNew = true;
            // injectedMethods.introduceFeature(feature);
            //
            //
            // injectedMethods.setModifiedState(feature, this);
            //
            // injectedMethods.openFeatureEditDialog(feature,'add');
            //
            // control.setActive(false);

        };

        return func;

    };

    var finalizeDrawFeatureWithValidityTest = function (feature) {
        if (feature) {
            var wkt = feature.getGeometry().toString();
            var reader = new jsts.io.WKTReader();
            try {
                var geom = reader.read(wkt);

                if (!geom.isValid()) {
                    $.notify("Geometry not valid");
                    this.destroyActiveComponent(cancel);
                    this.control.setActive(false);
                    // TODO do something to prevent finalization
                }
            } catch (e) {
                console.warn("error in validation of geometry", e);
            } //In case of Error thrown in read, because there is no complete linear ring in the geometry
        }
    };


    Mapbender.Digitizer.DigitizingControlFactory = function (layer, injectedMethods) {

        this.layer = layer;
        this.injectedMethods = injectedMethods;

    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {

        drawPoint: function (schemaName) {
            var controlFactory = this;
            return new ol.interaction.Draw(controlFactory.layer, 'Point', {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                schemaName: schemaName
            });
        },


        drawLine: function (schemaName) {
            var controlFactory = this;
            return new ol.interaction.Draw(controlFactory.layer,'LineString', {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                schemaName: schemaName
            })
        },


        drawPolygon: function (schemaName) {
            var controlFactory = this;
            var drawPolygon =  new ol.interaction.Draw({
                source: controlFactory.layer.getSource(),
                type: 'Polygon',
            });
            //
            // var method = createFeatureAddedMethod(controlFactory.injectedMethods).bind(drawPolygon);
            //
            //
            // drawPolygon.set('schemaName',schemaName);

            drawPolygon.on(ol.interaction.DrawEventType.DRAWEND,function(event) {
                controlFactory.injectedMethods.removeInteraction(drawPolygon);
                drawPolygon.setActive(false);
                event.feature.changed();
                event.feature.set("isNew",true);

            });


            // controlFactory.layer.getSource().on('addfeature',function(event){
            //     console.trace();
            //     console.log(event,event.target);
            //     if (event.target === drawPolygon) {
            //         console.log("$$$$$$");
            //
            //     }
            // });
            return drawPolygon;

            // {
            //     featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
            //         handlerOptions: {
            //     finalize: finalizeDrawFeatureWithValidityTest,
            //
            //         destroyActiveComponent: function (cancel) {
            //         this.destroyFeature(cancel);
            //     }
            // },
            //         schemaName: schemaName
            // })
        },


        drawRectangle: function (schemaName) {
            var controlFactory = this;
            return new ol.interaction.Draw(controlFactory.layer, 'Rectangle', {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    sides: 4,
                    irregular: true
                },
                schemaName: schemaName
            })
        },

        drawCircle: function (schemaName) {
            var controlFactory = this;
            return new ol.interaction.Draw(controlFactory.layer, 'Circle', {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    sides: 40
                },
                schemaName: schemaName
            })
        },

        drawEllipse: function (schemaName) {
            var controlFactory = this;
            return new ol.interaction.Draw(controlFactory.layer, 'Ellipse', {
                featureAdded: createFeatureAddedMethod(controlFactory.injectedMethods),
                handlerOptions: {
                    sides: 40,
                    irregular: true
                },
                schemaName: schemaName
            })
        },

        drawDonut: function () {
            var controlFactory = this;
            return new ol.interaction.Draw(controlFactory.layer,'Donut', {


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
                                if ((candidate instanceof ol.Geometry.Polygon ||
                                    candidate instanceof ol.Geometry.MultiPolygon) &&
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
                        ol.Handler.Path.prototype.addPoint.apply(this, arguments);
                    },
                    finalize: finalizeDrawFeatureWithValidityTest,
                    destroyActiveComponent: function (cancel) {
                        this.polygon.geometry.removeComponent(this.line.geometry);
                    },
                    finalizeInteriorRing: function (event) {

                        var fir = ol.Handler.Polygon.prototype.finalizeInteriorRing.apply(this, arguments);
                        var feature = this.polygon;
                        controlFactory.injectedMethods.setModifiedState(feature, this.control);
                        controlFactory.injectedMethods.openFeatureEditDialog(feature,'donut');
                        return fir;
                    },
                },

                activate: function () {
                    this.layer.map.controls.forEach(function (control) {
                        if (control.dragPan) {
                            control.dragPan.setActive(false);
                        }
                    });
                    ol.interaction.Draw.prototype.activate.apply(this, arguments);
                },

                setActive: function (active) {
                    if (!active) {
                        this.layer.map.controls.forEach(function (control) {
                            if (control.dragPan) {
                                control.dragPan.setActive(true);
                            }
                        });
                    }
                    ol.interaction.Draw.prototype.setActive.apply(this, arguments);
                },


            })
        },

        modifyFeature: function () {
            var controlFactory = this;
            return new ol.interaction.Modify(/*controlFactory.layer,*/ {

                source: controlFactory.layer.getSource(),

                onModificationStart: function (feature) {

                    feature.oldGeometry = feature.geometry.clone();

                    if (controlFactory.injectedMethods.preventModification(feature)) {
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
            return new ol.interaction.DragPan(controlFactory.layer, {

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
                    controlFactory.injectedMethods.updateAfterMove(feature);


                }
            })
        }


    }

})();
