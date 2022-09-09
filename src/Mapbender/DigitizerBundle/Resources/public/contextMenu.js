(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function(olMap, widget) {
        this.widget = widget;
        this.olMap = olMap;
        this.contextmenu = new ContextMenu({
            width: null,
            defaultItems: false
        });
        this.onMap_ = false;
        this.enabled_ = false;
    };
    Object.assign(Mapbender.Digitizer.MapContextMenu.prototype, {
        setActive: function(state) {
            if (state) {
                if (!this.onMap_) {
                    this.olMap.addControl(this.contextmenu);
                    this.registerEvents(this.olMap);
                    this.onMap_ = true;
                }
                this.contextmenu.enable();
            } else {
                this.contextmenu.close();
                this.contextmenu.disable();
                this.contextmenu.clear();
            }
            this.enabled_ = !!state;
        },
        /**
         * @param {ol.PluggableMap} olMap
         */
        registerEvents: function(olMap) {
            var self = this;
            this.contextmenu.on('beforeopen', function (evt) {
                var layers = self.enabled_ && self.widget.getSchemaLayers(self.widget._getCurrentSchema());
                // NOTE: prefer forEachFeatureAtPixel over getFeaturesAtPixel for performance
                //       forEachFeatureAtPixel allows early out by returning truthy value from callback,
                //       which is also (unintuitively) forwarded back to the caller
                /** @see https://github.com/openlayers/openlayers/blob/v6.14.1/src/ol/PluggableMap.js#L612 */
                var callback = function(feature) {
                    return feature;
                };
                var feature = layers.length && olMap.forEachFeatureAtPixel(evt.pixel, callback, {
                    layerFilter: function(layer) {
                        return -1 !== layers.indexOf(layer);
                    }
                });
                if (feature) {
                    if (self.reconfigure(feature)) {
                        self.contextmenu.enable();
                    } else {
                        self.contextmenu.disable();
                    }
                } else {
                    self.contextmenu.disable();
                }
            });
        },
        reconfigure: function(feature) {
            var items = [];
            var widget = this.widget;
            if (feature.get('dirty') && feature.get('oldGeometry')) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.revert.geometry'),
                    callback: function() {
                        widget.revertGeometry(feature);
                    }
                });
            }
            var schema = this.widget.getItemSchema(feature);
            items.push({
                text: Mapbender.trans(schema && schema.allowEdit && 'mb.digitizer.edit.attributes' || 'mb.digitizer.actions.show_details'),
                callback: function () {
                    widget._openEditDialog(schema, feature);
                }
            });
            if (this.widget._getUniqueItemId(feature) && schema && schema.allowDelete) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                    callback: function () {
                        widget.removeData(schema, feature);
                    }
                });
            }
            this.contextmenu.clear();
            this.contextmenu.extend(items);
            return !!items.length;
        }
    });

})();
