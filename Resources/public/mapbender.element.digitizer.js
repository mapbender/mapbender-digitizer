(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';

    $.widget("mapbender.mbDigitizer", $.mapbender.mbDataManager, {

        options: {
            classes: {},
            create: null,
            debug: false,
            fileURI: "uploads/featureTypes",
            schemes: {},
            target: null
        },
        mbMap: null,
        printClient: null,
        active: false,
        controlFactory: null,
        activeToolName_: null,

        _create: function () {
            this.toolsetRenderer = this._createToolsetRenderer();
            this._super();
            var widget = this;
            var target = this.options.target;
            this.styleEditor = this._createStyleEditor();
            this.wktFormat_ = new ol.format.WKT();
            Mapbender.elementRegistry.waitReady(target).then(function(mbMap) {
                widget.mbMap = mbMap;
                widget.setup();
                // Let data manager base method trigger "ready" event and start loading data
                widget._start();
            }, function() {
                Mapbender.checkTarget("mbDigitizer", target);
            });
        },
        _createTableRenderer: function() {
            return new Mapbender.Digitizer.TableRenderer(this);
        },
        _createToolsetRenderer: function() {
            return new Mapbender.Digitizer.Toolset(this);
        },
        _createStyleEditor: function() {
            return new Mapbender.Digitizer.FeatureStyleEditor(this);
        },
        _afterCreate: function() {
            // Invoked only by data manager _create
            // do nothing; deliberately do NOT call parent method
        },
        setup: function() {
            var self = this;
            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
                self.printClient = printClient;
                $.extend(self.printClient, Mapbender.Digitizer.printPlugin);
            });
            var olMap = this.mbMap.getModel().olMap;
            this.contextMenu = this._createContextMenu(olMap);
            this.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(olMap);
            if (this.options.displayOnInactive) {
                this.activate();
            }
            olMap.on(ol.MapEventType.MOVEEND, function() {
                // Don't react at all if currently editing feature attributes
                if (self.currentPopup || self.activeToolName_) {
                    return;
                }

                var schema = self._getCurrentSchema();
                var layer = self.getSchemaLayer(schema);
                var resolution = olMap.getView().getResolution();
                var $extentSearchCb = $('.schema-toolset input[name="current-extent"]', self.element);

                if (resolution > layer.getMaxResolution() || resolution < layer.getMinResolution()) {
                    self.tableRenderer.replaceRows(schema, []);
                } else if ($extentSearchCb.length && $extentSearchCb.prop('checked')) {
                    self._getData(schema);
                }
            });
            this.mbMap.element.on('mbmapsrschanged', function(event, data) {
                var schema = self._getCurrentSchema();
                if (schema.renderer) {
                    var source = schema.renderer.getLayer().getSource();
                    source.forEachFeature(/** @param {ol.Feature} feature */function(feature) {
                        var geometry = feature.getGeometry();
                        if (geometry) {
                            geometry.transform(data.from, data.to);
                        }
                    });
                }
            });
        },
        // reveal / hide = automatic sidepane integration API
        reveal: function() {
            this.activate();
        },
        hide: function() {
            this.deactivate();
        },
        _createContextMenu: function(olMap) {
            return new Mapbender.Digitizer.MapContextMenu(olMap, this);
        },
        _initializeEvents: function() {
            this._super();
            this.toolsetRenderer.registerEvents();
            var self = this;
            this.element.on('click', '.-fn-toggle-tool[data-toolname]', function() {
                var $button = $(this);
                var toolName = $button.attr('data-toolname');
                var schema = $button.data('schema');
                var oldState = $button.hasClass('active');
                if (!oldState) {
                    var $activeOthers = $button.siblings('.-fn-toggle-tool.active').not($button);
                    $activeOthers.each(function() {
                        var $other = $(this);
                        self._toggleDrawingTool(schema, $other.attr('data-toolname'), false);
                    });
                    $activeOthers.removeClass('active');
                }
                $button.toggleClass('active', !oldState);
                self._toggleDrawingTool(schema, toolName, !oldState);
            });
        },
        activate: function() {
            if (!this.active) {
                this._activateSchema(this._getCurrentSchema());
                this.active = true;
            }
        },
        deactivate: function() {
            this._deactivateSchema(this._getCurrentSchema());
            this.active = false;
        },
        _activateSchema: function(schema) {
            this._super(schema);
            // HACK: externally patch renderer onto schema post-construction
            if (!schema.renderer) {
                schema.renderer = new Mapbender.Digitizer.FeatureRenderer(this, this.mbMap.getModel().olMap, schema);
            }
            // HACK: externally patch editor onto schema post-construction
            if (schema.allowDigitize && !schema.geometryEditor) {
                schema.geometryEditor = new Mapbender.Digitizer.FeatureEditor(this, schema.renderer, this.controlFactory);
            }
            this.toolsetRenderer.setSchema(schema);
            this.contextMenu.setSchema(schema);
            this._toggleSchemaInteractions(schema, true);
            this.getSchemaLayer(schema).setVisible(true);
        },
        _toggleDrawingTool: function(schema, toolName, state) {
            schema.geometryEditor.toggleTool(toolName, schema, state);
            this.activeToolName_ = state && toolName || null;
            // Disable highlighting interaction when a tool is active.
            // For unknown reasons, the highlighting interaction breaks feature modification.
            // @todo: resolve dependency on monkey-patched schema.renderer property
            if (toolName === 'modifyFeature') {
                schema.renderer.highlightControl.setActive(!state);
            }
        },
        _deactivateSchema: function(schema) {
            this._super(schema);
            this._toggleSchemaInteractions(schema, false);
            if (!(this.options.displayOnInactive || schema.displayPermanent)) {
                this.getSchemaLayer(schema).setVisible(false);
            }
        },
        _toggleSchemaInteractions: function(schema, state) {
            if (schema.geometryEditor) {
                schema.geometryEditor.setActive(state);
            }
            schema.renderer.highlightControl.setActive(state);
            schema.renderer.selectControl.setActive(state && schema.allowEditData);
            if (state) {
                this.contextMenu.enable();
            } else {
                this.contextMenu.disable();
            }
        },
        _getDataStoreFromSchema: function(schema) {
            // Digitizer schema config aliases "dataStore" (upstream) as "featureType"
            return schema.featureType;
        },
        _updateToolset: function($container, schema) {
            this._super($container, schema);
            $('button', $container)
                // Resize buttons to btn-sm to fit our (potentially many) tool buttons
                .addClass('btn btn-sm')
            ;
        },
        _renderToolset: function(schema) {
            var dmToolset = $(this._super(schema)).get();   // force to array of nodes
            var nodes = [];
            nodes.push(this.toolsetRenderer.renderCurrentExtentSwitch(schema));
            nodes.push(this.toolsetRenderer.renderButtons(schema, dmToolset));
            return nodes;
        },
        _openEditDialog: function(schema, feature) {
            // Make feature visible in table when editing was started
            // from map click or context menu.
            // NOTE: newly created features are not in the table and cannot be paged to
            var tr = feature.get('table-row');
            if (tr) {
                this.tableRenderer.showRow(schema, tr);
            }
            var dialog = this._super(schema, feature);
            if (schema.geometryEditor) {
                schema.geometryEditor.pause();
            }
            return dialog;
        },
        _getEditDialogButtons: function(schema, feature) {
            var self = this;
            var buttons = [];
            if (schema.copy && schema.copy.enable) {
                buttons.push({
                    text: Mapbender.trans('mb.digitizer.feature.clone.title'),
                    click: function() {
                        self.cloneFeature(schema, feature);
                    }
                });
            }
            if (schema.allowCustomStyle) {
                buttons.push({
                    text: Mapbender.trans('mb.digitizer.feature.style.change'),
                    click: function() {
                        self.openStyleEditor(schema, feature);
                    }
                });
            }
            if (schema.printable && this.printClient) {
                var printClient = this.printClient;
                buttons.push({
                    text: Mapbender.trans('mb.digitizer.feature.print'),
                    click: function() {
                        printClient.printDigitizerFeature(feature, schema);
                    }
                });
            }
            buttons.push.apply(buttons, this._super(schema, feature));
            return buttons;
        },
        _getItemData: function(schema, feature) {
            // NOTE: 'data' property may not exist if feature has just been newly created by an editing tool
            if (!feature.get('data')) {
                feature.set('data', {});
            }
            return this._super(schema, feature.get('data'));
        },
        _getSelectRequestParams: function(schema) {
            var params = Object.assign({}, this._super(schema), {
                srid: this.getCurrentSrid()
            });
            var $extentSearchCb = $('.schema-toolset input[name="current-extent"]', this.element);
            if ($extentSearchCb.length && $extentSearchCb.prop('checked')) {
                params['extent'] = this.mbMap.getModel().getCurrentExtentArray().join(',');
            }
            return params;
        },
        _afterRemove: function(schema, feature, id) {
            var olMap = this.mbMap.getModel().olMap;
            this.getSchemaLayer(schema).getSource().removeFeature(feature);
            this._super(schema, feature, id);
            // Multi-Digitizer sync support
            $(olMap).trigger({type: "Digitizer.FeatureUpdatedOnServer", feature: feature});
        },
        _prepareDataItem: function(schema, itemData) {
            var renderer = schema.renderer;
            var feature = this.wktFormat_.readFeatureFromText(itemData.geometry);
            feature.set('data', itemData.properties || {});
            renderer.initializeFeature(schema, feature);
            return feature;
        },
        _afterSave: function(schema, feature, originalId, responseData) {
            // unravel dm-incompatible response format
            // Geometry may have been modified (made valid, transformed twice) on server roundtrip
            // => update to reflect server-side geometry exactly
            var geometry = this.wktFormat_.readGeometryFromText(responseData.dataItem.geometry);
            feature.setGeometry(geometry);

            this._super(schema, feature, originalId, {
                dataItem: responseData.dataItem.properties
            });
            feature.set('dirty', false);
            if (schema.geometryEditor) {
                schema.geometryEditor.resume();
            }
            var olMap = this.mbMap.getModel().olMap;
            $(olMap).trigger({type: "Digitizer.FeatureUpdatedOnServer", feature: feature});   // why?
        },
        _getData: function(schema) {
            var layer = this.getSchemaLayer(schema);
            return this._super(schema).then(function(features) {
                layer.getSource().clear();
                layer.getSource().addFeatures(features);
                return features;
            });
        },
        _cancelForm: function(schema, feature) {
            this._super(schema, feature);
            // NOTE: this also detects cloned features (via new copy functionality) as new
            var isNew = !this._getUniqueItemId(schema, feature);
            if (isNew) {
                this.getSchemaLayer(schema).getSource().removeFeature(feature);
            }
            // @todo: document new schema config value
            if (!isNew && schema.revertChangedGeometryOnCancel) {
                var oldGeometry = feature.get('oldGeometry');
                if (oldGeometry) {
                    feature.setGeometry(oldGeometry.clone());
                }
                feature.set('dirty', false);
            }
            if (schema.geometryEditor) {
                schema.geometryEditor.resume();
            }
        },
        _replaceItemData: function(schema, feature, newValues) {
            // NOTE: 'data' is a regular mutable data Object (see _prpareDataItem)
            this._super(schema, feature.get('data'), newValues);
        },
        _getSaveRequestData: function(schema, dataItem, newValues) {
            return {
                properties: Object.assign({}, this._getItemData(schema, dataItem), newValues || {}),
                geometry: this.wktFormat_.writeGeometryText(dataItem.getGeometry()),
                srid: this.getCurrentSrid()
            };
        },
        updateMultiple: function(schema, features) {
            var params = {
                schema: schema.schemaName
            };
            var postData = {
                srid: this.getCurrentSrid(),
                // generate mapping of id => properties and geometry
                features: {}
            };
            var featureMap = {};
            for (var i = 0; i < features.length; ++i) {
                var feature = features[i];
                var id = this._getUniqueItemId(schema, feature);
                featureMap[id] = feature;
                postData.features[id] = {
                    properties: this._getItemData(schema, feature),
                    geometry: this.wktFormat_.writeGeometryText(feature.getGeometry())
                };
            }
            var widget = this;
            var idProperty = this._getUniqueItemIdProperty(schema);
            this.postJSON('update-multiple?' + $.param(params), postData)
                .then(function(response) {
                    var savedItems = response.saved;
                    for (var i = 0; i < savedItems.length; ++i) {
                        var savedItem = savedItems[i];
                        var id = savedItem.properties[idProperty];
                        var feature = featureMap[id];

                        var geometry = widget.wktFormat_.readGeometryFromText(savedItem.geometry);
                        feature.setGeometry(geometry);
                        widget._replaceItemData(schema, feature, savedItem.properties || {});
                        feature.set('dirty', false);
                        widget.tableRenderer.refreshRow(schema, feature, false);
                    }
                    $.notify(Mapbender.trans('mb.data.store.save.successfully'), 'info');
                })
            ;
        },
        getSchemaLayer: function(schema) {
            // @todo: replace monkey-patched property access on schema
            return schema.renderer.getLayer();
        },
        cloneFeature: function(schema, feature) {
            var newFeature = feature.clone();
            var copyDefaults = schema.copy.data || {};
            var newAttributes = {};
            if (schema.copy.overwriteValuesWithDefault) {
                Object.assign(newAttributes, feature.get('data'), copyDefaults);
            } else {
                Object.assign(newAttributes, copyDefaults, feature.get('data'));
            }
            // clear id
            newAttributes[schema.featureType.uniqueId] = null;
            // @todo: Detect the first text-type attribute and prefix it with "Copy of"
            //        Digitizer has no direct knowledge of data columns and types
            //        All we have are table column and form item configuration
            newFeature.set('data', newAttributes);

            // Offset new geometry by ~3% the current (projected) viewport
            // This keeps the cloned geometry distinctly visible at any zoom level
            var extent = this.mbMap.getModel().getCurrentExtent();
            var cloneOffset = {
                h: Math.abs((extent.right - extent.left) / 32.),
                v: Math.abs((extent.top - extent.bottom) / 32.)
            };
            newFeature.getGeometry().translate(cloneOffset.h, cloneOffset.v);

            this.getSchemaLayer(schema).getSource().addFeature(newFeature);
            newFeature.set('dirty', true);

            this._openEditDialog(schema, newFeature);
        },
        /**
         * @return {number}
         */
        getCurrentSrid: function() {
            return parseInt(this.mbMap.getModel().getCurrentProjectionCode().replace(/^\w+:/, ''));
        },
        openStyleEditor: function(schema, feature) {
            var styleConfig = feature.get('basicStyle') || schema.styles.default;
            this.styleEditor.openEditor(schema, feature, styleConfig);
        },
        zoomToFeature: function(schema, feature) {
            Mapbender.Model.zoomToFeature(feature);
        },
        __formatting_dummy: null
    });

})(jQuery);
