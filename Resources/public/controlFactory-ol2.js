(function () {
    "use strict";

    window.Mapbender = window.Mapbender || {};
    Mapbender.Digitizer = Mapbender.Digitizer || {};


    Mapbender.Digitizer.DigitizingControlFactory = function() {
    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {
        _featureAdded: function (feature) { // injectedMethods is actually not much more than a restricted Version of Scheme
            // @todo: bridge events
            // console.log("Feature added", this, arguments);
        },

        drawPoint: function () {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point, {
                featureAdded: this._featureAdded
            });
        },


        drawLine: function (layer) {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path, {
                featureAdded: this._featureAdded
            })
        },


        drawPolygon: function (layer) {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
                featureAdded: this._featureAdded
            })
        },


        drawRectangle: function (layer) {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                featureAdded: this._featureAdded,
                handlerOptions: {
                    sides: 4,
                    irregular: true
                }
            })
        },

        drawCircle: function (layer) {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                featureAdded: this._featureAdded,
                handlerOptions: {
                    sides: 40
                }
            })
        },

        drawEllipse: function (layer) {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                featureAdded: this._featureAdded,
                handlerOptions: {
                    sides: 40,
                    irregular: true
                }
            })
        },

        drawDonut: function (layer) {
            return new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
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
                    destroyActiveComponent: function (cancel) {
                        this.polygon.geometry.removeComponent(this.line.geometry);
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
                }

            })
        },

        modifyFeature: function (layer) {
            var controlFactory = this;
            return new OpenLayers.Control.ModifyFeature(layer, {
                onModificationStart: function (feature) {
                    feature.oldGeometry = feature.geometry.clone();
                },
                onModification: function (feature) {
                    var wkt = feature.geometry.toString();
                    var reader = new jsts.io.WKTReader();
                    var geom = reader.read(wkt);
                    if (geom.isValid()) {
                        controlFactory.injectedMethods.setModifiedState(feature, this);
                        controlFactory.injectedMethods.onFeatureChange(feature,'modify');
                    } else {
                        // TODO there might be a better way to revert feature
                        controlFactory.layer.removeFeatures([feature]);
                        feature.geometry = feature.modified.geometry;
                        feature.modified = false;
                        controlFactory.layer.addFeatures([feature]);
                        // deactivation is necessary because the vertice features dont move back
                        this.deactivate();
                    }

                }
            })
        },

        moveFeature: function (layer) {
            return new OpenLayers.Control.DragFeature(layer, {
                onComplete: function (feature) {
                    // @todo: bridge events
                    // console.log("moveFeature.onComplete", this, arguments);
                }
            })
        }
    }

})();
