var DigiztizingControlFactory = function (translations,mapElement,widget) {

    var layer = widget.getLayer();

    return {
        drawPoint: {
            infoText: translations.drawPoint,
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Point),
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                }
            }
        },
        drawLine: {
            infoText: translations.drawLine,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                }

            },
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Path)
        },
        drawPolygon: {
            infoText: translations.drawPolygon,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                } else {
                    mapElement.css({cursor: 'default'});
                }

            },
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon)
        },
        drawRectangle: {
            infoText: translations.drawRectangle,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                } else {
                    mapElement.css({cursor: 'default'});
                }

            },
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 4,
                    irregular: true
                }
            })
        },
        drawCircle: {
            infoText: translations.drawCircle,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                } else {
                    mapElement.css({cursor: 'default'});
                }

            },
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40
                }
            })
        },
        drawEllipse: {
            infoText: translations.drawEllipse,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                } else {
                    mapElement.css({cursor: 'default'});
                }

            },
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, {
                handlerOptions: {
                    sides: 40,
                    irregular: true
                }
            })
        },
        drawDonut: {
            infoText: translations.drawDonut,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                } else {
                    mapElement.css({cursor: 'default'});
                }
            },
            control: new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, {
                handlerOptions: {
                    holeModifier: 'element'
                }
            })
        },
        modifyFeature: {
            infoText: translations.selectAndEditGeometry,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'crosshair'});
                } else {
                    mapElement.css({cursor: 'default'});
                }

            },
            control: new OpenLayers.Control.ModifyFeature(layer)
        },
        moveFeature: {
            infoText: translations.moveGeometry,
            onClick: function (e) {
                var el = $(e.currentTarget);
                if (widget.toggleController(el.data('control'))) {
                    mapElement.css({cursor: 'default'});
                }
                mapElement.css({cursor: 'default'});
            },
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
            onClick: function (e) {
                var el = $(e.currentTarget);
                widget.toggleController(el.data('control'));
                mapElement.css({cursor: 'default'});

            },
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
            onClick: function () {
                layer.removeFeatures(layer.selectedFeatures);
            }
        },
        removeAll: {
            infoText: translations.removeAll,
            cssClass: 'critical',
            onClick: function () {
                layer.removeAllFeatures();
            }
        }
    }
};