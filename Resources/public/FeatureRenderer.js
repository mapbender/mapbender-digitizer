(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Object} schema
     * @constructor
     */
    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(owner, olMap) {
        this.owner = owner;
        this.olMap = olMap;
        this.globalStyles_ = this.initializeGlobalStyles_();
        this.schemaStyles_ = {};
        this.schemaLayers_ = {};
    }
    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        disable: function() {
            var layerNames = Object.keys(this.schemaLayers_);
            for (var i = 0; i < layerNames.length; ++i) {
                var layer = this.schemaLayers_[layerNames[i]];
                console.log("Disabling layer", layer);
                layer.setVisible(false);
            }
        },
        initializeFeature: function(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            this.setRenderIntent_(schema, feature, 'default');
            this.registerFeatureEvents(schema, feature);
            if (schema.allowCustomStyle) {
                this.customStyleFeature_(schema, feature);
            }
        },
        registerFeatureEvents: function(schema, feature) {
            // Avoid registering same event handlers on the same feature multiple times
            if (feature.get('renderer-events')) {
                return;
            }
            var renderer = this;
            var watchedProperties = ['hover', 'dirty', 'editing', 'hidden'];
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function (event) {
                if (-1 !== watchedProperties.indexOf(event.key)) {
                    renderer.updateFeatureStyle(schema, feature);
                }
            });
            feature.set('renderer-events', true);
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
        setRenderIntent_: function(schema, feature, intent) {
            var style = intent === 'default' && feature.get('style')
            if (!style) {
                var schemaStyles = this.schemaStyles_[schema.schemaName];
                style = this.globalStyles_[intent] || schemaStyles[intent];
            }
            if (!style && intent !== 'default') {
                console.warn("Unknown render intent " + intent + ", using default");
                style = schemaStyles['default'];
            }

            this.setStyle_(feature, style);
        },
        updateFeatureStyle: function(schema, feature) {
            if (feature.get('editing')) {
                this.setRenderIntent_(schema, feature, 'editing');
            } else if (feature.get("hidden")) {
                this.setRenderIntent_(schema, feature, 'invisible');
            } else if (feature.get('hover')) {
                this.setRenderIntent_(schema, feature, 'select');
            } else if (feature.get('dirty')) {
                this.setRenderIntent_(schema, feature, 'unsaved');
            } else {
                this.setRenderIntent_(schema, feature, 'default');
            }
        }
    });

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        // @todo: salvage this
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

    Mapbender.Digitizer.FeatureRenderer.prototype.getLayer = function(schema) {
        if (!this.schemaLayers_[schema.schemaName]) {
            var styleConfigs = (this.owner.options.schemes[schema.schemaName] || {}).styles;
            this.schemaStyles_[schema.schemaName] = this.initializeStyles_(styleConfigs || {});
            var layer = this.createSchemaFeatureLayer_(schema);
            this.olMap.addLayer(layer);
            this.schemaLayers_[schema.schemaName] = layer;
        }

        return this.schemaLayers_[schema.schemaName];
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initializeStyles_ = function (styleConfigs) {
        var styles = {};
        var keys = Object.keys(styleConfigs);
        for (var i = 0; i < keys.length; ++ i) {
            var key = keys[i];
            var styleConfig = styleConfigs[key];
            styles[key] = Mapbender.Digitizer.StyleAdapter.fromSvgRules(styleConfig);
        }
        return styles;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initializeGlobalStyles_ = function() {
        return {
            invisible: new ol.style.Style(),
            editing: this.createEditingStyle_()
        };
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
            var style = Mapbender.Digitizer.StyleAdapter.fromSvgRules(basicStyle);
            feature.set("basicStyle", basicStyle);
            feature.set("style", style);
            this.setStyle_(feature, style);
        }
    };

    /**
     * @return function
     * @private
     */
    Mapbender.Digitizer.FeatureRenderer.prototype.createEditingStyle_ = function() {
        // Adopted from "ol4-extensions" repository
        // @see https://github.com/mapbender/ol4-extensions/blob/0.0.4/selectableModify.js#L3
        var baseStyle = ol.style.Style.defaultFunction()[0].clone();
        var extractEdges = function(geometry) {
            var polygons, lines;
            switch (geometry.getType()) {
                case 'MultiPolygon':
                    polygons = geometry.getPolygons();
                    break;
                case 'Polygon':
                    polygons = [geometry];
                    break;
                case 'LineString':
                    lines = [geometry];
                    break;
                case 'MultiLineString':
                    lines = geometry.getLineStrings();
                    break;
                default:
                    break;
            }
            if (polygons) {
                lines = [];
                for (var p = 0; p < polygons.length; ++p) {
                    var polygon = polygons[p];
                    var rings = polygon.getCoordinates();
                    for (var r = 0; r < rings.length; ++r) {
                        var ring = rings[r];
                        lines.push(new ol.geom.LineString(ring));
                    }
                }
            }
            return lines || [];
        };
        var verticesStyle = new ol.style.Style({
            geometry: function(feature) {
                // Concatenate all vertices
                var coordinates = Array.prototype.concat.apply([], extractEdges(feature.getGeometry()).map(function(lineString) {
                    return lineString.getCoordinates();
                }));
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
                var lineStrings = extractEdges(feature.getGeometry());
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
            return [baseStyle, verticesStyle, midpointStyle];
        }
    };
})();
