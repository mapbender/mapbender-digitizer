var createFeatureAddedMethod = function(injectedMethods, geomType) {


    /**
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     */
    var func = function (feature) {

        _.each(injectedMethods.getDefaultAttributes(), function(prop) {
            feature.attributes[prop] = "";
        });

        feature.attributes.geomType = geomType;


        injectedMethods.setModifiedState(feature,this);
        injectedMethods.deactivateCurrentControl();
        injectedMethods.openFeatureEditDialog(feature);
        feature.redraw();
    };

    return func;

};

var finalizePolygonValidOnly = function(cancel) {
    var wkt = this.polygon.geometry.toString();
    var reader = new jsts.io.WKTReader();
    var geom = reader.read(wkt);
    if (!geom.isValid()) {
        $.notify("Geometry not valid");
        this.destroyFeature(cancel);
        return;
    }

    return OpenLayers.Handler.Polygon.prototype.finalize.apply(this,arguments);
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
              finalize: finalizePolygonValidOnly,
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
                finalizeInteriorRing : function(event) {

                    var fir =  OpenLayers.Handler.Polygon.prototype.finalizeInteriorRing.apply(this, arguments);
                    injectedMethods.setModifiedState(this.polygon,this.control);
                    return fir;
                },
                finalize: finalizePolygonValidOnly,
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

            /**
             * This function allows the easy use of the olEvent onModificationStart with the yml configurration
             * e.G. to prevent the modification or add additional data on modification
             * */

            onModificationStart: function (feature) {
                console.log("onModificationStart");

                if (injectedMethods.preventModification()) {
                    this.deactivate();
                    this.activate();
                    $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                }


            },

            onModification: function (feature) {

                injectedMethods.setModifiedState(feature,this);
                console.log("onModification",feature);

            }
        }),

        moveFeature: new OpenLayers.Control.DragFeature(layer, {

            /**
             * * This function allows the easy use of the olEvent onStart( called on drag start) with the yml configurration
             * e.G. to prevent the move or add additional data on move
             * @param {(OpenLayers.Feature.Vector | OpenLayers.Feature)} feature
             * @param px
             */
            onStart: function (feature, px) {
                console.log("onStart");

                if (injectedMethods.preventMove()) {
                    this.cancel();
                    $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                }

            },
            /**
             *
             * @param {(OpenLayers.Feature.Vector | OpenLayers.Feature)} feature
             */

            onComplete: function (feature) {
                injectedMethods.setModifiedState(feature,this);
                console.log("onComplete");
                injectedMethods.extendFeatureDataWhenNoPopupOpen(feature);

            }
        }),

        selectFeature: new OpenLayers.Control.SelectFeature(layer, {
            clickout: true,
            toggle: true,
            multiple: true,
            hover: false,
            box: true,
            toggleKey: "ctrlKey", // ctrl key removes from selection
            multipleKey: "shiftKey" // shift key adds to selection
        })
        // removeSelected: {
        //     cssClass: 'critical'
        // },
        // removeAll: {
        //     cssClass: 'critical'
        // }
    };

    _.each(controls,function(control,index) {

        _.each(controlEvents,function(event,eventName){
            control.events.register(eventName,null,event);
        });

        control.name = index;

    });

    return controls;
};
