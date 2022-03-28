(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Mapbender.Digitizer.StyleAdapter} [styleAdapter]
     * @param {Object} schema
     * @constructor
     */
    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(owner, olMap, styleAdapter) {
        this.owner = owner;
        this.olMap = olMap;
        this.styleAdapter = styleAdapter || owner.createStyleAdapter();
        this.globalStyles_ = this.initializeGlobalStyles_();
        this.schemaStyles_ = {};
        this.schemaLayers_ = {};
    }
    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        disable: function() {
            var layerNames = Object.keys(this.schemaLayers_);
            for (var i = 0; i < layerNames.length; ++i) {
                var layer = this.schemaLayers_[layerNames[i]];
                layer.setVisible(false);
            }
        },
        initializeFeature: function(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            if (schema.allowCustomStyle) {
                this.customStyleFeature_(feature);
            }
        },
        createLayerStyleFunction_: function(schema, styleConfig) {
            var self = this;
            return (function(styleConfig) {
                var defaultFn = self.createStyleFunction_(styleConfig);
                return function(feature) {
                    var customFn = feature.get('customStyleFn');
                    if (customFn) {
                        return customFn(feature);
                    } else {
                        return defaultFn(feature);
                    }
                };
            })(styleConfig);
        },
        resolveStyleConfigPlaceholders: function(styleConfig, feature) {
            return this.styleAdapter.resolvePlaceholders(styleConfig, feature.get('data') || {});
        },
        createStyleFunction_: function(styleConfig) {
            return this.styleAdapter.styleFunctionFromSvgRules(styleConfig, function(feature) {
                return feature.get('data') || {};
            });
        },
        updateFeatureStyle: function(feature) {
            var itemSchema, style;
            if (feature.get('editing')) {
                style = this.globalStyles_['editing'];
            } else if (feature.get("hidden")) {
                style = this.globalStyles_['invisible'];
            } else if (feature.get('hover')) {
                itemSchema = this.owner.getItemSchema(feature);
                style = this.schemaStyles_[itemSchema.schemaName]['select'];
            } else if (feature.get('dirty')) {
                itemSchema = this.owner.getItemSchema(feature);
                style = this.schemaStyles_[itemSchema.schemaName]['unsaved'];
            } else {
                style = null;
            }
            // Avoid triggering recursive change events if same style already
            // set.
            if (style !== feature.getStyle()) {
                feature.setStyle(style);
            }
        }
    });

    Mapbender.Digitizer.FeatureRenderer.prototype.toggleSchema = function(schema, state) {
        // @todo ml: respect displayPermanent / displayOnInActive on a sub-schema basis
        var subSchemas = !schema && [] || this.owner.expandCombination(schema);
        for (var s = 0; s < subSchemas.length; ++s) {
            var layer = this.schemaLayers_[subSchemas[s].schemaName];
            if (layer) {
                layer.setVisible(!!state);
            }
        }
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.getLayers = function(schema) {
        var subSchemas = this.owner.expandCombination(schema);
        var layers = [];
        for (var s = 0; s < subSchemas.length; ++s) {
            var subSchema = subSchemas[s];
            if (!this.schemaLayers_[subSchema.schemaName]) {
                this.schemaLayers_[subSchema.schemaName] = this.initItemSchemaLayer_(subSchema);
            }
            layers.push(this.schemaLayers_[subSchema.schemaName]);
        }
        return layers;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initItemSchemaLayer_ = function(schema) {
        var layer = this.createSchemaFeatureLayer_(schema);
        var styleConfigs = (this.owner.options.schemes[schema.schemaName] || {}).styles;
        this.schemaStyles_[schema.schemaName] = this.initializeStyles_(styleConfigs || {});
        layer.setStyle(this.createLayerStyleFunction_(schema, styleConfigs['default']));
        delete this.schemaStyles_[schema.schemaName]['default'];
        this.olMap.addLayer(layer);
        this.registerLayerEvents(layer);
        return layer;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.registerLayerEvents = function(layer) {
        var self = this;
        layer.getSource().on('change', function() {
            self.owner.updateSaveAll();
        });
        layer.getSource().on('changefeature', function(evt) {
            self.updateFeatureStyle(evt.feature);
        });
        return layer;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.forAllFeatures = function(callback) {
        var layers = Object.values(this.schemaLayers_);
        for (var i = 0; i < layers.length; ++i) {
            layers[i].getSource().forEachFeature(callback);
        }
    };
    Mapbender.Digitizer.FeatureRenderer.prototype.forAllSchemaFeatures = function(schema, callback) {
        var self = this;
        var layers = this.owner.expandCombination(schema).map(function(itemSchema) {
            return self.schemaLayers_[itemSchema.schemaName];
        });
        for (var i = 0; i < layers.length; ++i) {
            if (layers[i]) {
                layers[i].getSource().forEachFeature(callback);
            }
        }
    };
    Mapbender.Digitizer.FeatureRenderer.prototype.filterFeatures = function(schema, callback) {
        var self = this;
        var features = [];
        var sources = this.owner.expandCombination(schema).map(function(itemSchema) {
            return self.schemaLayers_[itemSchema.schemaName].getSource();
        });
        for (var s = 0; s < sources.length; ++s) {
            features = features.concat(sources[s].getFeatures().filter(callback));
        }
        return features;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.replaceFeatures = function(schema, features) {
        var self = this;
        this.owner.expandCombination(schema).forEach(function(itemSchema) {
            self.schemaLayers_[itemSchema.schemaName].getSource().clear();
        });
        this.addFeatures(features);
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.addFeatures = function(features, condition) {
        var self = this;
        var layerBuckets = {};
        var filtered = features.filter(function(feature) {
            var itemSchema = self.owner.getItemSchema(feature);
            var schemaLayer = self.schemaLayers_[itemSchema.schemaName];
            if (!condition || condition(schemaLayer, feature)) {
                if (!layerBuckets[itemSchema.schemaName]) {
                    layerBuckets[itemSchema.schemaName] = [self.schemaLayers_[itemSchema.schemaName], []];
                }
                layerBuckets[itemSchema.schemaName][1].push(feature);
                return true;
            } else {
                return false;
            }
        });
        Object.keys(layerBuckets).forEach(function(bucketName) {
            layerBuckets[bucketName][0].getSource().addFeatures(layerBuckets[bucketName][1]);
        });
        return filtered;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.removeFeature = function(itemSchema, feature) {
        var layer = this.schemaLayers_[itemSchema.schemaName];
        if (layer) {
            layer.getSource().removeFeature(feature);
        }
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initializeStyles_ = function (styleConfigs) {
        var styles = {};
        var keys = Object.keys(styleConfigs);
        for (var i = 0; i < keys.length; ++ i) {
            var key = keys[i];
            styles[key] = this.createStyleFunction_(Object.assign({}, styleConfigs['default'], styleConfigs[key]));
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
        var options = {
            source: new ol.source.Vector(),
            visible: true
        };
        if (schema.maxScale) {
            options.maxResolution = Mapbender.Model.scaleToResolution(parseInt(schema.maxScale, 10));
        }
        if (schema.minScale) {
            options.inResolution = Mapbender.Model.scaleToResolution(parseInt(schema.minScale, 10));
        }
        return new ol.layer.Vector(options);
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.customStyleFeature_ = function (feature) {
        var itemSchema = this.owner.getItemSchema(feature);
        var styleField = itemSchema.featureType.styleField;
        var itemData = feature.get("data");
        var jsonStyle = styleField && itemData && itemData[styleField];

        if (jsonStyle) {
            var styleConfig = JSON.parse(jsonStyle);
            var styleFn = this.createStyleFunction_(styleConfig);
            feature.set('customStyleConfig', styleConfig);
            feature.set('customStyleFn', styleFn);
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
