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

        _create: function () {
            this._super();
            var widget = this;
            var target = this.options.target;
            this.toolsetRenderer = this._createToolsetRenderer();
            this.styleEditor = this._createStyleEditor();
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
        _schemaFactory: function(schemaConfig) {
            var schemaConfig_ = this._super(schemaConfig);
            if (!schemaConfig_.featureType || !schemaConfig_.featureType.connection || !schemaConfig_.featureType.table || !schemaConfig_.featureType.geomType) {
                throw new Error("Feature Type not correctly specified in Configuration of scheme")
            }
            if (schemaConfig_.popup && schemaConfig_.popup.buttons) {
                _.each(schemaConfig_.popup.buttons, function (button) {
                    console.error("Using Javascript code in the configuration is deprecated:", button);
                });
            }
            return new Mapbender.Digitizer.Scheme(schemaConfig_, this);
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
                schema.renderer = new Mapbender.Digitizer.FeatureRenderer(this.mbMap.getModel().olMap, schema);
            }
            // HACK: externally patch editor onto schema post-construction
            if (schema.allowDigitize && !schema.geometryEditor) {
                var layer = schema.renderer.getLayer();
                schema.geometryEditor = new Mapbender.Digitizer.FeatureEditor(layer, this.controlFactory);
            }

            this.contextMenu.setSchema(schema);
            this._toggleSchemaInteractions(schema, true);
            schema.renderer.layer.setVisible(true);
        },
        _toggleDrawingTool: function(schema, toolName, state) {
            schema.geometryEditor.toggleTool(toolName, schema, state);
            // @todo: disable selectControl if drawing active and vice-versa
        },
        _deactivateSchema: function(schema) {
            this._super(schema);
            this._toggleSchemaInteractions(schema, false);
            if (!(this.options.displayOnInactive || schema.displayPermanent)) {
                schema.renderer.layer.setVisible(false);
            }
        },
        _toggleSchemaInteractions: function(schema, state) {
            if (schema.geometryEditor) {
                schema.geometryEditor.setActive(state);
            }
            schema.renderer.highlightControl.setActive(state);
            schema.renderer.selectControl.setActive(state);
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
            $('.btn, button', $container)
                .removeClass('button')  // no Mapbender legacy button styling
                // some .btn- color variant is required to visualize active / not active
                .addClass('btn btn-sm btn-default')
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
            // @todo: don't offer this button if style cannot be saved (no style field)
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
        _afterRemove: function(schema, feature, id) {
            var olMap = this.mbMap.getModel().olMap;
            schema.renderer.getLayer().getSource().removeFeature(feature);
            this._super(schema, feature, id);
            // Multi-Digitizer sync support
            $(olMap).trigger({type: "Digitizer.FeatureUpdatedOnServer", feature: feature});
        },
        _prepareDataItem: function(schema, itemData) {
            var renderer = schema.renderer;
            var feature = (new ol.format.WKT()).readFeatureFromText(itemData.geometry);
            feature.set('data', itemData.properties || {});
            renderer.initializeFeature(schema, feature);
            return feature;
        },
        _afterSave: function(schema, feature, originalId, responseData) {
            // unravel dm-incompatible response format
            // @todo: should we or should we not replace feature geometry?
            // var geometry = (new ol.format.WKT()).readGeometryFromText(responseData.dataItem.geometry);
            // feature.setGEometry(geometry);

            this._super(schema, feature, originalId, {
                dataItem: responseData.dataItem.properties
            });
            feature.set('dirty', false);
            feature.set("modificationState", undefined);
            if (schema.geometryEditor) {
                schema.geometryEditor.resume();
            }
            var olMap = this.mbMap.getModel().olMap;
            $(olMap).trigger({type: "Digitizer.FeatureUpdatedOnServer", feature: feature});   // why?
        },
        _getData: function(schema) {
            var renderer = schema.renderer;
            return this._super(schema).then(function(features) {
                renderer.getLayer().getSource().clear();
                renderer.getLayer().getSource().addFeatures(features);
                return features;
            });
        },
        _cancelForm: function(schema, feature) {
            this._super(schema, feature);
            // NOTE: this also detects cloned features (via new copy functionality) as new
            var isNew = !this._getUniqueItemId(schema, feature);
            if (isNew) {
                schema.renderer.getLayer().getSource().removeFeature(feature);
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
                geometry: new ol.format.WKT().writeGeometryText(dataItem.getGeometry()),
                srid: this.getProjectionCode()
            };
        },
        cloneFeature: function(schema, feature) {
            var layer = schema.renderer.getLayer();
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

            // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
            if (schema.copy.moveCopy) {
                newFeature.getGeometry().translate(schema.copy.moveCopy.x, schema.copy.moveCopy.y);
            }
            schema.renderer.getLayer().getSource().addFeature(newFeature);
            newFeature.set('dirty', true);
            newFeature.set("modificationState", "isNew");

            this._openEditDialog(schema, newFeature);
        },
        // Support method for custom Scheme class
        getProjectionCode: function() {
            return this.mbMap.getModel().getCurrentProjectionCode();
        },
        openStyleEditor: function(schema, feature) {
            var styleConfig = feature.get('basicStyle') || schema.renderer.basicStyles.default;
            this.styleEditor.openEditor(schema, feature, styleConfig);
        },
        zoomToFeature: function(schema, feature) {
            Mapbender.Model.zoomToFeature(feature);
        },
        __formatting_dummy: null
    });

})(jQuery);
