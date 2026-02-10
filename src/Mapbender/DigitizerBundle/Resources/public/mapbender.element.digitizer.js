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
        activeTool_: null,
        selectControl: null,
        highlightControl: null,
        excludedFromHighlighting_: [],
        featureEditor: null,
        renderer: null,
        extentSearchFlags_: {},
        queuedRefresh_: {},

        _create: function () {
            // NOTE: Arrays / Objects in ui widget prototype are shared
            // between instances. Separate them
            this.excludedFromHighlighting_ = [];
            this.extentSearchFlags_ = {};
            this.queuedRefresh_ = {};
            this.toolsetRenderer = this._createToolsetRenderer();
            this._super();
            this.styleEditor = this._createStyleEditor();
            this.wktFormat_ = new ol.format.WKT();
            // setup() called in onGrantsLoadStarted
        },
        _createTableRenderer: function() {
            return new Mapbender.Digitizer.TableRenderer(this, this.tableButtonsTemplate_);
        },
        _createToolsetRenderer: function() {
            return new Mapbender.Digitizer.Toolset(this);
        },
        _createStyleEditor: function() {
            return new Mapbender.Digitizer.FeatureStyleEditor(this, this.dialogFactory_);
        },
        createStyleAdapter: function() {
            return new Mapbender.Digitizer.StyleAdapter(this.options.fallbackStyle);
        },
        _createRenderer: function(olMap) {
            return new Mapbender.Digitizer.FeatureRenderer(this, olMap);
        },
        _createFeatureEditor: function(olMap) {
            return new Mapbender.Digitizer.FeatureEditor(this, olMap);
        },
        _afterCreate: function() {
            // Invoked only by data manager _create
            // do nothing; deliberately do NOT call parent method
        },
        onGrantsLoadStarted: function() {
            $.when(Mapbender.elementRegistry.waitReady('.mb-element-map'), this.grantsRequest_)
                .then((mbMap) => this._onMapAndGrantsLoaded(mbMap));
        },
        _onMapAndGrantsLoaded: function (mbMap) {
            this.mbMap = mbMap;
            this.setup();
            // Let data manager base method trigger "ready" event and start loading data
            this._start();
            this.registerMapEvents_();
        },
        setup: function() {
            var self = this;
            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
                self.printClient = printClient;
            });
            var olMap = this.mbMap.getModel().olMap;
            this.contextMenu = this._createContextMenu(olMap);
            this.renderer = this._createRenderer(olMap);
            this.selectControl = this.createSelectControl_();
            this.highlightControl = this.createHighlightControl_();
            this.featureEditor = this._createFeatureEditor(olMap);
            olMap.addInteraction(this.selectControl);
            olMap.addInteraction(this.highlightControl);
            var initialSchema = this._getCurrentSchema();
            // @todo ml: evaluate displayPermanent
            this.renderer.toggleSchema(initialSchema, initialSchema.displayOnInactive && initialSchema.displayPermanent);
        },
        skipInitialData_: function() {
            // Digitizer only: allow permanently invisible "headless" Digitizer to load / render features normally
            return false;
        },
        registerMapEvents_: function() {
            var self = this;
            var olMap = this.mbMap.getModel().olMap;
            olMap.on(ol.MapEventType.MOVEEND, function() {
                // Don't react at all if currently editing feature attributes
                if (self.currentPopup || self.activeTool_) {
                    return;
                }

                var schema = self._getCurrentSchema();
                if (self.extentSearchFlags_[schema.schemaName]) {
                    if (self.active || schema.displayOnInactive) {
                        self._getData(schema);
                    } else {
                        self.queuedRefresh_[schema.schemaName] = true;
                    }
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
                var schema = self._getCurrentSchema();
                self.extentSearchFlags_[schema.schemaName] = $(this).prop('checked');
                self._getData(schema);
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
                if (this.queuedRefresh_[currentSchema.schemaName]) {
                    this._getData(currentSchema);
                }
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
        _closeCurrentPopup: function() {
            if (this.currentPopup) {
                var feature = this.currentPopup.data('item');
                var itemSchema = this.currentPopup.data('schema');
                if (!feature.getId()) {
                    this.renderer.removeFeature(itemSchema, feature);
                }
            }
            return this._superApply(arguments);
        },
        _activateSchema: function(schema) {
            this._super(schema);
            this._toggleSchemaInteractions(schema, true);
            this.renderer.toggleSchema(schema, this.active || schema.displayOnInactive);
        },
        _toggleDrawingTool: function(schema, toolName, state) {
            if (!state && 'modifyFeature' === toolName) {
                this.featureEditor.setEditFeature(null);
                this.clearHighlightExclude_()
            }
            this.featureEditor.toggleTool(toolName, schema, state);
            this.activeTool_ = state && {name: toolName, schema: schema} || null;
            this.resumeContextMenu_();
        },
        resumeContextMenu_: function() {
            var contextMenuAllowed = ['modifyFeature', 'moveFeature'];
            this.contextMenu.setActive(!this.activeTool_ || -1 !== contextMenuAllowed.indexOf(this.activeTool_.name));
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
            var subSchemas = this.expandCombination(schema);
            var allowFeatureEditing = false;
            for (var s = 0; s < subSchemas.length; ++s) {
                allowFeatureEditing = allowFeatureEditing || state && subSchemas[s].allowDigitize;
            }
            if (!state && this.activeTool_) {
                this.featureEditor.toggleTool(this.activeTool_.name, this.activeTool_.schema, false);
                this.activeTool_ = null;
            }
            this.featureEditor.setActive(allowFeatureEditing);
            this.contextMenu.setActive(state);
        },
        _getDataStoreFromSchema: function(schema) {
            // Digitizer schema config aliases "dataStore" (upstream) as "featureType"
            return schema.featureType;
        },
        _updateToolset: function(schema) {
            this._super(schema);
            var $toolset = $('.toolset', this.element);
            if (typeof (this.extentSearchFlags_[schema.schemaName]) === 'undefined') {
                this.extentSearchFlags_[schema.schemaName] = schema.searchType === 'currentExtent';
            }
            $('input[name="current-extent"]', $toolset).prop('checked', this.extentSearchFlags_[schema.schemaName]);
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
                keepSaveAll = keepSaveAll || (subSchemas[s].allowDigitize && subSchemas[s].allowEdit);
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
            this.toolsetRenderer.pause();
            if (schema.allowDigitize) {
                this.featureEditor.pause();
            }
            return dialog;
        },
        _getEditDialogButtons: function(schema, feature) {
            var self = this;
            var buttons = [];
            if (schema.copy && schema.copy.enable && this._getUniqueItemId(feature)) {
                buttons.push({
                    text: Mapbender.trans('mb.digitizer.feature.clone.title'),
                    title: Mapbender.trans('mb.digitizer.feature.clone.tooltip'),
                    class: 'btn btn-light',
                    click: function() {
                        self.cloneFeature(schema, feature);
                    }
                });
            }
            if (schema.allowCustomStyle) {
                buttons.push({
                    text: Mapbender.trans('mb.digitizer.feature.style.change'),
                    title: Mapbender.trans('mb.digitizer.feature.style.change_tooltip'),
                    class: 'btn btn-light',
                    click: function() {
                        self.openStyleEditor(schema, feature);
                    }
                });
            }
            if (schema.printable && this.printClient) {
                var printClient = this.printClient;
                buttons.push({
                    text: Mapbender.trans('mb.digitizer.feature.print'),
                    title: Mapbender.trans('mb.digitizer.feature.print_tooltip'),
                    class: 'btn btn-light',
                    click: function() {
                        var data = self._getItemData(feature);
                        var templates = (schema.featureType.print || {}).templates || null;
                        printClient.printDigitizerFeature(data, schema, templates);
                    }
                });
            }
            const overrideShowSaveButton = !this._getUniqueItemId(feature) && schema.allowCreate;
            buttons.push.apply(buttons, this._super(schema, feature, overrideShowSaveButton));
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
            if (this.extentSearchFlags_[schema.schemaName]) {
                params['extent'] = this.mbMap.getModel().getCurrentExtentArray().join(',');
            }
            return params;
        },
        _afterRemove: function(schema, feature, id) {
            this.renderer.removeFeature(schema, feature);
            this._super(schema, feature, id);
            this.toolsetRenderer.resume();
            if (schema.allowDigitize) {
                this.featureEditor.resume();
            }
            this.resumeContextMenu_();
            this.checkSourceRefresh_(schema);
        },

        _prepareDataItem: function(itemData) {
            var feature = this.wktFormat_.readFeatureFromText(itemData.geometry);
            feature.set('data', itemData.properties || {});
            feature.set('schemaName', itemData.schemaName);
            var itemSchema = this.options.schemes[itemData.schemaName];
            feature.set('uniqueIdProperty', this._getUniqueItemIdProperty(itemSchema));
            var id = this._generateNamespacedId(itemSchema, feature);
            var existingFeature = this.renderer.getFeatureById(id, itemSchema);
            if (existingFeature && existingFeature.get('dirty')) {
                // Keep & reuse existing feature that has been modified in the current session
                return existingFeature;
            } else {
                feature.setId(id);
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
                schema.allowDigitize && schema.allowEdit && '-fn-save',
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
        _generateNamespacedId: function(schema, feature, index = null) {
            return [this.element.attr('id'), schema.schemaName, this._getUniqueItemId(feature), ...(index !== null ? [index] : [])].join('-');
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
                if (!schema.continueDrawingAfterSave && this.activeTool_) {
                    this._toggleDrawingTool(schema, this.activeTool_.name, false);
                    $('.-fn-toggle-tool', this.element).removeClass('active');
                }
                this.featureEditor.resume();
            }
            this.toolsetRenderer.resume();
            this.resumeContextMenu_();
            this.checkSourceRefresh_(schema);
            this.adjustStyle(schema,feature);
        },

        _getData: function(schema) {
            this.queuedRefresh_[schema.schemaName] = false;
            var self = this;
            return this._super(schema).then(function(features) {
                self.queuedRefresh_[schema.schemaName] = false;
                self.renderer.replaceFeatures(schema, features);
                return features;
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
            var continueDrawing = false;
            for (var i = 0; i < features.length; ++i) {
                var feature = features[i];
                var itemSchema = this.getItemSchema(feature);
                continueDrawing = continueDrawing || itemSchema.continueDrawingAfterSave;
                var mapId = this._generateNamespacedId(itemSchema, feature, i);
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
            var promise = this.postJSON('update-multiple', postData, undefined,(response) => {
                    var savedItems = response.saved;
                    for (var i = 0; i < savedItems.length; ++i) {
                        var savedItem = savedItems[i];
                        var itemSchema = widget.options.schemes[savedItem.schemaName];
                        var feature = featureMap[savedItem.uniqueId];

                        var geometry = widget.wktFormat_.readGeometryFromText(savedItem.geometry);
                        feature.setGeometry(geometry);
                        widget._replaceItemData(itemSchema, feature, savedItem.properties || {});
                        feature.set('dirty', false);
                        feature.set('oldGeometry', geometry);
                        widget.tableRenderer.addOrRefreshRow(feature, true);
                        widget._saveEvent(itemSchema, feature, widget._getUniqueItemId(feature));
                    }
                    $.notify(Mapbender.trans('mb.data.store.save.successfully'), 'info');
                })
            ;
            // @todo ml: find a reasonable continueDrawingAfterSave policy for combination schema
            if (!continueDrawing) {
                promise.always(function() {
                    if (widget.activeTool_) {
                        widget._toggleDrawingTool(widget.activeTool_.schema, widget.activeTool_.name, false);
                    }
                    $('.-fn-toggle-tool', widget.element).removeClass('active');
                });
            }

            return promise;
        },
        updateSaveAll: function() {
            var $saveAllButton = $('.-fn-save-all', this.element);
            var candidates = $saveAllButton.length && this.getSaveAllCandidates_() || [];
            $saveAllButton.prop('disabled', !candidates.length);
            if (candidates.length) {
                $saveAllButton.removeClass('btn-outline-primary');
                $saveAllButton.addClass('btn-primary');
            } else {
                $saveAllButton.removeClass('btn-primary');
                $saveAllButton.addClass('btn-outline-primary');
            }
        },
        getSaveAllCandidates_: function() {
            var self = this;
            return this.renderer.filterFeatures(this._getCurrentSchema(), function(feature) {
                return self._getUniqueItemId(feature)
                    && feature.get('dirty')
                    && self.getItemSchema(feature).allowDigitize;
            });
        },
        /**
         * @param {*} schema
         * @returns {Array<ol.layer.Vector>}
         */
        getSnappingLayers: function(schema) {
            let olMap = this.mbMap.getModel().olMap;
            let layers = olMap.getAllLayers().filter(layer => layer instanceof ol.layer.Vector);
            return this.getSchemaLayers(schema).concat(layers);
        },
        /**
         * @param {*} schema
         * @returns {Array<ol.layer.Vector>}
         */
        getSchemaLayers: function(schema) {
            return this.renderer.getLayers(schema);
        },
        /**
         * @param {*} schema
         * @returns {ol.layer.Vector|undefined}
         * @deprecated use getSchemaLayers for proper multi-layer support
         */
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
            if (!schema.copy.deactivateOffset) {
                var cloneOffset = {
                    h: Math.abs((extent.right - extent.left) / 32.),
                    v: Math.abs((extent.top - extent.bottom) / 32.)
                };
                newFeature.getGeometry().translate(cloneOffset.h, cloneOffset.v);
            }
            newFeature.set('dirty', true);

            this.renderer.addFeatures([newFeature]);

            this._openEditDialog(schema, newFeature);
        },
        /**
         * @param {ol.Feature|null} feature
         */
        onFeatureClick: function(feature) {
            var itemSchema = this.getItemSchema(feature);
            if (feature && !this.activeTool_) {
                this._openEditDialog(itemSchema, feature);
            } else if (!this.currentPopup && 'modifyFeature' === this.activeTool_.name) {
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
            var styleConfig = feature.get('customStyleConfig');
            if (!styleConfig) {
                var defaults = this.getInitialCustomStyle_(schema, feature);
                // Resolve any placeholders ...
                styleConfig = this.renderer.resolveStyleConfigPlaceholders(defaults, feature);
                // ... but allow label placeholder (editable as text)
                styleConfig.label = defaults.label || '';
            }

            this.styleEditor.openEditor(schema, feature, styleConfig).then(function(values) {
                var styleFieldData = JSON.stringify(values);
                function always() {
                    feature.get('data')[schema.featureType.styleField] = styleFieldData;
                    self.renderer.customStyleFeature_(feature);
                }
                if (self._getUniqueItemId(feature)) {
                    var formData = {};
                    formData[schema.featureType.styleField] = styleFieldData;
                    self._saveItem(schema, feature, formData).then(function() {
                        always();
                    });
                } else {
                    always();
                }
            });
        },
        zoomToFeature: function(schema, feature) {
            Mapbender.Model.zoomToFeature(feature, { buffer: schema.zoomBuffer || 10 });
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
                    // Avoid excessive property updates to reduce layer re-rendering
                    if (feature.get('hover')) {
                        feature.set('hover', false);
                    }
                });
                e.selected.forEach(function(feature) {
                    // Avoid excessive property updates to reduce layer re-rendering
                    // Styling for editing / hidden states takes priority over hover,
                    // allowing a sake skip of the hover style update
                    if (!feature.get('editing') || !feature.get('hidden')) {
                        feature.set('hover', true);
                    }
                });
            });
            return highlightControl;
        },
        clearHighlightExclude_: function() {
            this.excludedFromHighlighting_.splice(0, this.excludedFromHighlighting_.length);
        },
        checkSourceRefresh_: function(schema) {
            var sourceIds = schema.refreshLayersAfterFeatureSave || [];
            if (sourceIds && !Array.isArray(sourceIds)) {
                sourceIds = [sourceIds];
            }
            for (var i = 0; i < sourceIds.length; ++i) {
                var source = this.mbMap.getModel().getSourceById(sourceIds[i]);
                if (!source) {
                    if (!this.mbMap.getModel().findSourceAndLayerIdByName) {
                        console.warn("Method findSourceAndLayerIdByName not available - consider Mapbender upgrade");
                    } else {
                        let ids = this.mbMap.getModel().findSourceAndLayerIdByName(sourceIds[i]);
                        let sourceId = ids.sourceId;
                        source = sourceId && this.mbMap.getModel().getSourceById(sourceId);
                    }
                }
                if (source) {
                    if (typeof (source.refresh) === 'function') {
                        source.refresh();
                    } else {
                        source.addParams({_OLSALT: Math.random()});
                    }
                } else {
                    console.warn("Could not find source with id " + sourceIds[i] + " for refresh");
                }
            }
        },
        getInitialCustomStyle_: function(schema, feature) {
            return schema.styles.default;
        },

        // Empty method for overriding purpose
        adjustStyle: function(schema, feature) {

        },
        __formatting_dummy: null
    });

})(jQuery);
