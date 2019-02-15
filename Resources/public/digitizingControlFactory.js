var createFeatureAddedMethod = function(injectedMethods) {


    /**
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     */
    var func = function (feature) {

        _.each(injectedMethods.getDefaultAttributes(), function(prop) {
            feature.attributes[prop] = "";
        });

        feature.layer.redraw();

        injectedMethods.setModifiedState(feature,this);
        injectedMethods.deactivateCurrentControl();
        injectedMethods.openFeatureEditDialog(feature);

        feature.redraw();
    };

    return func;

};


var DigitizingControlFactory = function (layer,injectedMethods,controlEvents) {

    var featureAdded = createFeatureAddedMethod(injectedMethods);

    var controls =  {
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
                    injectedMethods.setModifiedState(this.polygon,this.control);
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