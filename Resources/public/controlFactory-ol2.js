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

    function MultiLayerFeatureHandler(layerFilter, control) {
        this.layerFilter_ = layerFilter;
        OpenLayers.Handler.prototype.initialize.apply(this, [control, control.callbacks, {
            geometryTypes: null
        }]);
    }
    MultiLayerFeatureHandler.prototype = Object.create(OpenLayers.Handler.Feature.prototype);
    MultiLayerFeatureHandler.prototype.constructor = MultiLayerFeatureHandler;

    Object.assign(MultiLayerFeatureHandler.prototype, {
        // Skip bound layer mangling / map event binding / unbinding
        activate: OpenLayers.Handler.prototype.activate,
        deactivate: OpenLayers.Handler.prototype.deactivate,
        handle: function(evt) {
            if (evt.type === 'click' && (!this.callbacks['click'] || !this.callbacks['clickout'])) {
                // Fix hover control eating clicks from separate click-handling select control
                // (OL2 base does not support pure hover controls that never handle clicks)
                return false;
            }
            // Grab layer
            var layers = this.map && this.map.layers.filter(this.layerFilter_);
            if (layers && layers.length) {
                this.layer = layers[0];
                var rv = OpenLayers.Handler.Feature.prototype.handle.apply(this, arguments);
                this.layer = null;
                return rv;
            } else {
                return false;
            }
        }
    });



    function Ol2DrawControlEx() {
        OpenLayers.Control.DrawFeature.apply(this, arguments);
    }
    Ol2DrawControlEx.prototype = Object.create(OpenLayers.Control.DrawFeature.prototype);
    Ol2DrawControlEx.prototype.constructor = Ol2DrawControlEx;
    Object.assign(Ol2DrawControlEx.prototype, ControlPatchCommon);

    Mapbender.Digitizer.DigitizingControlFactory = function() {
        this.modifyControlMap_ = {};
        this.editingList_ = [];
    };

    Mapbender.Digitizer.DigitizingControlFactory.prototype = {
        modifyControlMap_: null,
        editingList_: null,
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
            layer.events.register('afterfeaturemodified', null, modifiedHandler);
            layer.events.register('featuremodified', null, modifiedHandler);
            olMap.addControl(control);
            this.registerModify_(layer, control);
            return control;
        },
        setEditFeature: function(feature) {
            for (var i = 0; i < this.editingList_.length; ++i) {
                var previousFeature = this.editingList_[i];
                previousFeature.set('editing', false);
                var control = previousFeature.layer && this.findModifyControl_(previousFeature.layer);
                // Previous feature may have already been unselected by clickout / toggle
                // Second unselect invocation throws an error => avoid it
                if (control && previousFeature === control.feature) {
                    control.unselectFeature(previousFeature);
                }
            }
            this.editingList_.splice(0, -1);
            if (feature) {
                feature.set('editing', true);
                this.editingList_.push(feature);
                this.findModifyControl_(feature.layer).selectFeature(feature);
            }
        },
        registerModify_: function(layer, control) {
            this.modifyControlMap_[layer.id] = control;
        },
        findModifyControl_: function(layer) {
            return this.modifyControlMap_[layer.id];
        },
        createExclusiveHighlightControl: function(olMap, excludeList, layerFilter) {
            /** @see https://github.com/openlayers/ol2/blob/master/lib/OpenLayers/Control/SelectFeature.js */
            var control = new OpenLayers.Control.SelectFeature(null, {
                hover: true,
                highlightOnly: true,
                highlight: function(feature) {
                    if (typeof (feature.set) !== 'function') {
                        // temporary editing feature, leave it alone
                        return false;
                    }
                    if (feature.layer && layerFilter(feature.layer) && -1 === excludeList.indexOf(feature)) {
                        feature.set('hover', true);
                    }
                },
                outFeature: function(feature) {
                    if (typeof (feature.set) !== 'function') {
                        // temporary editing feature, leave it alone
                        return false;
                    }
                    feature.set('hover', false);
                }
            });
            Object.assign(control, ControlPatchCommon);
            // This control never handles clicks
            delete(control.callbacks['click']);
            delete(control.callbacks['clickout']);

            control.handlers.feature = new MultiLayerFeatureHandler(layerFilter, control);
            olMap.addControl(control);
            return control;
        },
        createSingleSelectControl: function(olMap, layerFilter, clickHandler) {
            /** @see https://github.com/openlayers/ol2/blob/master/lib/OpenLayers/Control/SelectFeature.js */
            var control = new OpenLayers.Control.SelectFeature(null, {
                clickout: false,
                clickFeature: clickHandler
            });
            Object.assign(control, ControlPatchCommon);
            /** @see https://github.com/openlayers/ol2/blob/master/lib/OpenLayers/Control/SelectFeature.js#L200 */
            control.handlers.feature = new MultiLayerFeatureHandler(layerFilter, control);
            control.getFeatures = function() {
                return {
                    clear: function() {
                    }
                };
            };
            olMap.addControl(control);
            return control;
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
        createTranslationTool: function(olMap, layer) {
            var control = new OpenLayers.Control.DragFeature(layer, {
                onComplete: function (feature) {
                    feature.set('dirty', true);
                }
            });
            // Moneky-patch setActive / getActive methods
            Object.assign(control, ControlPatchCommon);
            olMap.addControl(control);
            return control;
        }
    }

})();
