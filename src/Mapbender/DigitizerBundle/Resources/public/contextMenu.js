(function () {
    "use strict";


    Mapbender.Digitizer.MapContextMenu = function(olMap, widget) {
        this.widget = widget;
        this.olMap = olMap;
        this.onMap_ = false;
        this.enabled_ = false;
        this.filterLayers_ = [];
        this.schema_ = null;

        this.initDom_(olMap);
    };
    Object.assign(Mapbender.Digitizer.MapContextMenu.prototype, {
        setActive: function(state) {
            if (state) {
                if (!this.onMap_) {
                    this.registerEvents(this.olMap);
                    this.onMap_ = true;
                }
            }
            this.enabled_ = !!state;
        },
        /**
         * @param {ol.PluggableMap} olMap
         */
        registerEvents: function(olMap) {
            var self = this;
            function onContextMenu(evt) {
                if (!self.enabled_ || !self.schema_) {
                    return;
                }
                var pixel = olMap.getEventPixel(evt);

                var feature = olMap.forEachFeatureAtPixel(pixel, function (feature, layer) {
                    if (self.filterLayers_.indexOf(layer) !== -1) {
                        return feature;
                    }
                });
                var menuItems = feature && self.getMenuItems(feature);
                if (menuItems && menuItems.length) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    self.showMenu(evt, pixel, menuItems);
                } else {
                    self.closeMenu();
                }
            }
            olMap.getViewport().addEventListener('contextmenu', onContextMenu);
        },
        setSchema: function(schema) {
            this.schema_ = schema || null;
            this.closeMenu();
            this.filterLayers_ = [this.widget.getSchemaLayer(schema)];
        },
        getMenuItems: function(feature) {
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
            return items;
        },
        showMenu: function(evt, pixel, items) {
            var self = this;
            // Add one-shot event handler to close the menu on outside click
            evt.target.addEventListener('click', function(e) {
                self.closeMenu();
                evt.target.removeEventListener(e.type, this, false);
            });
            // Clear previous items
            while (this.itemListElement_.lastChild) {
                this.itemListElement_.removeChild(this.itemListElement_.lastChild);
            }
            // Rebuild item DOM
            for (var i = 0; i < items.length; ++i) {
                var itemConfig = items[i];
                var itemNode = this.renderItem_(itemConfig);
                this.configureItemEvents_(itemNode, itemConfig);
                this.itemListElement_.appendChild(itemNode);
            }
            this.menuElement_.className = this.cssClass;
            this.setMenuPosition_(this.menuElement_, pixel);
        },
        renderItem_: function(itemConfig) {
            var li = document.createElement('li');
            li.innerText = itemConfig.text;
            return li;
        },
        configureItemEvents_: function(element, itemConfig) {
            var callback = itemConfig.callback;
            if (callback) {
                var self = this;
                var wrapped = function(evt) {
                    evt.preventDefault();
                    self.closeMenu();
                    callback();
                };
                element.addEventListener('click', wrapped);
            }
        },
        closeMenu: function() {
            this.menuElement_.className = [this.cssClass, 'hidden'].join(' ');
        },
        setMenuPosition_: function(element, evtPixel) {
            var mapSize = this.olMap.getSize();
            var widthLeft = mapSize[0] - evtPixel[0];
            var menuWidth = element.offsetWidth;
            if (menuWidth >= widthLeft && menuWidth < evtPixel[0]) {
                element.style.right = '5px';
                element.style.left = 'auto';
            } else {
                element.style.right = 'auto';
                element.style.left = [evtPixel[0] + 5, 'px'].join('');
            }
            element.style.top = [evtPixel[1] + 5, 'px'].join('');
        },
        initDom_: function(olMap) {
            this.cssClass = 'mb-digitizer-contextmenu';
            this.menuElement_ = document.createElement('div');
            this.menuElement_.className = [this.cssClass, 'hidden'].join(' ');
            this.itemListElement_ = document.createElement('ul');
            this.menuElement_.appendChild(this.itemListElement_);
            this.menuParent_ = olMap.getOverlayContainerStopEvent();
            this.menuParent_.appendChild(this.menuElement_);
        },
        __dummy__: null
    });

})();
