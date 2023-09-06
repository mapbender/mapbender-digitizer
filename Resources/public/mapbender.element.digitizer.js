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
            var target = this.options.target;
            this.styleAdapter_ = this._createStyleAdapter();
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
            this.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory();
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
                    // den tableRenderer erst nach initialem getData anfassen um das hier zu verhindern:
                    //Uncaught Error: Cannot access dataTables instance for schema $schemaName. Table not in DOM?
                    //self.tableRenderer.replaceRows(schema, []);
                } else if ($extentSearchCb.length && $extentSearchCb.prop('checked')) {
                    console.log(2);
                    self._getData(schema);
                }
            });
            this.mbMap.element.on('mbmapsrschanged', function(event, data) {
                self.featureEditor.pause();
                var schema = self._getCurrentSchema();
                var layer = schema && self.getSchemaLayer(schema);
                if (layer) {
                    layer.getSource().forEachFeature(/** @param {ol.Feature} feature */function(feature) {
                        var geometry = feature.getGeometry();
                        if (geometry) {
                            geometry.transform(data.from, data.to);
                        }
                        if (feature.get('oldGeometry')) {
                            feature.get('oldGeometry').transform(data.from, data.to);
                        }
                    });
                }
                self.featureEditor.resume();
            });
            this.selectControl = this.createSelectControl_();
            this.highlightControl = this.createHighlightControl_();
            this.featureEditor = new Mapbender.Digitizer.FeatureEditor(this, olMap, this.controlFactory);
            olMap.addInteraction(this.selectControl);
            olMap.addInteraction(this.highlightControl);
            var initialSchema = this._getCurrentSchema();
            this._setSchemaVisible(initialSchema, initialSchema.displayOnInactive && initialSchema.displayPermanent);
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
                        self._toggleDrawingTool(schema, $other.attr('data-toolname'), false);
                    });
                    $activeOthers.removeClass('active');
                }
                $button.toggleClass('active', newState);
                self._toggleDrawingTool(schema, toolName, newState);
            });
        },
        _setSchemaVisible: function(schema, state) {
            this.getSchemaLayer(schema).setVisible(!!state);
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
                    this._setSchemaVisible(schema, schema === currentSchema || schema.displayPermanent);
                }
                this._setSchemaVisible(currentSchema, true);
                this.active = true;
                this._getData(currentSchema);
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
                this._setSchemaVisible(schema, schema === currentSchema && schema.displayOnInactive);
            }
            this._closeCurrentPopup();
            this.active = false;
        },
        _activateSchema: function(schema) {
            this._super(schema);
            this.toolsetRenderer.setSchema(schema);
            this.contextMenu.setSchema(schema);
            this._toggleSchemaInteractions(schema, true);
            this._setSchemaVisible(schema, this.active || schema.displayOnInactive);
            this._updateFormItems(schema);
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
            feature.set('dirty', !this._getUniqueItemId(schema, feature));
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
            this._setSchemaVisible(schema, schema.displayPermanent);
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
            // Disable context menu interactions with other features only if the current item is new
            // Exiting the form by switching to a different feature would leave the new, unsaved feature in limbo
            if (!this._getUniqueItemId(schema, feature)) {
                this.contextMenu.setActive(false);
            }
            this._initColorpickers(dialog);
            this.toolsetRenderer.pause();
            if (schema.allowDigitize) {
                this.featureEditor.pause();
            }
            let geometry = feature.get("geometry");
            if ( geometry instanceof ol.geom.Point) {
               let x = geometry.flatCoordinates[0];
               let y = geometry.flatCoordinates[1];
                dialog.find("input.-fn-coordinates.x").val(x);
                dialog.find("input.-fn-coordinates.y").val(y);
            }
            dialog.data("feature",feature);

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
                        var data = self._getItemData(schema, feature);
                        var templates = (schema.featureType.print || {}).templates || null;
                        printClient.printDigitizerFeature(data, schema, templates);
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
            try {
                this.getSchemaLayer(schema).getSource().removeFeature(feature);
            } catch(e) {
                console.warn("delete feature has not been found in layer source at the moment of deletion",feature,e);
            }
            this._super(schema, feature, id);
            // Multi-Digitizer sync support
            $(olMap).trigger({type: "Digitizer.FeatureUpdatedOnServer", feature: feature});
        },
        _prepareDataItem: function(schema, itemData) {
            var feature = this.wktFormat_.readFeatureFromText(itemData.geometry);
            /*** */
            itemData.properties["KG_NUMMER"] = itemData.properties["kg_nummer"];
            delete itemData.properties["kg_nummer"];
            /** Quick and Dirty **/
            feature.set('data', itemData.properties || {});
            var id = this._generateNamespacedId(schema, feature);
            feature.setId(id);
            var schemaSource = this.getSchemaLayer(schema).getSource();
            var existingFeature = schemaSource.getFeatureById(id);
            if (existingFeature && existingFeature.get('dirty')) {
                // Keep & reuse existing feature that has been modified in the current session
                return existingFeature;
            } else {
                this.commitGeometry(schema, feature);
                this.renderer.initializeFeature(schema, feature);
                return feature;
            }
        },
        initializeNewFeature: function(schema, feature) {
            this.renderer.initializeFeature(schema, feature);
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
            return [this.element.attr('id'), schema.schemaName, this._getUniqueItemId(schema, feature)].join('-');
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
            var olMap = this.mbMap.getModel().olMap;
            $(olMap).trigger({type: "Digitizer.FeatureUpdatedOnServer", feature: feature});   // why?
        },
        _getData: function(schema) {
            if (!this.active) {
                return;
            }
            var layer = this.getSchemaLayer(schema);
            return this._super(schema).then(function(features) {
                var modifiedFeatures = layer.getSource().getFeatures().filter(function(feature) {
                    return feature.get('dirty');
                });
                layer.getSource().clear();
                /** Dirty hack to prevent display of obstacles that dont'have points **/
                let filteredFeatures = features.filter(function(feature) {   return feature.get("data")["point_ids"] !== null; });
                 /** **/
                layer.getSource().addFeatures(filteredFeatures);
                for (var i = 0; i < modifiedFeatures.length; ++i) {
                    var modifiedFeature = modifiedFeatures[i];
                    if (!layer.getSource().getFeatureById(modifiedFeature.getId())) {
                        layer.getSource().addFeatures([modifiedFeature]);   // re-add to layer
                        features.push(modifiedFeature);                     // re-add to table view
                    }
                }
                return features;
            });
        },
        _cancelForm: function(schema, feature) {
            this._super(schema, feature);
            // NOTE: this also detects cloned features (via new copy functionality) as new
            var isNew = !this._getUniqueItemId(schema, feature);
            if (isNew && feature.get("geometry")) {
                this.getSchemaLayer(schema).getSource().removeFeature(feature);
            }
            this.toolsetRenderer.resume();
            if (schema.allowDigitize) {
                this.featureEditor.resume();
            }
            this.resumeContextMenu_();
        },
        _replaceItemData: function(schema, feature, newValues) {
            // NOTE: 'data' is a regular mutable data Object (see _prpareDataItem)
            this._super(schema, feature.get('data'), newValues);
        },
        _getSaveRequestData: function(schema, dataItem, newValues) {
            if (schema.noGeometry) {
                return {
                    properties: Object.assign({}, this._getItemData(schema, dataItem), newValues || {}),
                };
            } else
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
            var promise = this.postJSON('update-multiple?' + $.param(params), postData)
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
            if (!schema.continueDrawingAfterSave) {
                promise.always(function() {
                    if (widget.activeToolName_) {
                        widget._toggleDrawingTool(schema, widget.activeToolName_, false);
                    }
                    $('.-fn-toggle-tool', widget.element).removeClass('active');
                });
            }
        },
        getSchemaLayer: function(schema) {
            return this.renderer.getLayer(schema);
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
            var schema = this._getCurrentSchema();
            if (feature && !this.activeToolName_) {
                this._openEditDialog(schema, feature);
            } else if (!this.currentPopup && 'modifyFeature' === this.activeToolName_) {
                // Disable hover highlighting on the feature currently selected for editing. The generated style updates break
                // usability (can't pull vertices outward).
                this.clearHighlightExclude_();
                if (feature) {
                    this.excludedFromHighlighting_.push(feature);
                }
                this.featureEditor.setEditFeature(feature || null);
                this.selectControl.getFeatures().clear();
                var tr = feature && feature.get('table-row');
                if (tr) {
                    this.tableRenderer.showRow(schema, tr);
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
                    self.renderer.customStyleFeature_(schema, feature);
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
                    var activeLayer = schema && self.getSchemaLayer(schema);
                    return layer === activeLayer;
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
                    var activeLayer = schema && self.getSchemaLayer(schema);
                    return layer === activeLayer;
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



        // TODO seperate Feature Info calls for individual properties in order to avoid iterating through meaningless dataSets
        _getRemotePropertyValues: function (feature, schema) {
            var widget = this;
            if (!feature.getGeometry()) {
                return $.Deferred().reject();
            }
            var bbox = feature.getGeometry().getExtent();
            bbox[0] -= 0.00001;
            bbox[1] -= 0.00001;
            bbox[2] += 0.00001;
            bbox[3] += 0.00001;

            var srid = this.mbMap.getModel().getCurrentProjectionCode();
            var url = this.elementUrl + "getFeatureInfo";

            var ajaxCall = $.get(url,{
                bbox: bbox.join(","),
                schema: schema.schemaName,
                srid: srid
            });

            return ajaxCall.then(function (response) {
                if (response.error) {
                    Mapbender.error(Mapbender.trans('remoteData.error'));
                    return;
                }
                let properties = {};
                _.each(response.dataSets, function (dataSet) {
                    try {
                        var json =  JSON.parse(dataSet);
                        let keys = Object.keys(json.features[0].properties);
                        keys.forEach(function(key){
                            properties[key] = json.features[0].properties[key];
                        });
                    } catch (e) {
                        // Prevent interruption in case of empty features
                    }
                });
                return properties || {};
            }).fail(function (response) {
                Mapbender.error(Mapbender.trans("remoteData.error"));

            });


        },
        __formatting_dummy: null
    });

})(jQuery);
