(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function(olMap, widget) {
        this.widget = widget;
        this.olMap = olMap;
        this.contextmenu = new ContextMenu({
            defaultItems: false
        });
        this.onMap_ = false;
        this.enabled_ = false;
    };
    Object.assign(Mapbender.Digitizer.MapContextMenu.prototype, {
        enable: function() {
            if (!this.onMap_) {
                this.olMap.addControl(this.contextmenu);
                this.registerEvents(this.olMap);
                this.onMap_ = true;
            }
            this.enabled_ = true;
            return this.contextmenu.enable.apply(this.contextmenu, arguments);
        },
        disable: function() {
            this.enabled_ = false;
            return this.contextmenu.disable.apply(this.contextmenu, arguments);
        },
        /**
         * @param {ol.PluggableMap} olMap
         */
        registerEvents: function(olMap) {
            var self = this;
            this.contextmenu.on('beforeopen', function (evt) {
                self.feature = olMap.forEachFeatureAtPixel(evt.pixel, function (feature) {
                    return feature;
                });
                if (self.feature && self.enabled_) {
                    self.contextmenu.enable();
                } else {
                    self.contextmenu.disable();
                }
            });
            olMap.getViewport().addEventListener('contextmenu', function (e) {
                self._handleContextMenu(e);
            });
        },
        _handleContextMenu: function(e) {
            var schema = this.widget._getCurrentSchema();
            e.preventDefault();

            this.contextmenu.clear();

            var feature = this.feature; // initialized by beforeopen handler
            var contextmenu = this.contextmenu; // @todo: disambiguate

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
        }
    });

})();
