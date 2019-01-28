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

        modifyFeature: new OpenLayers.Control.ModifyFeature(layer),

        moveFeature: new OpenLayers.Control.DragFeature(layer, {
            onStart: function (feature) {
                feature.renderIntent = 'select';
            },
            onComplete: function (feature) {
                feature.renderIntent = 'default';
                feature.layer.redraw();

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