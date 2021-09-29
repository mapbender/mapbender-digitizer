(function () {
    "use strict";

    window.Mapbender = window.Mapbender || {};
    Mapbender.Digitizer = Mapbender.Digitizer || {};

    var ControlPatchCommon = {
        setActive: function(state) {
            if (state) {
                this.activate();
            } else {
                this.deactivate();
            }
        },
        getActive: function() {
            return this.active;
        }
    };

    function Ol2DrawControlEx() {
        OpenLayers.Control.DrawFeature.apply(this, arguments);
    }
    Ol2DrawControlEx.prototype = Object.create(OpenLayers.Control.DrawFeature.prototype);
    Ol2DrawControlEx.prototype.constructor = Ol2DrawControlEx;
    Object.assign(Ol2DrawControlEx.prototype, ControlPatchCommon);

    Mapbender.Digitizer.DigitizingControlFactory = function() {
    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {
        createDrawingTool: function(olMap, layer, type, onDrawEnd) {
            var control = this[type](layer);
            control.deactivate();
            olMap.addControl(control);
            control.events.register('featureadded', null, function(data) {
                onDrawEnd(data.feature);
            });

            return control;
        },
        createModifyTool: function(olMap, layer) {
            var control = new OpenLayers.Control.ModifyFeature(layer, {
                standalone: true
            });
            control.deactivate();
            // Moneky-patch setActive / getActive methods
            Object.assign(control, ControlPatchCommon);
            var modifiedHandler = function(e) {
                if (e.modified || typeof (e.modified) === 'undefined') {
                    e.feature.set('dirty', true);
                }
            };
            layer.events.register('afterfeaturemodified', modifiedHandler);
            layer.events.register('featuremodified', modifiedHandler);
        },
        setEditFeature: function(feature) {
            console.warn("FIXME: No implementation for setEditFeature");
        },

        drawPoint: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.Point);
        },


        drawLine: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.Path);
        },


        drawPolygon: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.Polygon);
        },


        drawRectangle: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 4,
                    irregular: true
                }
            })
        },

        drawCircle: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40
                }
            })
        },

        drawEllipse: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40,
                    irregular: true
                }
            })
        },

        drawDonut: function (layer) {
            return new Ol2DrawControlEx(layer, OpenLayers.Handler.Polygon, {
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
