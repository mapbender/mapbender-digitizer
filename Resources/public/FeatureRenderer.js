(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Object} schema
     * @constructor
     */
    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(owner, olMap, schema) {
        this.owner = owner;
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
            renderer.onFeatureUpdatedOnServer(schema);
        });
    }
    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        initializeFeature: function(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            this.setStyle_(feature, this.styles.default);
            if (schema.allowCustomStyle) {
                this.customStyleFeature_(schema, feature);
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
                if (event.key === 'selected' || event.key === 'dirty' || event.key === 'hidden' || event.key === 'editing') {
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
            var styleFunction = function (feature) {
                var baseStyles;
                if (typeof style === 'function') {
                    baseStyles = style.apply(this, arguments);
                    if (!Array.isArray(baseStyles)) {
                        baseStyles = [baseStyles];
                    }
                } else {
                    baseStyles = [style];
                }
                var labelValue = baseStyles[0].getText() && baseStyles[0].getText().getText();
                if (!labelPattern.test(labelValue || '')) {
                    return baseStyles;
                }
                var labelStyle = new ol.style.Style({
                    text: baseStyles[0].getText().clone()
                });
                baseStyles[0] = baseStyles[0].clone();
                baseStyles[0].setText(null);

                var attributes = feature.get("data") || {};
                var label = labelValue.replace(labelPattern, function(match, attributeName) {
                    return attributes[attributeName] || '';
                });
                labelStyle.getText().setText(label);
                return baseStyles.concat([labelStyle]);
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
            if (feature.get('editing')) {
                this.setRenderIntent(feature, 'editing');
            } else if (feature.get("hidden")) {
                this.setRenderIntent(feature, 'invisible');
            } else if (feature.get("selected")) {
                this.setRenderIntent(feature, 'select');
            } else if (feature.get('dirty')) {
                this.setRenderIntent(feature, 'unsaved');
            } else {
                this.setRenderIntent(feature, 'default');
            }
        }
    });

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        onFeatureUpdatedOnServer: function(schema) {
            if (schema.refreshLayersAfterFeatureSave) {
                $.each(schema.refreshLayersAfterFeatureSave, function (k1, instanceId) {
                    var source = Mapbender.Model.getSourceById(instanceId);
                    var layers = source.getNativeLayers();
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
        styles.editing = this.createEditingStyle_();
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

    Mapbender.Digitizer.FeatureRenderer.prototype.customStyleFeature_ = function (schema, feature) {
        var styleField = schema.featureType.styleField;
        var itemData = feature.get("data");
        var jsonStyle = styleField && itemData && itemData[styleField];

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
            layers: [this.layer]
        });

        var widget = this.owner;
        selectControl.on('select', function (event) {
            selectControl.getFeatures().clear();
            widget.onFeatureClick(event.selected[0]);
        });
        selectControl.setActive(false);
        return selectControl;
    };

    /**
     * @return function
     * @private
     */
    Mapbender.Digitizer.FeatureRenderer.prototype.createEditingStyle_ = function() {
        // Adopted from "ol4-extensions" repository
        // @see https://github.com/mapbender/ol4-extensions/blob/0.0.4/selectableModify.js#L3
        var baseStyle = ol.style.Style.defaultFunction()[0].clone();
        var verticesStyle = new ol.style.Style({
            geometry: function(feature) {
                // Concatenate all vertices of all rings
                var coordinates = Array.prototype.concat.apply([], feature.getGeometry().getCoordinates());
                return new ol.geom.MultiPoint(coordinates);
            },
            image: new ol.style.Circle({
                radius: 3,
                fill: new ol.style.Fill({
                    color: "#ffcc33"
                })
            })
        });
        var midpointStyle = new ol.style.Style({
            geometry: function(feature) {
                var lineStrings = feature.getGeometry().getCoordinates().map(function(ringCoordinates) {
                    return new ol.geom.LineString(ringCoordinates);
                });
                var coordinates = Array.prototype.concat.apply([], lineStrings.map(function(lineString) {
                    var midpoints = [];
                    lineString.forEachSegment(function(start, end) {
                        midpoints.push([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]);
                    });
                    return midpoints;
                }));
                return new ol.geom.MultiPoint(coordinates);
            },
            image: new ol.style.Circle({
                radius: 3,
                stroke: new ol.style.Stroke({
                    color: "#ffcc33",
                    width: 4
                })
            })
        });

        return function (feature) {
            var geometry = feature.getGeometry();
            var styles = [baseStyle];

            if (geometry.getType() === "Polygon") {
                styles.push(verticesStyle);
                styles.push(midpointStyle);
            }
            return styles;
        }
    };
})();
