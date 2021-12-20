(function () {
    "use strict";

    var ContextMenu = function (schema) {
        var contextMenu = this;
        contextMenu.schema = schema;
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
        var features = feature && (feature.cluster || [feature]);
        if (!feature || !features.length) {
            return false;
        }
        for (var i = 0; i < features.length; ++i) {
            items[features[i].fid] = contextMenu.createMapContextMenuSubMenu(features[i]);
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
                name: Mapbender.trans('mb.digitizer.feature.zoomTo'),
                action: function (key, options, parameters) {
                    schema.zoomToFeature(feature);
                }
            }
        }

        if (schema.allowCustomStyle) {
            subItems['style'] = {
                name: Mapbender.trans('mb.digitizer.feature.style.change'),
                action: function (key, options, parameters) {
                    schema.openChangeStyleDialog(feature);
                }
            };
        }

        if (schema.allowEditData) {
            subItems['edit'] = {
                name: Mapbender.trans('mb.digitizer.feature.edit'),
                action: function (key, options, parameters) {
                    schema.openFeatureEditDialog(feature);
                }
            }
        }

        if (schema.allowDelete) {
            subItems['remove'] = {
                name: Mapbender.trans('mb.digitizer.feature.remove.title'),
                action: function (key, options, parameters) {
                    schema.widget.deleteFeature(feature);
                }
            }
        }

        return {
            name: feature.attributes[schema.featureType.name] || "Feature #" + feature.fid,
            feature: feature,
            items: subItems
        };
    };


})();
