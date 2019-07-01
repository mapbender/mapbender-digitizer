(function () {
    "use strict";

    var ContextMenu = function (schema) {
        var contextMenu = this;
        contextMenu.schema = schema;
        contextMenu.allowUseContextMenu = contextMenu.allowUseContextMenu.bind(contextMenu);
        contextMenu.buildContextMenu = contextMenu.buildContextMenu.bind(contextMenu);

    };

    ContextMenu.prototype = {

        disabled: true,

        disable: function() {
          this.disabled = true;
        },

        enable: function() {
            this.disabled = false;
        },

        allowUseContextMenu: function () {
            var contextMenu = this;
            var schema = contextMenu.schema;
            return !contextMenu.disabled && schema.useContextMenu;
        }

    };


    Mapbender.Digitizer.MapContextMenu = function () {
        ContextMenu.apply(this, arguments);
    };

    Mapbender.Digitizer.MapContextMenu.prototype = Object.create(ContextMenu.prototype);

    Mapbender.Digitizer.MapContextMenu.prototype.buildContextMenu = function (element, e) {


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
                var feature =  $selectedElement.data().contextMenu.feature;

                if (!$selectedElement || !feature) {
                    return;
                }
                var id = feature.fid;
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

    Mapbender.Digitizer.MapContextMenu.prototype.createMapContextMenuSubMenu = function (feature) {
        var contextMenu = this;
        var schema = contextMenu.schema;
        var subItems = { };

        if (schema.allowLocate) {
            subItems['zoomTo'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
                action: function (key, options, parameters) {
                    schema.zoomToFeature(feature);
                }
            }
        }

        if (schema.allowCustomStyle) {
            subItems['style'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                action: function (key, options, parameters) {
                    schema.openChangeStyleDialog(feature);
                }
            };
        }

        if (schema.allowEditData) {
            subItems['edit'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.edit'),
                action: function (key, options, parameters) {
                    schema.openFeatureEditDialog(feature);
                }
            }
        }

        if (schema.allowDelete) {
            subItems['remove'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                action: function (key, options, parameters) {
                    schema.removeFeature(feature);
                }
            }
        }

        return {
            name: feature.getProperties()[schema.featureType.name] || "Feature #" + feature.fid,
            feature: feature,
            items: subItems
        };
    };


    Mapbender.Digitizer.ElementContextMenu = function () {
        ContextMenu.apply(this, arguments);
    };

    Mapbender.Digitizer.ElementContextMenu.prototype = Object.create(ContextMenu.prototype);

    Mapbender.Digitizer.ElementContextMenu.prototype.buildContextMenu = function (selectedRow, e) {


        var contextMenu = this;
        var schema = contextMenu.schema;
        var api = schema.menu.resultTable.getApi();
        var feature = api.row(selectedRow).data();


        if (!feature) {
            return {
                callback: function (key, options) {
                }
            };
        }

        var items = {};

        if (schema.allowCustomStyle) {
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
                schema.zoomToFeature(feature);
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
