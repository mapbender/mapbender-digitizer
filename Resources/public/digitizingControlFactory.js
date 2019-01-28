var DigitizingControlFactory = function (translations,layer) {

    return {
        drawPoint: {
            infoText: translations.drawPoint,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point),

        },
        drawLine: {
            infoText: translations.drawLine,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path)
        },
        drawPolygon: {
            infoText: translations.drawPolygon,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon)
        },
        drawRectangle: {
            infoText: translations.drawRectangle,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 4,
                    irregular: true
                }
            })
        },
        drawCircle: {
            infoText: translations.drawCircle,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40
                }
            })
        },
        drawEllipse: {
            infoText: translations.drawEllipse,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40,
                    irregular: true
                }
            })
        },
        drawDonut: {
            infoText: translations.drawDonut,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
                handlerOptions: {
                    holeModifier: 'element'
                }
            })
        },
        modifyFeature: {
            infoText: translations.selectAndEditGeometry,
            control: new OpenLayers.Control.ModifyFeature(layer)
        },
        moveFeature: {
            infoText: translations.moveGeometry,
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
            infoText: translations.selectGeometry,
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
            infoText: translations.removeSelected,
            cssClass: 'critical',
        },
        removeAll: {
            infoText: translations.removeAll,
            cssClass: 'critical',
        }
    }
};