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
                if (self.feature && self.enabled_ && self.menuItems_.length) {
                    self.contextmenu.enable();
                } else {
                    self.contextmenu.disable();
                }
            });
            olMap.getViewport().addEventListener('contextmenu', function (e) {
                self._handleContextMenu(e);
            });
        },
        setSchema: function(schema) {
            this.menuItems_ = this.getMenuItems(schema);
            this.contextmenu.clear();
            this.contextmenu.extend(this.menuItems_);
            if (this.enabled_ && this.menuItems_.length) {
                this.contextmenu.enable();
            } else {
                this.contextmenu.disable();
            }
        },
        _handleContextMenu: function(e) {
            e.preventDefault();
        },
        getMenuItems: function(schema) {
            // NOTE: self.feature initialized and updated by beforeopen handler
            var self = this;
            var items = [];
            if (schema.allowLocate) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.feature.zoomTo'),
                    callback: function () {
                        schema.zoomToFeature(self.feature);
                    }
                });
            }

            if (schema.allowEditData) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.feature.edit'),
                    callback: function () {
                        schema.openFeatureEditDialog(self.feature);
                    }
                });
            }

            if (schema.allowDelete) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                    callback: function () {
                        schema.removeFeature(self.feature);
                    }
                });
            }
            return items;
        }
    });

})();
