(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';

    $.widget("mapbender.mbDigitizer", $.mapbender.mbDataManager, {

        options: {
            schemes: {}
        },
        mbMap: null,
        printClient: null,
        active: false,
        controlFactory: null,
        activeToolName_: null,
        selectControl: null,
        highlightControl: null,
        excludedFromHighlighting_: [],
        featureEditor: null,
        renderer: null,
        styleAdapter_: null,

        _create: function () {
            this.toolsetRenderer = this._createToolsetRenderer();
            this._super();
            var widget = this;
            this.styleAdapter_ = this._createStyleAdapter();
            this.styleEditor = this._createStyleEditor();
            this.wktFormat_ = new ol.format.WKT();
            Mapbender.elementRegistry.waitReady('.mb-element-map').then(function(mbMap) {
                widget.mbMap = mbMap;
                widget.setup();
                // Let data manager base method trigger "ready" event and start loading data
                widget._start();
            }, function() {
                Mapbender.checkTarget("mbDigitizer");
            });
        },
        _createTableRenderer: function() {
            return new Mapbender.Digitizer.TableRenderer(this, this.tableButtonsTemplate_);
        },
        _createToolsetRenderer: function() {
            return new Mapbender.Digitizer.Toolset(this);
        },
        _createStyleEditor: function() {
            return new Mapbender.Digitizer.FeatureStyleEditor(this);
        },
        _createStyleAdapter: function() {
            return new Mapbender.Digitizer.StyleAdapter(this.options.fallbackStyle);
        },
        _createRenderer: function(olMap) {
            return new Mapbender.Digitizer.FeatureRenderer(this, olMap, this.styleAdapter_);
        },
        _afterCreate: function() {
            // Invoked only by data manager _create
            // do nothing; deliberately do NOT call parent method
        },
        setup: function() {
            var self = this;
            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
                self.printClient = printClient;
            });
            var olMap = this.mbMap.getModel().olMap;
            this.contextMenu = this._createContextMenu(olMap);
            this.renderer = this._createRenderer(olMap);
            olMap.on(ol.MapEventType.MOVEEND, function() {
                // Don't react at all if currently editing feature attributes
                if (self.currentPopup || self.activeToolName_) {
                    return;
                }

                var schema = self._getCurrentSchema();
                if ($('input[name="current-extent"]', self.element).prop('checked')) {
                    self._getData(schema);
                }

                // @todo ml: filter table rows for min/max resolution (not just on moveend, but always)
                if (false) {
                    var layer = self.getSchemaLayer(schema);
                    var resolution = olMap.getView().getResolution();
                    if (resolution > layer.getMaxResolution() || resolution < layer.getMinResolution()) {
                        self.tableRenderer.replaceRows([]);
                    }
                }
            });
            this.mbMap.element.on('mbmapsrschanged', function(event, data) {
                self.featureEditor.pause();
                self.renderer.forAllFeatures(/** @param {ol.Feature} feature */function(feature) {
                    var geometry = feature.getGeometry();
                    if (geometry) {
                        geometry.transform(data.from, data.to);
                    }
                    if (feature.get('oldGeometry')) {
                        feature.get('oldGeometry').transform(data.from, data.to);
                    }
                });
                self.featureEditor.resume();
            });
            this.selectControl = this.createSelectControl_();
            this.highlightControl = this.createHighlightControl_();
            this.featureEditor = new Mapbender.Digitizer.FeatureEditor(this, olMap, this.controlFactory);
            olMap.addInteraction(this.selectControl);
            olMap.addInteraction(this.highlightControl);
            var initialSchema = this._getCurrentSchema();
            // @todo ml: evaluate displayPermanent
            this.renderer.toggleSchema(initialSchema, initialSchema.displayOnInactive && initialSchema.displayPermanent);
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
                var newState = !oldState;
                if (newState) {
                    var $activeOthers = $button.siblings('.-fn-toggle-tool.active').not($button);
                    $activeOthers.each(function() {
                        var $other = $(this);
                        var otherSchema = $other.data('schema');
                        self._toggleDrawingTool(otherSchema, $other.attr('data-toolname'), false);
                    });
                    $activeOthers.removeClass('active');
                }
                $button.toggleClass('active', newState);
                self._toggleDrawingTool(schema, toolName, newState);
            });
            this.element.on('change', 'input[name="current-extent"]', function() {
                self._getData(self._getCurrentSchema());
            });
            this.element.on('click', '.-fn-save-all', function() {
                self.updateMultiple(self.getSaveAllCandidates_());
            });
        },
        activate: function() {
            if (!this.active) {
                this.selectControl.setActive(true);
                this.highlightControl.setActive(true);
                var currentSchema = this._getCurrentSchema();
                this._toggleSchemaInteractions(currentSchema, true);
                var schemaNames = Object.keys(this.options.schemes);
                for (var s = 0; s < schemaNames.length; ++s) {
                    var schema = this.options.schemes[schemaNames[s]];
                    this.renderer.toggleSchema(schema, schema === currentSchema || schema.displayPermanent);
                }
                this.renderer.toggleSchema(currentSchema, true);
                this.active = true;
            }
        },
        deactivate: function() {
            this.selectControl.setActive(false);
            this.highlightControl.setActive(false);
            var currentSchema = this._getCurrentSchema();
            this._deactivateCommon(currentSchema);
            var schemaNames = Object.keys(this.options.schemes);
            for (var s = 0; s < schemaNames.length; ++s) {
                var schema = this.options.schemes[schemaNames[s]];
                this.renderer.toggleSchema(schema, schema === currentSchema && schema.displayOnInactive);
            }
            this._closeCurrentPopup();
            this.active = false;
        },
        _activateSchema: function(schema) {
            this._super(schema);
            this.contextMenu.setSchema(schema);
            this._toggleSchemaInteractions(schema, true);
            this.renderer.toggleSchema(schema, this.active || schema.displayOnInactive);
        },
        _toggleDrawingTool: function(schema, toolName, state) {
            if (!state && 'modifyFeature' === toolName) {
                this.featureEditor.setEditFeature(null);
                this.clearHighlightExclude_()
            }
            this.featureEditor.toggleTool(toolName, schema, state);
            this.activeToolName_ = state && toolName || null;
            this.resumeContextMenu_();
        },
        resumeContextMenu_: function() {
            var contextMenuAllowed = ['modifyFeature', 'moveFeature'];
            this.contextMenu.setActive(!this.activeToolName_ || -1 !== contextMenuAllowed.indexOf(this.activeToolName_));
        },
        commitGeometry: function(schema, feature) {
            feature.set("oldGeometry", feature.getGeometry().clone());
            feature.set('dirty', !this._getUniqueItemId(feature));
        },
        revertGeometry: function(feature) {
            feature.setGeometry(feature.get('oldGeometry').clone());
            feature.set('dirty', false);
        },
        /**
         * Called by both _deactivateSchema (schema selector switch) and deactivate (sidepane interaction)
         *
         * @param schema
         * @private
         */
        _deactivateCommon: function(schema) {
            this.featureEditor.setEditFeature(null);
            this.selectControl.getFeatures().clear();
            this._toggleSchemaInteractions(schema, false);
            if (schema === this._getCurrentSchema()) {
                $('.-fn-toggle-tool', this.element).removeClass('active');
                this.clearHighlightExclude_();
            }
        },
        /**
         * Called on schema selector change with the old schema
         * @param {Object} schema
         * @private
         */
        _deactivateSchema: function(schema) {
            this._super(schema);
            this._deactivateCommon(schema);
            this.renderer.toggleSchema(schema, schema.displayPermanent);
        },
        _toggleSchemaInteractions: function(schema, state) {
            if (schema.allowDigitize) {
                this.featureEditor.setActive(state);
            }
            if (!state) {
                if (this.activeToolName_) {
                    this.featureEditor.toggleTool(this.activeToolName_, schema, false);
                }
                this.activeToolName_ = null;
            }
            this.contextMenu.setActive(state);
        },
        _getDataStoreFromSchema: function(schema) {
            // Digitizer schema config aliases "dataStore" (upstream) as "featureType"
            return schema.featureType;
        },
        _updateToolset: function(schema) {
            this._super(schema);
            var $toolset = $('.toolset', this.element);
            $('input[name="current-extent"]', $toolset).prop('checked', schema.searchType === 'currentExtent');
            $('.btn-group', $toolset)
                // Resize buttons to btn-sm to fit our (potentially many) tool buttons
                .addClass('btn-group-sm')
            ;
            // Prevent top-level item creation
            // Unlinke DataManager, all item creation happens with a drawing tool,
            // and doesn't work when using pure form entry
            $('.-fn-create-item', $toolset).remove();
            var keepVisChange = false, keepSaveAll = false;
            var subSchemas = this.expandCombination(schema);
            for (var s = 0; s < subSchemas.length; ++s) {
                keepVisChange = keepVisChange || subSchemas[s].allowChangeVisibility;
                keepSaveAll = keepSaveAll || subSchemas[s].allowDigitize;
                if (keepVisChange && keepSaveAll) {
                    break;
                }
            }

            if (!keepVisChange) {
                $('.-fn-visibility-all', $toolset).remove();
            }
            if (!keepSaveAll) {
                $('.-fn-save-all', $toolset).remove();
            }
            var $geometryToolGroup = $('.-js-drawing-tools', $toolset);
            $geometryToolGroup.empty().append(this.toolsetRenderer.renderGeometryToolButtons(schema));
        },
        _openEditDialog: function(schema, feature) {
            // Make feature visible in table when editing was started
            // from map click or context menu.
            // NOTE: newly created features are not in the table and cannot be paged to
            var tr = feature.get('table-row');
            if (tr) {
                this.tableRenderer.showRow(tr);
            }
            var dialog = this._super(schema, feature);
            // Disable context menu interactions with other features only if the current item is new
            // Exiting the form by switching to a different feature would leave the new, unsaved feature in limbo
            if (!this._getUniqueItemId(feature)) {
                this.contextMenu.setActive(false);
            }
            this._initColorpickers(dialog);
            this.toolsetRenderer.pause();
            if (schema.allowDigitize) {
                this.featureEditor.pause();
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
                        var data = self._getItemData(feature);
                        var templates = (schema.featureType.print || {}).templates || null;
                        printClient.printDigitizerFeature(data, schema, templates);
                    }
                });
            }
            buttons.push.apply(buttons, this._super(schema, feature));
            return buttons;
        },
        _getItemData: function(feature) {
            // NOTE: 'data' property may not exist if feature has just been newly created by an editing tool
            if (!feature.get('data')) {
                feature.set('data', {});
            }
            return feature.get('data');
        },
        _getSelectRequestParams: function(schema) {
            var params = Object.assign({}, this._super(schema), {
                srid: this.getCurrentSrid()
            });
            if ($('input[name="current-extent"]', this.element).prop('checked')) {
                params['extent'] = this.mbMap.getModel().getCurrentExtentArray().join(',');
            }
            return params;
        },
        _afterRemove: function(schema, feature, id) {
            this.renderer.removeFeature(feature);
            this._super(schema, feature, id);
        },

        _prepareDataItem: function(itemData) {
            var feature = this.wktFormat_.readFeatureFromText(itemData.geometry);
            feature.set('data', itemData.properties || {});
            feature.set('schemaName', itemData.schemaName);
            var itemSchema = this.options.schemes[itemData.schemaName];
            feature.set('uniqueIdProperty', this._getUniqueItemIdProperty(itemSchema));
            var id = this._generateNamespacedId(itemSchema, feature);
            feature.setId(id);
            var schemaSource = this.getSchemaLayer(itemSchema).getSource();
            var existingFeature = schemaSource.getFeatureById(id);
            if (existingFeature && existingFeature.get('dirty')) {
                // Keep & reuse existing feature that has been modified in the current session
                return existingFeature;
            } else {
                this.commitGeometry(itemSchema, feature);
                this.renderer.initializeFeature(itemSchema, feature);
                return feature;
            }
        },
        _getUniqueItemId: function(feature) {
            return (feature.get('data') || {})[feature.get('uniqueIdProperty')] || null;
        },
        getItemSchema: function(feature) {
            return this.options.schemes[feature.get('schemaName')];
        },
        getEnabledSchemaFunctionCodes: function(schema) {
            var codes = this._superApply(arguments);
            codes = codes.concat([
                schema.allowDigitize && '-fn-save',
                schema.copy && schema.copy.enable && '-fn-copy',
                schema.allowCustomStyle && '-fn-edit-style',
                schema.allowChangeVisibility && '-fn-toggle-visibility'
            ]);
            return codes.filter(function(x) { return !!x; });
        },
        initializeNewFeature: function(itemSchema, feature) {
            feature.set('schemaName', itemSchema.schemaName);
            feature.set('uniqueIdProperty', this._getUniqueItemIdProperty(itemSchema));
            this.renderer.initializeFeature(itemSchema, feature);
            feature.set('dirty', true);
        },
        /**
         * Return a globally unique feature id (unique even if features from multiple schemas appear on the same layer)
         *
         * @param {Object} schema
         * @param {ol.Feature} feature
         * @return {string}
         * @private
         */
        _generateNamespacedId: function(schema, feature) {
            return [this.element.attr('id'), schema.schemaName, this._getUniqueItemId(feature)].join('-');
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
            if (!feature.getId()) {
                feature.setId(this._generateNamespacedId(schema, feature));
            }
            this.commitGeometry(schema, feature);
            this.selectControl.getFeatures().clear();
            if (schema.allowDigitize) {
                this.featureEditor.setEditFeature(null);
                if (!schema.continueDrawingAfterSave && this.activeToolName_) {
                    this._toggleDrawingTool(schema, this.activeToolName_, false);
                    $('.-fn-toggle-tool', this.element).removeClass('active');
                }
                this.featureEditor.resume();
            }
            this.toolsetRenderer.resume();
            this.resumeContextMenu_();
        },
        _getData: function(schema) {
            var self = this;
            return this._super(schema).then(function(features) {
                var modifiedFeatures = self.renderer.filterFeatures(schema, function(feature) {
                    return feature.get('dirty');
                });
                self.renderer.replaceFeatures(schema, features);
                // Re-add unsaved features from current session
                var unsaved = self.renderer.addFeatures(modifiedFeatures, function(layer, feature) {
                    return !layer.getSource().getFeatureById(feature.getId());
                });
                return features.concat(unsaved);
            });
        },
        _cancelForm: function(schema, feature) {
            this._super(schema, feature);
            // NOTE: this also detects cloned features (via new copy functionality) as new
            var isNew = !this._getUniqueItemId(feature);
            if (isNew) {
                this.renderer.removeFeature(schema, feature);
            }
            this.toolsetRenderer.resume();
            if (schema.allowDigitize) {
                this.featureEditor.resume();
            }
            this.resumeContextMenu_();
        },
        _replaceItemData: function(schema, feature, newValues) {
            // NOTE: 'data' is a regular mutable data Object (see _prpareDataItem)
            Object.assign(feature.get('data'), newValues);
        },
        _getSaveRequestData: function(schema, dataItem, newValues) {
            return Object.assign(this._superApply(arguments), {
                geometry: this.wktFormat_.writeGeometryText(dataItem.getGeometry()),
                srid: this.getCurrentSrid()
            });
        },
        updateMultiple: function(features) {
            var postData = {
                srid: this.getCurrentSrid(),
                // generate mapping of id => properties and geometry
                features: []
            };
            var featureMap = {};
            for (var i = 0; i < features.length; ++i) {
                var feature = features[i];
                var itemSchema = this.getItemSchema(feature);
                var mapId = this._generateNamespacedId(itemSchema, feature);
                featureMap[mapId] = feature;
                postData.features.push({
                    schemaName: itemSchema.schemaName,
                    idInSchema: this._getUniqueItemId(feature),
                    uniqueId: mapId,
                    properties: this._getItemData(feature),
                    geometry: this.wktFormat_.writeGeometryText(feature.getGeometry())
                });
            }
            var widget = this;
            var promise = this.postJSON('update-multiple', postData)
                .then(function(response) {
                    var savedItems = response.saved;
                    for (var i = 0; i < savedItems.length; ++i) {
                        var savedItem = savedItems[i];
                        var itemSchema = widget.options.schemes[savedItem.schemaName];
                        var feature = featureMap[savedItem.uniqueId];

                        var geometry = widget.wktFormat_.readGeometryFromText(savedItem.geometry);
                        feature.setGeometry(geometry);
                        widget._replaceItemData(itemSchema, feature, savedItem.properties || {});
                        feature.set('dirty', false);
                        widget.tableRenderer.refreshRow(feature, false);
                    }
                    $.notify(Mapbender.trans('mb.data.store.save.successfully'), 'info');
                })
            ;
            // @todo ml: find a reasonable continueDrawingAfterSave policy for combination schema
            if (!schema.continueDrawingAfterSave) {
                promise.always(function() {
                    if (widget.activeToolName_) {
                        widget._toggleDrawingTool(schema, widget.activeToolName_, false);
                    }
                    $('.-fn-toggle-tool', widget.element).removeClass('active');
                });
            }
        },
        updateSaveAll: function() {
            var $saveAllButton = $('.-fn-save-all', this.element);
            var candidates = $saveAllButton.length && this.getSaveAllCandidates_() || [];
            $saveAllButton.prop('disabled', !candidates.length);
        },
        getSaveAllCandidates_: function() {
            var self = this;
            return this.renderer.filterFeatures(this._getCurrentSchema(), function(feature) {
                return self._getUniqueItemId(feature)
                    && feature.get('dirty')
                    && self.getItemSchema(feature).allowDigitize;
            });
        },
        getSchemaLayers: function(schema) {
            return this.renderer.getLayers(schema);
        },
        getSchemaLayer: function(schema) {
            if (schema.combine) {
                throw new Error("Cannot get single layer for combination schema");
            }
            return this.getSchemaLayers(schema)[0];
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
         * @param {ol.Feature|null} feature
         */
        onFeatureClick: function(feature) {
            var itemSchema = this.getItemSchema(feature);
            if (feature && !this.activeToolName_) {
                this._openEditDialog(itemSchema, feature);
            } else if (!this.currentPopup && 'modifyFeature' === this.activeToolName_) {
                // Disable hover highlighting on the feature currently selected for editing. The generated style updates break
                // usability (can't pull vertices outward).
                this.clearHighlightExclude_();
                if (feature && itemSchema.allowDigitize) {
                    this.excludedFromHighlighting_.push(feature);
                    this.featureEditor.setEditFeature(feature);
                } else {
                    this.featureEditor.setEditFeature(null);
                }
                this.selectControl.getFeatures().clear();
                var tr = feature && feature.get('table-row');
                if (tr) {
                    this.tableRenderer.showRow(tr);
                }
            }
        },
        /**
         * @return {number}
         */
        getCurrentSrid: function() {
            return parseInt(this.mbMap.getModel().getCurrentProjectionCode().replace(/^\w+:/, ''));
        },
        openStyleEditor: function(schema, feature) {
            var self = this;
            // Generate default style without placeholders...
            var styleDefaults = this.renderer.resolveStyleConfigPlaceholders(schema.styles.default, feature);
            // ... but allow label placeholder (editable as text)
            styleDefaults.label = schema.styles.default.label;

            var styleConfig = feature.get('customStyleConfig') || styleDefaults;
            this.styleEditor.openEditor(schema, feature, styleConfig).then(function(values) {
                // @todo: decouple from feature saving; use a distinct url to save the style
                var formData = {};
                var styleFieldData = JSON.stringify(values);
                formData[schema.featureType.styleField] = styleFieldData;
                self._saveItem(schema, feature, formData).then(function() {
                    feature.set('customStyleConfig', styleFieldData);
                    self.renderer.customStyleFeature_(feature);
                });
            });
        },
        zoomToFeature: function(schema, feature) {
            Mapbender.Model.zoomToFeature(feature);
        },
        _getEditDialogPopupConfig: function(schema, dataItem) {
            var options = this._superApply(arguments);
            if (!(schema.popup || {}).title && schema.allowEdit) {
                options.title = Mapbender.trans('mb.digitizer.edit.attributes');
            }
            return options;
        },
        createSelectControl_: function() {
            var self = this;
            var selectControl = new ol.interaction.Select({
                condition: ol.events.condition.singleClick,
                layers: function(layer) {
                    var schema = self._getCurrentSchema();
                    var activeLayers = schema && self.getSchemaLayers(schema) || [];
                    return -1 !== activeLayers.indexOf(layer);
                },
                style: null
            });

            selectControl.on('select', function (event) {
                // Prevent interaction from filtering out the same feature if we click on it again before doing
                // anything else.
                /** @see https://github.com/openlayers/openlayers/blob/v6.4.3/src/ol/interaction/Select.js#L469 */
                this.features_.clear();
                self.onFeatureClick(event.selected[0] || null);
            });
            return selectControl;
        },
        createHighlightControl_: function() {
            var self = this;
            var highlightControl = new ol.interaction.Select({
                condition: ol.events.condition.pointerMove,
                layers: function(layer) {
                    var schema = self._getCurrentSchema();
                    var activeLayers = schema && self.getSchemaLayers(schema) || [];
                    return -1 !== activeLayers.indexOf(layer);
                },
                filter: function(feature) {
                    return -1 === self.excludedFromHighlighting_.indexOf(feature);
                }
            });

            highlightControl.on('select', function (e) {
                e.deselected.forEach(function(feature) {
                    feature.set('hover', false);
                });
                e.selected.forEach(function(feature) {
                    feature.set('hover', true);
                });
            });
            return highlightControl;
        },
        clearHighlightExclude_: function() {
            this.excludedFromHighlighting_.splice(0, this.excludedFromHighlighting_.length);
        },
        _processFormItem: function(schema, item, values) {
            switch (item.type) {
                default:
                    return this._super(schema, item, values);
                case 'colorPicker':
                    return Object.assign({}, item, {
                        type: 'input',
                        cssClass: [item.cssClass || '', '-js-colorpicker'].join(' ').replace(/^\s+/, '')
                    });
            }
        },
        _initColorpickers: function(scope) {
            $('.-js-colorpicker', scope).each(function() {
                var $cpInput = $(this).is('input') ? this : $('input', this);
                var $inputGroup = $(document.createElement('div'))
                    .addClass('input-group colorpicker-component')
                    .append($cpInput.clone())
                    .append($('<span class="input-group-addon"><i></i></span>'))
                ;
                $cpInput.replaceWith($inputGroup);
                $inputGroup.colorpicker({format: 'hex'})
            });
        },
        __formatting_dummy: null
    });

})(jQuery);
