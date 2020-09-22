(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function(olMap, widget) {
        this.widget = widget;
        this.olMap = olMap;
        this.contextmenu = new ContextMenu({
            defaultItems: false
        });
        this.onMap_ = false;
    };
    Object.assign(Mapbender.Digitizer.MapContextMenu.prototype, {
        enable: function() {
            if (!this.onMap_) {
                this.olMap.addControl(this.contextmenu);
                this.registerEvents(this.olMap);
                this.onMap_ = true;
            }
            return this.contextmenu.enable.apply(this.contextmenu, arguments);
        },
        disable: function() {
            return this.contextmenu.disable.apply(this.contextmenu, arguments);
        },
        /**
         * @param {ol.PluggableMap} olMap
         */
        registerEvents: function(olMap) {
            var self = this;
            olMap.getViewPort().addEventListener('contextmenu', function (e) {
                self._handleContextMenu(e);
            });
        },
        _handleContextMenu: function(e) {
            var schema = this.widget.getCurrentSchema();
            e.preventDefault();

            this.contextmenu.clear();

            // @todo: figure out if this works. The result here is likely a list of features (plural),
            //        but following logic treats it as a single feature
            var feature = widget.map.forEachFeatureAtPixel(widget.map.getEventPixel(e),
                function (feature, layer) {
                    return feature;
                }
            );
            var contextmenu = this.contextmenu; // @todo: disambiguate

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
                    text: "Feature #" + (feature.getId() || ''),
                    items: subitems
                });
            } else {
                contextmenu.push({text: "Nothing selected!"});
            }
        }
    });

})();
