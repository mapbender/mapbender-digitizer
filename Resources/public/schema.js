(function () {
    "use strict";

    // @todo: Move config and merging with defaults back to PHP Element (Scheme class is now a pure data object)
    /**
     *
     * @param {Object} options
     * @param widget
     * @constructor
     */

    Mapbender.Digitizer.Scheme = function (options, widget) {
        var schema = this;

        schema.widget = widget;

        schema.featureType = options.featureType || {
            uniqueId: null,
            geomField: null,
            styleField: null,
            srid: 4326
        };

        schema.schemaName = options.schemaName;

        schema.label = options.label;
        schema.view = options.view = { settings: { }};
        schema.popup = options.popup || {title: schema.schemaName, width: '500px'};
        schema.tableFields = options.tableFields;
        schema.formItems = options.formItems || {};
        schema.allowEditData = options.allowEditData || (typeof options.allowEditData === 'undefined');  //default true
        schema.allowSave = options.allowSave || false;
        schema.allowOpenEditDialog = options.allowOpenEditDialog || false;
        schema.allowDelete = options.allowDelete || (typeof options.allowDelete === 'undefined');  //default true;
        schema.inlineSearch = options.inlineSearch || true;
        schema.pageLength = options.pageLength || 10;
        schema.inlineSearch = options.inlineSearch || false;
        schema.tableTranslation = options.tableTranslation || undefined;

        // alias different config keys "allowEditData", "allowOpenEditDialog" to upstream-compatible "allowEdit"
        schema.allowEdit = schema.allowEditData || options.allowOpenEditDialog || options.allowEdit || false;

        schema.toolset = options.toolset;

        schema.allowCustomStyle = options.allowCustomStyle || false;

        schema.allowDigitize = options.allowDigitize || (typeof options.allowEditData === 'undefined');  // default true

        schema.allowSaveInResultTable = options.allowSaveInResultTable || false;

        schema.copy = options.copy || {
            enable: false,
            overwriteValuesWithDefault: false,
            moveCopy: {x: 10, y: 10}
        };

        // Deactivated schema.printable = options.printable || false;

        schema.allowChangeVisibility = options.allowChangeVisibility || false;

        schema.allowDeleteByCancelNewGeometry = options.allowDeleteByCancelNewGeometry || false;

        // Deactivated schema.maxResults = options.maxResults || 5000;
        // only in custom bundles - allowPrintMetadata
        // mailManager
        schema.minScale = options.minScale || undefined;

        schema.maxScale = options.maxScale || undefined;

        //    group // not necessary
        //    save // deprecated - no code in config
        // hooks // deprecated - no code in config

        schema.currentExtentSearch = options.currentExtentSearch || false;

        schema.displayPermanent = options.displayPermanent || false;

        schema.refreshFeaturesAfterSave = options.refreshFeaturesAfterSave || false;

        schema.refreshLayersAfterFeatureSave = options.refreshLayersAfterFeatureSave || false;

        /** New properties **/
        schema.revertChangedGeometryOnCancel = options.revertChangedGeometryOnCancel || false;

        schema.deactivateControlAfterModification = options.deactivateControlAfterModification || false;

        schema.allowSaveAll = options.allowSaveAll || false;

        /** implement this **/
        schema.showLabel = options.showLabel || false;

        schema.allowOpenEditDialog = options.allowOpenEditDialog || false;

        schema.openDialogOnResultTableClick = options.openDialogOnResultTableClick || false;

        schema.zoomOnResultTableClick = options.zoomOnResultTableClick || true;
    };

    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(olMap, schema) {
        this.schema = schema;
        this.olMap = olMap;
        /** @todo: should go PHP, in getSchemaConfig; less runtime merging of stuff */
        this.basicStyles = Object.assign({}, this.getDefaultStyles(), schema.styles || {});

        this.styles = this.initializeStyles_(this.basicStyles); // NOTE: accessed only in event handlers currently inlined here

        this.layer = this.createSchemaFeatureLayer_(schema);
        this.olMap.addLayer(this.layer);

        this.addSelectControl_();

        var renderer = this;
        this.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;
            renderer.initializeFeature(schema, feature);
            renderer.registerFeatureEvents(schema, feature);
        });
        this.layer.getSource().on(['controlFactory.FeatureMoved', 'controlFactory.FeatureModified'], function (event) {
            var feature = event.feature || event.features.item(0);
            renderer.onFeatureModified(renderer.schema, feature);
        });

        this.layer.getSource().on('controlFactory.FeatureAdded', function (event) {
            // @todo: this is no longer rendering specific and this class should not listen to this event at all
            // @todo: Renderer should know about the widget
            schema.widget._openEditDialog(schema, event.feature);
        });

        $(olMap).on('Digitizer.FeatureUpdatedOnServer', function (event) {
            renderer.onFeatureUpdatedOnServer(renderer.schema);
        });
    }
    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        initializeFeature: function(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            feature.setStyle = feature.setStyleWithLabel;
            feature.setStyle(this.styles.default);
            if (schema.allowCustomStyle) {
                schema.customStyleFeature_(feature);
            }

            feature.set("oldGeometry", feature.getGeometry().clone());
        },
        registerFeatureEvents: function(schema, feature) {
            feature.on('Digitizer.HoverFeature', function (event) {
                var hover = !!event.hover || (typeof (event.hover) === 'undefined');
                feature.set('selected', hover && !feature.get('hidden'));
            });

            var renderer = this;
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function (event) {
                if (event.key == "selected" || event.key == "modificationState" || event.key == "hidden") {
                    renderer.updateFeatureStyle(schema, feature);
                }
            });
        },
        setRenderIntent: function(feature, intent) {
            // @todo: drop monkey-patching of setStyle = setStyleWithLabel
            feature.setStyle(this.getStyleForIntent_(feature, intent));
        },
        getStyleForIntent_: function(feature, intent) {
            // @todo: turn this into a style function on the layer, so it will work without events
            var intent_ = intent;
            if (!this.styles[intent]) {
                console.warn("Unknown render intent " + intent + ", using default");
                intent_ = 'default';
            }
            var style;
            if (intent_ === 'default') {
                // NOTE: "style" value only set by feature style editor (disabled?; see customStyleFeature_)
                style = feature.get('style');
            }
            return style || this.styles[intent_];
        },
        updateFeatureStyle: function(schema, feature) {
            // See selectableModify interaction (ol4 extensions)
            // @todo: selectableModify should deal with pausing style updates itself
            if (feature.get("featureStyleDisabled")) {
                return;
            }
            if (feature.get("hidden")) {
                this.setRenderIntent(feature, 'invisible');
            } else if (feature.get("selected")) {
                this.setRenderIntent(feature, 'select');
            } else if (feature.get("modificationState")) {
                this.setRenderIntent(feature, 'unsaved');
            } else {
                this.setRenderIntent(feature, 'default');
            }
        }
    });

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        onFeatureModified: function(schema, feature) {
            feature.set("modificationState", "isChanged");
            feature.set('dirty', true);
        },
        onFeatureUpdatedOnServer: function(schema) {
            if (schema.refreshLayersAfterFeatureSave) {
                $.each(schema.refreshLayersAfterFeatureSave, function (k1, layerInstanceId) {
                    var layers = Mapbender.layerManager.getLayersByInstanceId(layerInstanceId);
                    $.each(layers, function (k2, layer) {
                        Mapbender.layerManager.refreshLayer(layer);
                    });
                });
            }

            if(schema.refreshFeaturesAfterSave){
                $.each(schema.refreshFeaturesAfterSave, function(key,schemaName){
                    schema.widget.refreshConnectedDigitizerFeatures(schemaName);
                })
            }
        }
    });

    /** @todo: should go PHP, in getSchemaConfigDefaults; less runtime merging of stuff */
    Mapbender.Digitizer.FeatureRenderer.prototype.getDefaultStyles = function () {
        return {
            default: {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor: '#6fb536',
                fillOpacity: 0.3
            },
            select: {
                strokeWidth: 3,
                fillColor: '#F7F79A',
                strokeColor: '#6fb536',
                fillOpacity: 0.5,
                graphicZIndex: 15
            },
            unsaved: {
                strokeWidth: 3,
                fillColor: '#FFD14F',
                strokeColor: '#F5663C',
                fillOpacity: 0.5
            }
        };
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.getLayer = function() {
        return this.layer;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initializeStyles_ = function (styleConfigs) {
        var styles = {};
        var keys = Object.keys(styleConfigs);
        for (var i = 0; i < keys.length; ++ i) {
            var key = keys[i];
            var styleConfig = styleConfigs[key];
            styles[key] = ol.style.StyleConverter.convertToOL4Style(styleConfig);
        }
        Object.freeze(styles.default.getFill().getColor()); // Freeze Color to prevent unpredictable behaviour
        styles.invisible = new ol.style.Style();
        return styles;
    };


    Mapbender.Digitizer.FeatureRenderer.prototype.createSchemaFeatureLayer_ = function (schema) {
        var layer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            visible: true
            // HACK: disable min / max resolution and initial visibility while testing
            // @todo: reenable minScale / maxScale config evaluation
//            minResolution: Mapbender.Model.scaleToResolution(schema.maxScale || 0),
//            maxResolution: Mapbender.Model.scaleToResolution(schema.minScale || Infinity),
//            visible: false
        });
        return layer;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.customStyleFeature_ = function (feature) {
        var schema = this;

        console.assert(!!schema.featureType.styleField, "Style Field in Feature Type is not specified");

        var jsonStyle = feature.get("data") && feature.get("data").get(schema.featureType.styleField);

        if (jsonStyle) {
            var basicStyle = JSON.parse(jsonStyle);
            var style = ol.style.StyleConverter.convertToOL4Style(basicStyle);
            feature.set("basicStyle", basicStyle);
            feature.set("style", style);
            feature.setStyle(style);
        }
    };


    Mapbender.Digitizer.FeatureRenderer.prototype.addSelectControl_ = function () {
        this.highlightControl = this.initializeHighlightControl_();
        this.selectControl = this.initializeSelectControl_();
        this.olMap.addInteraction(this.selectControl);
        this.olMap.addInteraction(this.highlightControl);
    };
    Mapbender.Digitizer.FeatureRenderer.prototype.initializeHighlightControl_ = function () {
        var highlightControl = new ol.interaction.Select({
            condition: ol.events.condition.pointerMove,
            layers: [this.layer]
        });
        highlightControl.on('select', function (e) {
            e.selected.forEach(function (feature) {
                feature.dispatchEvent({type: 'Digitizer.HoverFeature', hover: true});
            });

            e.deselected.forEach(function (feature) {
                feature.dispatchEvent({type: 'Digitizer.HoverFeature', hover: false});
            });
        });

        highlightControl.setActive(false);
        return highlightControl;
    };
    Mapbender.Digitizer.FeatureRenderer.prototype.initializeSelectControl_ = function () {
        var selectControl = new ol.interaction.Select({
            condition: ol.events.condition.singleClick,
            layers: [this.layer],
            style: function () {
                return null;
            }
        });

        var schema = this.schema;
        if (schema.allowEditData || this.schema.allowOpenEditDialog) {
            selectControl.on('select', function (event) {
                // @todo: Renderer should know about the widget
                schema.widget._openEditDialog(schema, event.selected[0]);
                selectControl.getFeatures().clear();
            });
        }
        selectControl.setActive(false);
        return selectControl;
    };
})();
