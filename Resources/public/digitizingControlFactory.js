OpenLayers.Control.DrawFeature.prototype.featureAdded = function(feature) {


        console.log("featureAdded",feature);
        console.trace();
        var layer = feature.layer;
        var schema = widget.findSchemaByLayer(layer);
        var digitizerToolSetElement = $(".digitizing-tool-set", frame);
        var properties = $.extend({}, newFeatureDefaultProperties); // clone from newFeatureDefaultProperties
        //
        //if(schema.isClustered){
        //    $.notify('Create new feature is by clusterring not posible');
        //    return false;
        //}


        feature.isNew = true;

        feature.attributes = feature.data = properties;

        feature.schema = schema;

        layer.redraw();

        digitizerToolSetElement.digitizingToolSet("deactivateCurrentControl");

        //widget.unsavedFeatures[feature.id] = feature;

        if (schema.openFormAfterEdit) {
            widget._openFeatureEditDialog(feature);
        }

        //return true;


};


var DigitizingControlFactory = function (layer) {

    return {
        drawPoint: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point),

        drawLine: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path),

        drawPolygon: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon),

        drawRectangle: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            handlerOptions: {
                sides: 4,
                irregular: true
            }
        }),

        drawCircle: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            handlerOptions: {
                sides: 40
            }
        }),

        drawEllipse: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
            handlerOptions: {
                sides: 40,
                irregular: true
            }
        }),

        drawDonut: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
            handlerOptions: {
                holeModifier: 'element'
            }
        }),

        modifyFeature: new OpenLayers.Control.ModifyFeature(layer,{

            /**
             * This function allows the easy use of the olEvent onModificationStart with the yml configurration
             * e.G. to prevent the modification or add additional data on modification
             * */

            onModificationStart: function (feature) {
                console.log("onModificationStart");
                var control = this;
                var schema = feature.schema;
                var preventDefault = false;

                if (!schema.hooks || !schema.hooks.onModificationStart) {
                    return;
                }

                try {
                    preventDefault = eval(schema.hooks.onModificationStart);
                } catch (e) {

                    $.notify(e);
                    return;
                }

                if (preventDefault) {
                    control.deactivate();
                    control.activate();

                    $.notify(Mapbender.digitizer_translate('move.denied'));

                }

            },

            onModification: function (feature) {
                //widget.unsavedFeatures[feature.id] = feature;
            } // http://dev.openlayers.org/docs/files/OpenLayers/Control/DragFeature-js.html
        }),

        moveFeature: new OpenLayers.Control.DragFeature(layer, {

            /**
             * This function allows the easy use of the olEvent onStart( called on drag start) with the yml configurration
             * e.G. to prevent the move or add additional data on move
             * */
            onStart: function (feature, px) {
                console.log("onStart");

                var control = this;
                /**@type {Scheme} */
                var schema = feature.schema;
                var preventDefault = false;

                //feature.oldGeom = {x: feature.geometry.x, y: feature.geometry.y};
                feature.isDragged = true;
                if (!schema.hooks || !schema.hooks.onStart) {
                    return;
                }

                try {
                    preventDefault = eval(schema.hooks.onStart);
                } catch (e) {

                    $.notify(e);
                    return;
                }


                if (preventDefault) {
                    $.notify(Mapbender.digitizer_translate('move.denied'));
                    control.cancel();

                }
            },

            onComplete: function (feature) {
                console.log("onComplete");
                //widget.unsavedFeatures[event.id] = feature;
                if (!widget.currentPopup || !widget.currentPopup.data('visUiJsPopupDialog')._isOpen) {

                    if (schema.popup.remoteData) {
                        var bbox = feature.geometry.getBounds();
                        bbox.right = parseFloat(bbox.right + 0.00001);
                        bbox.top = parseFloat(bbox.top + 0.00001);
                        bbox = bbox.toBBOX();
                        var srid = map.getProjection().replace('EPSG:', '');
                        var url = widget.elementUrl + "getFeatureInfo/";

                        $.ajax({
                            url: url, data: {
                                bbox: bbox,
                                schema: schema.schemaName,
                                srid: srid
                            }
                        }).done(function (response) {
                            _.each(response.dataSets, function (dataSet) {
                                var newData = JSON.parse(dataSet).features[0].properties;


                                Object.keys(feature.data);
                                $.extend(feature.data, newData);


                            });
                            widget._openFeatureEditDialog(feature);

                        }).fail(function () {
                            $.notfiy("No remote data could be fetched");
                            widget._openFeatureEditDialog(feature);
                        });

                    } else {
                        widget._openFeatureEditDialog(feature);
                    }
                }
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