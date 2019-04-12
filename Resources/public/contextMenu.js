(function () {
    "use strict";

    var ContextMenu = function (schema) {
        var contextMenu = this;
        contextMenu.schema = schema;
        contextMenu.allowUseContextMenu = contextMenu.allowUseContextMenu.bind(contextMenu);
        contextMenu.buildContextMenu = contextMenu.buildContextMenu.bind(contextMenu);

    };

    ContextMenu.prototype = {

        allowUseContextMenu: function () {
            var contextMenu = this;
            var schema = contextMenu.schema;
            return schema.useContextMenu;
        }

    };


    window.MapContextMenu = function () {
        ContextMenu.apply(this, arguments);
    };

    MapContextMenu.prototype = Object.create(ContextMenu.prototype);

    MapContextMenu.prototype.buildContextMenu = function (element, e) {


        var contextMenu = this;
        var schema = contextMenu.schema;
        var items = {};
        var feature = schema.layer.getFeatureFromEvent(e);

        if (!feature) {
            items['no-items'] = {name: "Nothing selected!"}
        } else {
            if (feature.isNew) {
                return items;
            }
            schema.processFeature(feature, function (feature) {
                items[feature.fid] = contextMenu.createMapContextMenuSubMenu(feature);
            });

        }

        return {
            items: items,

            callback: function (key, options) {
                var $selectedElement = options.$selected;
                if (!$selectedElement || !feature) {
                    return;
                }

                var id = feature.fid; //$selectedElement.parent().closest('.context-menu-item').data('contextMenuKey');
                var parameters = options.items[id];
                if (!parameters) {
                    return;
                }

                if (parameters.items[key].action) {
                    parameters.items[key].action(key, options, parameters);
                }
            }
        }
    };

    MapContextMenu.prototype.createMapContextMenuSubMenu = function (olFeature) {
        var contextMenu = this;
        var schema = contextMenu.schema;
        var subItems = {
            zoomTo: {
                name: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
                action: function (key, options, parameters) {
                    schema.zoomToJsonFeature(parameters.olFeature);
                }
            }
        };

        if (schema.allowChangeVisibility) {
            subItems['style'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.visibility.change'),
                action: function (key, options, parameters) {
                    schema.openChangeStyleDialog(olFeature);
                }
            };
        }

        if (schema.allowCustomerStyle) {
            subItems['style'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                action: function (key, options, parameters) {
                    schema.openChangeStyleDialog(olFeature);
                }
            };
        }

        if (schema.allowEditData) {
            subItems['edit'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.edit'),
                action: function (key, options, parameters) {
                    schema.openFeatureEditDialog(parameters.olFeature);
                }
            }
        }

        if (schema.allowDelete) {
            subItems['remove'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                action: function (key, options, parameters) {
                    schema.removeFeature(parameters.olFeature);
                }
            }
        }

        return {
            name: "Feature #" + olFeature.fid,
            olFeature: olFeature,
            items: subItems
        };
    };


    window.ElementContextMenu = function () {
        ContextMenu.apply(this, arguments);
    };

    ElementContextMenu.prototype = Object.create(ContextMenu.prototype);

    ElementContextMenu.prototype.buildContextMenu = function (selectedRow, e) {


        var contextMenu = this;
        var schema = contextMenu.schema;
        var api = schema.resultTable.getApi();
        var feature = api.row(selectedRow).data();


        if (!feature) {
            return {
                callback: function (key, options) {
                }
            };
        }

        var items = {};

        if (schema.allowCustomerStyle) {
            items['changeStyle'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                action: function () {
                    schema.openChangeStyleDialog(feature);
                }
            };
        }

        items['zoom'] = {
            name: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
            action: function () {
                schema.zoomToJsonFeature(feature);
            }
        };

        if (schema.allowDelete) {
            items['removeFeature'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                action: function () {
                    schema.removeFeature(feature);
                }
            };
        }

        if (schema.allowEditData) {
            items['edit'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.edit'),
                action: function () {
                    schema.openFeatureEditDialog(feature);
                }
            };
        }

        // if (schema['anything']) {
        //     items['exportToGeoJson'] = {
        //         name: '-',
        //         action: function() {schema.exportGeoJson(feature); }
        //     }
        // }


        return {
            callback: function (key, options) {
                options.items[key].action();
            },
            items: items
        };
    };


})();
