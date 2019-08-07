(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function (widget) {

        var contextmenu = new ContextMenu({
            defaultItems: false,
        });
        widget.map.addControl(contextmenu);

        widget.map.on('Digitizer.activateSchema',function(event) {
            var schema = event.schema;
           if (schema.useContextMenu) {
                contextmenu.enable();
           } else {
               contextmenu.disable();
           }
        });

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
                        text: Mapbender.DataManager.Translator.translate('feature.zoomTo'),
                        callback: function () {
                            schema.zoomToFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData) {
                    subitems.push({
                        text: Mapbender.DataManager.Translator.translate('feature.edit'),
                        callback: function () {
                            schema.openFeatureEditDialog(feature);
                        }
                    });
                }

                if (schema.allowDelete) {
                    subitems.push({
                        text: Mapbender.DataManager.Translator.translate('feature.remove.title'),
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
