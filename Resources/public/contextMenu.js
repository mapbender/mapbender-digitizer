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
        this.filterLayers_ = [];
        this.schema_ = null;
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
            }
            this.enabled_ = !!state;
        },
        /**
         * @param {ol.PluggableMap} olMap
         */
        registerEvents: function(olMap) {
            var self = this;
            this.contextmenu.on('beforeopen', function (evt) {
                var feature = olMap.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
                    if (self.filterLayers_.indexOf(layer) !== -1) {
                        return feature;
                    }
                });
                if (feature && self.enabled_) {
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
        setSchema: function(schema) {
            this.schema_ = schema || null;
            this.contextmenu.clear();
            if (this.enabled_ && this.schema_) {
                this.contextmenu.enable();
            } else {
                this.contextmenu.disable();
            }
            this.filterLayers_ = [this.widget.getSchemaLayer(schema)];
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
            var schema = this.schema_;
            items.push({
                text: Mapbender.trans(schema && schema.allowEdit && 'mb.digitizer.edit.attributes' || 'mb.digitizer.actions.show_details'),
                callback: function () {
                    widget._openEditDialog(schema, feature);
                }
            });
            if (schema && schema.allowCustomStyle) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.feature.style.change'),
                    callback: function() {
                        widget.openStyleEditor(schema, feature);
                    }
                });
            }
            var featureHasId = !!widget._getUniqueItemId(schema, feature);
            if (featureHasId && schema && schema.allowDelete) {
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
