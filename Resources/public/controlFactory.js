(function () {
    "use strict";




    Mapbender.Digitizer.DigitizingControlFactory = function (schema, controlEvents) {
        this.schema = schema;
        this.layer = schema.layer;
        this.controlEvents = controlEvents;
    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {
        _featureAdded: function (feature) {
                var control = this;
                var controlFactory = control.controlFactory;

                $.each(this.schema.tableFields, function (fieldName) {
                    feature.attributes[fieldName] = '';
                });

                feature.attributes.schemaName = control.schemaName;
                feature.isNew = true;
                controlFactory.schema.widget.onFeatureAdded(controlFactory.schema, feature);
                controlFactory.schema.setModifiedState(feature, true);
                control.deactivate();

        },

        _finalizeDrawFeatureWithValidityTest: function (cancel) {
            if (this.polygon) {
                var wkt = this.polygon.geometry.toString();
                var reader = new jsts.io.WKTReader();
                try {
                    var geom = reader.read(wkt);

                    if (!geom.isValid()) {
                        $.notify("Geometry not valid");
                        this.destroyFeature(cancel);
                        this.control.deactivate();
                        return;
                    }
                } catch (e) {
                    console.warn("error in validation of geometry", e);
                } //In case of Error thrown in read, because there is no complete linear ring in the geometry
            }

            return OpenLayers.Handler.Polygon.prototype.finalize.apply(this, arguments);
        },

        drawPoint: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Point, {
                controlFactory: controlFactory,
                featureAdded: controlFactory._featureAdded,
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            });
        },


        drawLine: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Path, {
                controlFactory: controlFactory,
                featureAdded: controlFactory._featureAdded,
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },


        drawPolygon: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.Polygon, {
                controlFactory: controlFactory,
                featureAdded: controlFactory._featureAdded,
                handlerOptions: {
                    finalize: controlFactory._finalizeDrawFeatureWithValidityTest
                },
                eventListeners: controlFactory.controlEvents,
                schemaName: schemaName
            })
        },


        drawRectangle: function (schemaName) {
            var controlFactory = this;
            return new OpenLayers.Control.DrawFeature(controlFactory.layer, OpenLayers.Handler.RegularPolygon, {
                controlFactory: controlFactory,
                featureAdded: controlFactory._featureAdded,
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
                controlFactory: controlFactory,
                featureAdded: controlFactory._featureAdded,
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
                controlFactory: controlFactory,
                featureAdded: controlFactory._featureAdded,
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
                controlFactory: controlFactory,

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
                    finalizeInteriorRing: function (event) {
                        var fir = OpenLayers.Handler.Polygon.prototype.finalizeInteriorRing.apply(this, arguments);
                        controlFactory.schema.widget.onFeatureModified(controlFactory.schema, this.polygon, {control: this.control});
                        return fir;
                    }
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
            var schema = this.schema;
            return new OpenLayers.Control.ModifyFeature(controlFactory.layer, {
                controlFactory: controlFactory,

                eventListeners: controlFactory.controlEvents,

                onModificationStart: function (feature) {
                    if (!schema.getSchemaByFeature(feature).allowEditData) {
                        this.deactivate();
                        this.activate();
                        $.notify(Mapbender.trans('mb.digitizer.move.denied'));
                    } else {
                        if (!feature.oldGeometry) {
                            feature.oldGeometry = feature.geometry.clone();
                        }
                    }
                },

                onModification: function (feature) {

                    var wkt = feature.geometry.toString();
                    var reader = new jsts.io.WKTReader();
                    var geom = reader.read(wkt);
                    if (geom.isValid()) {
                        controlFactory.schema.widget.onFeatureModified(controlFactory.schema, feature, {control: this});
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
            var schema = this.schema;
            return new OpenLayers.Control.DragFeature(controlFactory.layer, {
                controlFactory: controlFactory,

                eventListeners: controlFactory.controlEvents,

                onStart: function (feature, px) {
                    if (!schema.getSchemaByFeature(feature).allowEditData) {
                        this.cancel();
                        $.notify(Mapbender.trans('mb.digitizer.move.denied'));
                    } else {
                        if (!feature.oldGeometry) {
                            feature.oldGeometry = feature.geometry.clone();
                        }
                    }
                },

                onComplete: function (feature) {
                    controlFactory.schema.widget.onFeatureModified(controlFactory.schema, feature, {control: this});
                }
            })
        }


    }

})();
