var DigitizingControlFactory = function (layer) {

    return {
        drawPoint: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point),

        },
        drawLine: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path)
        },
        drawPolygon: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon)
        },
        drawRectangle: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 4,
                    irregular: true
                }
            })
        },
        drawCircle: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40
                }
            })
        },
        drawEllipse: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40,
                    irregular: true
                }
            })
        },
        drawDonut: {
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
                handlerOptions: {
                    holeModifier: 'element'
                }
            })
        },
        modifyFeature: {
            control: new OpenLayers.Control.ModifyFeature(layer)
        },
        moveFeature: {
            control: new OpenLayers.Control.DragFeature(layer, {
                onStart: function (feature) {
                    feature.renderIntent = 'select';
                },
                onComplete: function (feature) {
                    feature.renderIntent = 'default';
                    feature.layer.redraw();

                }
            })
        },
        selectFeature: {
            control: new OpenLayers.Control.SelectFeature(layer, {
                clickout: true,
                toggle: true,
                multiple: true,
                hover: false,
                box: true,
                toggleKey: "ctrlKey", // ctrl key removes from selection
                multipleKey: "shiftKey" // shift key adds to selection
            })
        },
        removeSelected: {
            cssClass: 'critical'
        },
        removeAll: {
            cssClass: 'critical'
        }
    }
};