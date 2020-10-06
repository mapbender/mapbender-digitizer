(function () {
    "use strict";

    // @todo: Move config and merging with defaults back to PHP Element (Scheme class is now a pure data object)
    /**
     *
     * @param {Object} options
     * @param widget
     * @constructor
     */

    Mapbender.Digitizer.Scheme = function (options) {
        var schema = this;

        schema.featureType = options.featureType;

        schema.schemaName = options.schemaName;
        schema.styles = options.styles;

        schema.label = options.label;
        schema.popup = options.popup || {title: schema.schemaName, width: '500px'};
        schema.tableFields = options.tableFields;
        schema.formItems = options.formItems || {};
        schema.allowEditData = options.allowEditData || (typeof options.allowEditData === 'undefined');  //default true
        schema.allowDelete = options.allowDelete || (typeof options.allowDelete === 'undefined');  //default true;
        schema.inlineSearch = options.inlineSearch || true;
        schema.pageLength = options.pageLength || 10;
        schema.inlineSearch = options.inlineSearch || false;
        schema.tableTranslation = options.tableTranslation || undefined;

        // alias different config key "allowEditData" to upstream-compatible "allowEdit"
        schema.allowEdit = schema.allowEditData || options.allowEdit || false;

        schema.toolset = options.toolset;

        schema.allowCustomStyle = options.allowCustomStyle || false;

        schema.allowDigitize = options.allowDigitize || (typeof options.allowEditData === 'undefined');  // default true

        schema.copy = options.copy || {
            enable: false,
            overwriteValuesWithDefault: false
        };

        schema.printable = options.printable || false;

        schema.allowChangeVisibility = options.allowChangeVisibility || false;

        schema.minScale = options.minScale || undefined;

        schema.maxScale = options.maxScale || undefined;

        schema.currentExtentSearch = options.currentExtentSearch || false;

        schema.displayPermanent = options.displayPermanent || false;

        schema.refreshFeaturesAfterSave = options.refreshFeaturesAfterSave || false;

        schema.refreshLayersAfterFeatureSave = options.refreshLayersAfterFeatureSave || false;

        /** New properties **/
        schema.revertChangedGeometryOnCancel = options.revertChangedGeometryOnCancel || false;
    };

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Object} schema
     * @constructor
     */
    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(owner, olMap, schema) {
        this.owner = owner;
        this.schema = schema;
        this.olMap = olMap;

        this.styles = this.initializeStyles_(schema.styles);

        this.layer = this.createSchemaFeatureLayer_(schema);
        this.olMap.addLayer(this.layer);

        this.addSelectControl_();

        var renderer = this;
        this.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;
            renderer.initializeFeature(schema, feature);
            renderer.registerFeatureEvents(schema, feature);
        });
        $(olMap).on('Digitizer.FeatureUpdatedOnServer', function (event) {
            renderer.onFeatureUpdatedOnServer(renderer.schema);
        });
    }
    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        initializeFeature: function(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            this.setStyle_(feature, this.styles.default);
            // @todo: don't do this if style cannot be saved (no style field)
            if (schema.allowCustomStyle) {
                this.customStyleFeature_(feature);
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
            var style = this.getStyleForIntent_(feature, intent);
            this.setStyle_(feature, style);
        },
        setStyle_: function(feature, style) {
            // adopted code from mapbender/ol4-extensions package, plus fixes
            // @todo: turn this into a style function on the layer
            var labelPattern = /\${([^}]+)}/g;
            var labelValue = style.getText() && style.getText().getText();
            if (!labelPattern.test(labelValue || '')) {
                feature.setStyle(style);
                return;
            }
            // Build a two-element list returning style function, resolving the
            // attribute-dependent label dynamically
            var baseStyle = style.clone();
            var labelStyle = new ol.style.Style({
                text: baseStyle.getText().clone()
            });
            baseStyle.setText(null);

            var styleFunction = function (feature) {
                var attributes = feature.get("data") || {};
                var label = labelValue.replace(labelPattern, function(match, attributeName) {
                    return attributes[attributeName] || '';
                });
                var labelStyle_ = labelStyle.clone();
                labelStyle_.getText().setText(label);
                return [baseStyle, labelStyle_];
            };
            feature.setStyle(styleFunction);
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
        onFeatureUpdatedOnServer: function(schema) {
            if (schema.refreshLayersAfterFeatureSave) {
                $.each(schema.refreshLayersAfterFeatureSave, function (k1, layerInstanceId) {
                    var layers = Mapbender.layerManager.getLayersByInstanceId(layerInstanceId);
                    $.each(layers, function (k2, layer) {
                        Mapbender.layerManager.refreshLayer(layer);
                    });
                });
            }

            if (schema.refreshFeaturesAfterSave) {
                for (var i = 0; i < schema.refreshFeaturesAfterSave.length; ++i) {
                    var schemaName = schema.refreshFeaturesAfterSave[i];
                    this.refreshConnectedDigitizerFeatures(schemaName);
                }
            }
        }
    });
    // @todo: salvage this
    //        Modifying Digitizer A should NOT call into other Digitizer code
    //        Other Digitizer should REACT to a change event
    //        For this to work, the event must be listenable (=triggered on DOM, not on completely internal objects)
    Mapbender.Digitizer.FeatureRenderer.prototype.refreshConnectedDigitizerFeatures = function(schemaName){
        $(".mb-element-digitizer").not(".mb-element-data-manager").each(function(index,element){
            var foreignDigitizer = $(element).data("mapbenderMbDigitizer");

            try {
                foreignDigitizer.schemes[schemaName].layer.getSource().refresh();
            } catch(e) {
                console.error("No active Digitizer Scheme '"+schemaName+"'",e); // ???
            }
        });
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
            visible: true,
            minResolution: Mapbender.Model.scaleToResolution(schema.maxScale || 0),
            maxResolution: Mapbender.Model.scaleToResolution(schema.minScale || Infinity)
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
            this.setStyle_(feature, style);
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
        if (schema.allowEditData) {
            var widget = this.owner;
            selectControl.on('select', function (event) {
                // @todo: Renderer should know about the widget
                widget._openEditDialog(schema, event.selected[0]);
                selectControl.getFeatures().clear();
            });
        }
        selectControl.setActive(false);
        return selectControl;
    };
})();
