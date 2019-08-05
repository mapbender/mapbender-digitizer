(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function (widget) {

        var contextmenu = new ContextMenu({
            defaultItems: false,
        });
        widget.map.addControl(contextmenu);

        widget.map.getViewport().addEventListener('contextmenu', function (e) {
            e.preventDefault();

            contextmenu.clear();

            var feature = widget.map.forEachFeatureAtPixel(widget.map.getEventPixel(e),
                function (feature, layer) {
                    return feature;
                }
            );

            if (feature) {
                var subitems = [];
                if (widget.getCurrentSchema().allowLocate) {
                    subitems.push({
                        text: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
                        callback: function () {
                            widget.getCurrentSchema().zoomToFeature(feature);
                        }
                    });
                }

                if (widget.getCurrentSchema().allowEditData) {
                    subitems.push({
                        text: Mapbender.DigitizerTranslator.translate('feature.edit'),
                        callback: function () {
                            widget.getCurrentSchema().openFeatureEditDialog(feature);
                        }
                    });
                }

                if (widget.getCurrentSchema().allowDelete) {
                    subitems.push({
                        text: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                        callback: function () {
                            widget.getCurrentSchema().removeFeature(feature);
                        }
                    });
                }
                contextmenu.push({
                    text: feature.get(widget.getCurrentSchema().featureType.name) || "Feature #" + (feature.getId() || ''),
                    items: subitems,
                });
            } else {
                contextmenu.push({text: "Nothing selected!"});
            }
        });

    };


})();
