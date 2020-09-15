(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function (widget) {

        var contextmenu = new ContextMenu({
            defaultItems: false
        });
        Object.assign(this, {
            enable: function() {
                return contextmenu.enable.apply(contextmenu, arguments);
            },
            disable: function() {
                return contextmenu.disable.apply(contextmenu, arguments);
            }
        });
        widget.map.addControl(contextmenu);

        widget.map.getViewport().addEventListener('contextmenu', function (e) {
            var schema = widget.getCurrentSchema();
            e.preventDefault();

            contextmenu.clear();

            var feature = widget.map.forEachFeatureAtPixel(widget.map.getEventPixel(e),
                function (feature, layer) {
                    return feature;
                }
            );

            if (feature) {
                var subitems = [];
                if (schema.allowLocate) {
                    subitems.push({
                        text: Mapbender.trans('mb.digitizer.feature.zoomTo'),
                        callback: function () {
                            schema.zoomToFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData) {
                    subitems.push({
                        text: Mapbender.trans('mb.digitizer.feature.edit'),
                        callback: function () {
                            schema.openFeatureEditDialog(feature);
                        }
                    });
                }

                if (schema.allowDelete) {
                    subitems.push({
                        text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                        callback: function () {
                            schema.removeFeature(feature);
                        }
                    });
                }
                contextmenu.push({
                    text: feature.get(schema.featureType.name) || "Feature #" + (feature.getId() || ''),
                    items: subitems,
                });
            } else {
                contextmenu.push({text: "Nothing selected!"});
            }
        });

    };


})();
