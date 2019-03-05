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


var MapContextMenu = function () {
    ContextMenu.apply(this, arguments);
};

MapContextMenu.prototype = Object.create(ContextMenu.prototype);

MapContextMenu.prototype.buildContextMenu = function (trigger, e) {


    var contextMenu = this;
    var schema = contextMenu.schema;
    var items = {};
    var feature = schema.layer.getFeatureFromEvent(e);

    if (!feature) {
        items['no-items'] = {name: "Nothing selected!"}
    } else {
        if (feature._sketch) {
            return items;
        }
        schema.processFeature(feature,function (feature) {
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


var ElementContextMenu = function () {
    ContextMenu.apply(this, arguments);
};

ElementContextMenu.prototype = Object.create(ContextMenu.prototype);

ElementContextMenu.prototype.buildContextMenu = function (trigger, e) {

    var contextMenu = this;
    var schema = contextMenu.schema;
    var api = schema.resultTable.getApi();
    var olFeature = api.row($(trigger)).data();

    if (!olFeature) {
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
                schema.openChangeStyleDialog(olFeature);
            }
        };
    }

    items['zoom'] = {
        name: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
        action: function () {
            schema.zoomToJsonFeature(olFeature);
        }
    };

    if (schema.allowDelete) {
        items['removeFeature'] = {
            name: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
            action: function () {
                schema.removeFeature(olFeature);
            }
        };
    }

    if (schema.allowEditData) {
        items['edit'] = {
            name: Mapbender.DigitizerTranslator.translate('feature.edit'),
            action: function () {
                schema.openFeatureEditDialog(olFeature);
            }
        };
    }

    // if (schema['anything']) {
    //     items['exportToGeoJson'] = {
    //         name: '-',
    //         action: function() {schema.exportGeoJson(olFeature); }
    //     }
    // }


    return {
        callback: function (key, options) {
            options.items[key].action();
        },
        items: items
    };
};
