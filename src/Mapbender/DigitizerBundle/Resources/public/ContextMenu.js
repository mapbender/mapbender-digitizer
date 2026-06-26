(function () {
    "use strict";

    /**
     * Map context menu class for handling right-click menus on features
     */
    class MapContextMenu {
        /**
         * @param {ol.Map} olMap
         * @param {*} widget
         */
        constructor(olMap, widget) {
            this.widget = widget;
            this.olMap = olMap;
            this.onMap_ = false;
            this.enabled_ = false;
            this.cssClass = 'mb-digitizer-contextmenu';
            this.menuElement_ = null;
            this.itemListElement_ = null;
            this.menuParent_ = null;
            this.initDom_(olMap);
        }

        /**
         * @param {boolean} state
         */
        setActive(state) {
            if (state) {
                if (!this.onMap_) {
                    this.registerEvents(this.olMap);
                    this.onMap_ = true;
                }
            }
            this.enabled_ = !!state;
        }

        /**
         * @param {ol.Map} olMap
         */
        registerEvents(olMap) {
            const self = this;
            function onContextMenu(evt) {
                if (!self.enabled_) {
                    return;
                }
                const pixel = olMap.getEventPixel(evt);

                const layers = self.widget.getSchemaLayers(self.widget._getCurrentSchema());
                const features = [];
                const callback = function(feature) {
                    features.push(feature);
                    return false; // Continue collecting features
                };
                if (layers.length) {
                    olMap.forEachFeatureAtPixel(pixel, callback, {
                        layerFilter: function(layer) {
                            return -1 !== layers.indexOf(layer);
                        }
                    });
                }

                if (features.length) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    const combinedMenuItems = self.getMenuItemsForMultipleFeatures(features);
                    self.showMenu(evt, pixel, combinedMenuItems);
                } else {
                    self.closeMenu();
                }
            }
            olMap.getViewport().addEventListener('contextmenu', onContextMenu);
        }

        /**
         * @param {Array} features
         * @return {Array}
         */
        getMenuItemsForMultipleFeatures(features) {
            const self = this;
            let items = [];

            features.forEach(function(feature) {
                const featureItems = self.getMenuItems(feature);

                if (featureItems.length > 0) {
                    if (features.length > 1) {
                        items.push({ text: 'Feature ID: ' + feature.getId(), isHeader: true });
                    }
                    items = items.concat(featureItems);
                }
            });

            return items;
        }

        /**
         * @param {ol.Feature} feature
         * @return {Array}
         */
        getMenuItems(feature) {
            const items = [];
            const widget = this.widget;
            if (feature.get('dirty') && feature.get('oldGeometry') && !feature.get("editing")) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.revert.geometry'),
                    callback: function() {
                        widget.revertGeometry(feature);
                    }
                });
            }
            const schema = this.widget.getItemSchema(feature);
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
            if (this.widget._getUniqueItemId(feature) && schema && schema.allowDelete) {
                items.push({
                    text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                    callback: function () {
                        widget.removeData(schema, feature);
                    }
                });
            }
            return items;
        }

        /**
         * @param {Event} evt
         * @param {Array} pixel
         * @param {Array} items
         */
        showMenu(evt, pixel, items) {
            const self = this;
            evt.target.addEventListener('click', function(e) {
                self.closeMenu();
                evt.target.removeEventListener(e.type, this, false);
            });
            while (this.itemListElement_.lastChild) {
                this.itemListElement_.removeChild(this.itemListElement_.lastChild);
            }
            for (let i = 0; i < items.length; ++i) {
                const itemConfig = items[i];
                const itemNode = this.renderItem_(itemConfig);
                if (itemConfig.isHeader) {
                    itemNode.className += " menu-header";
                } else {
                    this.configureItemEvents_(itemNode, itemConfig);
                }
                this.itemListElement_.appendChild(itemNode);
            }
            this.menuElement_.className = this.cssClass;
            this.setMenuPosition_(this.menuElement_, pixel);
        }

        /**
         * @param {Object} itemConfig
         * @return {HTMLElement}
         * @private
         */
        renderItem_(itemConfig) {
            const li = document.createElement('li');
            li.innerText = itemConfig.text;
            if (itemConfig.isHeader) {
                li.className += " menu-header";
            }
            return li;
        }

        /**
         * @param {HTMLElement} element
         * @param {Object} itemConfig
         * @private
         */
        configureItemEvents_(element, itemConfig) {
            const callback = itemConfig.callback;
            if (callback) {
                const self = this;
                const wrapped = function(evt) {
                    evt.preventDefault();
                    self.closeMenu();
                    callback();
                };
                element.addEventListener('click', wrapped);
            }
        }

        closeMenu() {
            this.menuElement_.className = [this.cssClass, 'hidden'].join(' ');
        }

        /**
         * @param {HTMLElement} element
         * @param {Array} evtPixel
         * @private
         */
        setMenuPosition_(element, evtPixel) {
            const mapSize = this.olMap.getSize();
            const widthLeft = mapSize[0] - evtPixel[0];
            const menuWidth = element.offsetWidth;
            if (menuWidth >= widthLeft && menuWidth < evtPixel[0]) {
                element.style.right = '5px';
                element.style.left = 'auto';
            } else {
                element.style.right = 'auto';
                element.style.left = [evtPixel[0] + 5, 'px'].join('');
            }
            element.style.top = [evtPixel[1] + 5, 'px'].join('');
        }

        /**
         * @param {ol.Map} olMap
         * @private
         */
        initDom_(olMap) {
            this.menuElement_ = document.createElement('div');
            this.menuElement_.className = [this.cssClass, 'hidden'].join(' ');
            this.itemListElement_ = document.createElement('ul');
            this.menuElement_.appendChild(this.itemListElement_);
            this.menuParent_ = olMap.getOverlayContainerStopEvent();
            this.menuParent_.appendChild(this.menuElement_);
        }
    }

    Mapbender.Digitizer.MapContextMenu = MapContextMenu;
})();
