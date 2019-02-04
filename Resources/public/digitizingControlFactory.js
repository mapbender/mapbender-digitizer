var createFeatureAddedMethod = function(controlEvents) {


    /**
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     */
    var func = function (feature) {

        feature.isNew = true; // replace by state == insert

        _.each(controlEvents.getDefaultAttributes(), function(prop) {
            feature.attributes[prop] = "";
        });

        feature.layer.redraw();

        controlEvents.deactivateCurrentControl();
        controlEvents.openFeatureEditDialog(feature);

    };

    return func;

};


var DigitizingControlFactory = function (layer,controlEvents) {

    var featureAdded = createFeatureAddedMethod({
        deactivateCurrentControl: controlEvents.deactivateCurrentControl,
        openFeatureEditDialog: controlEvents.openFeatureEditDialog,
        getDefaultAttributes: controlEvents.getDefaultAttributes,
        triggerModifiedState: controlEvents.triggerModifiedState
    });

    return {
        drawPoint: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point,{
            featureAdded : featureAdded
        }),

        drawLine: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path,{
            featureAdded : featureAdded
        }),

        drawPolygon: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
            featureAdded : featureAdded
        }),

        drawRectangle: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            featureAdded : featureAdded,
            handlerOptions: {
                sides: 4,
                irregular: true
            }
        }),

        drawCircle: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            featureAdded : featureAdded,
            handlerOptions: {
                sides: 40
            }
        }),

        drawEllipse: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            featureAdded : featureAdded,
            handlerOptions: {
                sides: 40,
                irregular: true
            }
        }),

        drawDonut: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
            featureAdded : featureAdded.bind(this),
            handlerOptions: {
                holeModifier: 'element',
                finalizeInteriorRing : function(event) {
                    var fir =  OpenLayers.Handler.Polygon.prototype.finalizeInteriorRing.apply(this, arguments);
                    controlEvents.triggerModifiedState(this.polygon,this.control,true);
                    return fir;
                }
            },

        }),

        modifyFeature: new OpenLayers.Control.ModifyFeature(layer,{

            /**
             * This function allows the easy use of the olEvent onModificationStart with the yml configurration
             * e.G. to prevent the modification or add additional data on modification
             * */

            onModificationStart: function (feature) {
                console.log("onModificationStart");

                if (controlEvents.preventModification()) {
                    this.deactivate();
                    this.activate();
                    $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                }


            },

            onModification: function (feature) {

                controlEvents.triggerModifiedState(feature,this,true);
                console.log("onModification",feature);
                //widget.unsavedFeatures[feature.id] = feature;
            } // http://dev.openlayers.org/docs/files/OpenLayers/Control/DragFeature-js.html
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

                if (controlEvents.preventMove()) {
                    this.cancel();
                    $.notify(Mapbender.DigitizerTranslator.translate('move.denied'));
                }

                feature.isDragged = true;
                console.log("true");
            },
            /**
             *
             * @param {(OpenLayers.Feature.Vector | OpenLayers.Feature)} feature
             */

            onComplete: function (feature) {
                controlEvents.triggerModifiedState(feature,this,true);
                console.log("onComplete");
                //widget.unsavedFeatures[event.id] = feature;
                controlEvents.extendFeatureDataWhenNoPopupOpen(feature);

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
    }
};