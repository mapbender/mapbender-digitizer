var createFeatureAddedMethod = function(injectedMethods, geomType) {

    var func = function (feature) {
        var control = this;

        _.each(injectedMethods.getDefaultAttributes(), function(prop) {
            feature.attributes[prop] = "";
        });

        feature.attributes.geomType = geomType;


        injectedMethods.setModifiedState(feature,this);

        injectedMethods.openFeatureEditDialog(feature);
        feature.layer.drawFeature(feature);

        control.deactivate();
    };

    return func;

};



var DigitizingControlFactory = function (layer,injectedMethods,controlEvents) {

    var controls =  {

        drawText:  new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point,{
            featureAdded :  createFeatureAddedMethod(injectedMethods, 'label'),
        }),

        drawPoint: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point,{
            featureAdded : createFeatureAddedMethod(injectedMethods, 'point'),
        }),

        drawLine: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path,{
            featureAdded : createFeatureAddedMethod(injectedMethods, 'line'),
        }),

        drawPolygon: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
            featureAdded : createFeatureAddedMethod(injectedMethods, 'polygon'),
            handlerOptions: {
              finalize: function(cancel) {

                  if (this.polygon) {
                      var wkt = this.polygon.geometry.toString();
                      var reader = new jsts.io.WKTReader();
                      var geom = reader.read(wkt);
                      if (!geom.isValid()) {
                          $.notify("Geometry not valid");
                          this.destroyFeature(cancel);
                          this.control.deactivate();
                          return;
                      }
                  }

                  return OpenLayers.Handler.Polygon.prototype.finalize.apply(this,arguments);
              },
            }
        }),


    drawRectangle: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            featureAdded : createFeatureAddedMethod(injectedMethods, 'polygon'),
            handlerOptions: {
                sides: 4,
                irregular: true
            }
        }),

        drawCircle: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            featureAdded : createFeatureAddedMethod(injectedMethods, 'polygon'),
            handlerOptions: {
                sides: 40
            }
        }),

        drawEllipse: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            featureAdded : createFeatureAddedMethod(injectedMethods, 'polygon'),
            handlerOptions: {
                sides: 40,
                irregular: true
            }
        }),

        drawDonut: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
            featureAdded : function() { console.warn("donut should not be created") },
            handlerOptions: {
                holeModifier: 'element',
                // Allow control only to draw holes in polygon, not to draw polygons themselves.
                addPoint: function(pixel) {
                    if(!this.drawingHole && this.evt && this.evt[this.holeModifier]) {
                        var geometry = this.point.geometry;
                        var features = this.control.layer.features;
                        var candidate, polygon;
                        // look for intersections, last drawn gets priority
                        for (var i=features.length-1; i>=0; --i) {
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
                                polygon.geometry.addComponent(this.line.geometry);
                                this.polygon = polygon;
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
                finalize: function(cancel) {

                    if (this.polygon) {
                        var wkt = this.polygon.geometry.toString();
                        var reader = new jsts.io.WKTReader();
                        var geom = reader.read(wkt);
                        if (!geom.isValid()) {
                            $.notify("Geometry not valid");
                            this.polygon.geometry.removeComponent(this.line.geometry);
                            this.control.deactivate();
                            return;
                        }
                    }

                    return OpenLayers.Handler.Polygon.prototype.finalize.apply(this,arguments);
                },
                finalizeInteriorRing : function(event) {

                    var fir =  OpenLayers.Handler.Polygon.prototype.finalizeInteriorRing.apply(this, arguments);
                    var feature = this.polygon;
                    injectedMethods.setModifiedState(feature,this.control);
                    injectedMethods.openFeatureEditDialog(feature);
                    return fir;
                },
            },

            activate: function() {
                this.layer.map.controls.forEach(function(control) {
                    if (control.dragPan) {
                        control.dragPan.deactivate();
                    }
                });
                OpenLayers.Control.DrawFeature.prototype.activate.apply(this,arguments);
            },

            deactivate: function() {
                this.layer.map.controls.forEach(function(control) {
                    if (control.dragPan) {
                        control.dragPan.activate();
                    }
                });
                OpenLayers.Control.DrawFeature.prototype.deactivate.apply(this,arguments);
            }


        }),

        modifyFeature: new OpenLayers.Control.ModifyFeature(layer,{

            onModificationStart: function (feature) {
                console.log("onModificationStart");

                if (injectedMethods.preventModification()) {
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
                    injectedMethods.setModifiedState(feature,this);
                    injectedMethods.openFeatureEditDialog(feature);
                } else {
                    // TODO there might be a better way to revert feature
                    layer = feature.layer;
                    layer.removeFeatures([feature]);
                    feature.geometry = feature.modified.geometry;
                    feature.modified = false;
                    layer.addFeatures([feature]);
                    // deactivation is necessary because the vertice features dont move back
                    this.deactivate();
                }

            },

        }),

        moveFeature: new OpenLayers.Control.DragFeature(layer, {

            onStart: function (feature, px) {
                console.log("onStart");

                if (injectedMethods.preventMove()) {
                    this.cancel();
                    $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                }

            },

            onComplete: function (feature) {
                injectedMethods.setModifiedState(feature,this);
                console.log("onComplete");
                injectedMethods.extendFeatureDataWhenNoPopupOpen(feature);

            }
        }),

    };

    _.each(controls,function(control,index) {

        _.each(controlEvents,function(event,eventName){
            control.events.register(eventName,null,event);
        });

        control.events.register("deactivate",null,function() {
            $(control.map.div).css({cursor: 'default'});

        });

        control.name = index;

    });

    return controls;
};
