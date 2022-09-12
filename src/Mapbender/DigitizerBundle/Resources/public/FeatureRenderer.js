(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Mapbender.Digitizer.StyleAdapter} [styleAdapter]
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
        /**
         * Limit max features per individual ol.layer.Vector
         * If more features are loaded, a new layer is appended to the item schema's group layer.
         * This speeds up hover interactions (=full redraw of layer containing feature) considerably.
         */
        MAX_FEATURES_PER_LAYER: 75,
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
        getFeatureById: function(id, itemSchema) {
            var layers = !itemSchema && Object.values(this.schemaLayers_) || this.getLayers(itemSchema);
            for (var i = 0; i < layers.length; ++i) {
                var sublayers = layers[i].getLayersArray();
                for (var j = 0; j < sublayers.length; ++j) {
                    var feature = sublayers[j].getSource().getFeatureById(id);
                    if (feature) {
                        return feature;
                    }
                }
            }
            return null;
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

    /**
     * @param {Object} schema
     * @returns {Array<ol.layer.Vector>}
     */
    Mapbender.Digitizer.FeatureRenderer.prototype.getLayers = function(schema) {
        var subSchemas = this.owner.expandCombination(schema);
        var layers = [];
        for (var s = 0; s < subSchemas.length; ++s) {
            var subSchema = subSchemas[s];
            layers = this.getSchemaLayerGroup_(subSchema, true).getLayersArray(layers);
        }
        return layers;
    };

    /**
     * @param {Object} itemSchema
     * @param {boolean} [init]
     * @returns {ol.layer.Group|null}
     * @private
     */
    Mapbender.Digitizer.FeatureRenderer.prototype.getSchemaLayerGroup_ = function(itemSchema, init) {
        if (!this.schemaLayers_[itemSchema.schemaName] && init) {
            this.schemaLayers_[itemSchema.schemaName] = this.initSchemaLayerGroup_(itemSchema);
        }
        return this.schemaLayers_[itemSchema.schemaName] || null;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initSchemaLayerGroup_ = function(itemSchema) {
        var schemaName = itemSchema.schemaName;
        var styleConfigs = (this.owner.options.schemes[schemaName] || {}).styles;
        this.schemaStyles_[schemaName] = this.initializeStyles_(itemSchema, styleConfigs || {});
        var group = new ol.layer.Group();
        // Need at least one layer inside group so draw controls
        // have a valid target layer + source even on empty datasets
        var firstLayer = this.createSchemaFeatureLayer_(itemSchema);
        group.getLayers().push(firstLayer);
        this.olMap.addLayer(group);
        return group;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.registerLayerEvents = function(layer) {
        var self = this;
        layer.getSource().on('change', function() {
            self.owner.updateSaveAll();
        });
        layer.getSource().on('changefeature', function(evt) {
            self.updateFeatureStyle(evt.feature);
        });
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.forAllFeatures = function(callback) {
        var layers = [];
        Object.values(this.schemaLayers_).forEach(function(layer) {
            layers = layer.getLayersArray(layers);
        });
        for (var i = 0; i < layers.length; ++i) {
            layers[i].getSource().forEachFeature(callback);
        }
    };
    Mapbender.Digitizer.FeatureRenderer.prototype.forAllSchemaFeatures = function(schema, callback) {
        var self = this;
        var layers = [];
        this.owner.expandCombination(schema).forEach(function(itemSchema) {
            if (self.schemaLayers_[itemSchema.schemaName]) {
                self.schemaLayers_[itemSchema.schemaName].getLayersArray(layers);
            }
        });
        for (var i = 0; i < layers.length; ++i) {
            layers[i].getSource().forEachFeature(callback);
        }
    };
    Mapbender.Digitizer.FeatureRenderer.prototype.filterFeatures = function(schema, callback) {
        var self = this;
        var features = [];
        var sources = [];
        this.owner.expandCombination(schema).forEach(function(itemSchema) {
            sources = sources.concat(self.getLayers(itemSchema).map(function(layer) {
                return layer.getSource();
            }));
        });
        for (var s = 0; s < sources.length; ++s) {
            features = features.concat(sources[s].getFeatures().filter(callback));
        }
        return features;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.trimGroupLayer_ = function(groupLayer, keepOne) {
        var sublayers = groupLayer.getLayers().getArray().slice();
        for (var i = 0; i < sublayers.length; ++i) {
            var sublayer  = sublayers[i];
            if (sublayer instanceof ol.layer.Group) {
                this.trimGroupLayer_(sublayer, false);
            } else {
                var popuplation = sublayer.getSource().getFeatures().length;
                if ((!keepOne || i > 0) && !popuplation) {
                    groupLayer.getLayers().remove(sublayer);
                }
            }
        }
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.replaceFeatures = function(schema, features) {
        var self = this;
        var layerGroups = [];
        this.owner.expandCombination(schema).forEach(function(itemSchema) {
            var layerGroup = self.getSchemaLayerGroup_(itemSchema, false);
            layerGroups.push(layerGroup);
            layerGroup.getLayersArray().forEach(function(layer) {
                layer.getSource().clear();
            });
        });
        this.addFeatures(features);

        layerGroups.forEach(function(layerGroup) {
            // GC: remove extra empty vector layers from their groups (will always keep one)
            self.trimGroupLayer_(layerGroup, true);
        });
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.addFeatures = function(features) {
        var self = this;
        var layerBuckets = {};
        features.forEach(function(feature) {
            var itemSchema = self.owner.getItemSchema(feature);
            if (!layerBuckets[itemSchema.schemaName]) {
                layerBuckets[itemSchema.schemaName] = {
                    groupLayer: self.schemaLayers_[itemSchema.schemaName],
                    schema: itemSchema,
                    features: []
                };
            }
            layerBuckets[itemSchema.schemaName].features.push(feature);
        });
        var mfpl = this.MAX_FEATURES_PER_LAYER;
        Object.keys(layerBuckets).forEach(function(bucketName) {
            var bucket = layerBuckets[bucketName];
            var layerIndex = -1;
            var chunkTarget, population;

            while (bucket.features.length) {
                // Scan for the next vector layer with free space / feature population below limit
                do {
                    ++layerIndex;
                    while (layerIndex >= bucket.groupLayer.getLayers().getLength()) {
                        // We're past the end of existing layers => create more
                        bucket.groupLayer.getLayers().push(self.createSchemaFeatureLayer_(bucket.schema));
                    }
                    chunkTarget = bucket.groupLayer.getLayers().item(layerIndex).getSource();
                    population = chunkTarget.getFeatures().length;
                } while (population >= mfpl);

                var chunkLength = Math.min(bucket.features.length, mfpl - population);
                var chunk = bucket.features.slice(0, chunkLength);
                chunkTarget.addFeatures(chunk);
                bucket.features = bucket.features.slice(chunkLength);
            }
        });
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.removeFeature = function(itemSchema, feature) {
        var layers = this.getLayers(itemSchema);
        for (var i = 0; i < layers.length; ++i) {
            // NOTE: hasFeature uses id / uid indexes and is a little faster than the RBush
            //       check in removeFeature if the feature does not exist
            if (layers[i].getSource().hasFeature(feature)) {
                layers[i].getSource().removeFeature(feature);
                return;
            }
        }
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initializeStyles_ = function (itemSchema, styleConfigs) {
        var styles = {};
        var keys = Object.keys(styleConfigs);
        for (var i = 0; i < keys.length; ++ i) {
            var key = keys[i];
            var settings = styleConfigs[key];
            var styleFn;
            if (key === 'default') {
                styleFn = this.createLayerStyleFunction_(itemSchema, settings);
            } else {
                settings = Object.assign({}, styleConfigs['default'], settings);
                styleFn = this.createStyleFunction_(settings);
            }
            styles[key] = styleFn;
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
        var layer = new ol.layer.Vector(options);
        layer.setStyle(this.schemaStyles_[schema.schemaName]['default']);
        this.registerLayerEvents(layer);
        return layer;
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
