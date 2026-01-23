(function () {
    "use strict";

    /**
     * Feature renderer class for managing feature layers and styles
     */
    class FeatureRenderer {
        /**
         * Limit max features per individual ol.layer.Vector
         * If more features are loaded, a new layer is appended to the item schema's group layer.
         * This speeds up hover interactions (=full redraw of layer containing feature) considerably.
         */
        static MAX_FEATURES_PER_LAYER = 75;

        /**
         * @param {*} owner jQueryUI widget instance
         * @param {ol.Map} olMap
         * @param {Mapbender.Digitizer.StyleAdapter} [styleAdapter]
         */
        constructor(owner, olMap, styleAdapter) {
            this.owner = owner;
            this.olMap = olMap;
            this.styleAdapter = styleAdapter || owner.createStyleAdapter();
            this.globalStyles_ = this.initializeGlobalStyles_();
            this.schemaStyles_ = {};
            this.schemaLayers_ = {};
            this.stateMap_ = {};
        }

        disable() {
            const layerNames = Object.keys(this.schemaLayers_);
            for (let i = 0; i < layerNames.length; ++i) {
                const layer = this.schemaLayers_[layerNames[i]];
                layer.setVisible(false);
            }
        }

        /**
         * @param {Object} schema
         * @param {ol.Feature} feature
         */
        initializeFeature(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            if (schema.allowCustomStyle) {
                this.customStyleFeature_(feature);
            }
            this.owner.adjustStyle(schema, feature);
        }

        /**
         * @param {*} id
         * @param {Object} [itemSchema]
         * @return {ol.Feature|null}
         */
        getFeatureById(id, itemSchema) {
            const layers = !itemSchema && Object.values(this.schemaLayers_) || this.getLayers(itemSchema);
            for (let i = 0; i < layers.length; ++i) {
                const sublayers = layers[i].getLayersArray();
                for (let j = 0; j < sublayers.length; ++j) {
                    const feature = sublayers[j].getSource().getFeatureById(id);
                    if (feature) {
                        return feature;
                    }
                }
            }
            return null;
        }

        /**
         * @param {Object} schema
         * @param {Object} styleConfig
         * @return {Function}
         * @private
         */
        createLayerStyleFunction_(schema, styleConfig) {
            const self = this;
            return (function(styleConfig) {
                const defaultFn = self.createStyleFunction_(styleConfig);
                return function(feature) {
                    const customFn = feature.get('customStyleFn');
                    if (customFn) {
                        return customFn(feature);
                    } else {
                        return defaultFn(feature);
                    }
                };
            })(styleConfig);
        }

        /**
         * @param {Object} styleConfig
         * @param {ol.Feature} feature
         * @return {Object}
         */
        resolveStyleConfigPlaceholders(styleConfig, feature) {
            return this.styleAdapter.resolvePlaceholders(styleConfig, feature.get('data') || {});
        }

        /**
         * @param {Object} styleConfig
         * @return {Function}
         * @private
         */
        createStyleFunction_(styleConfig) {
            return this.styleAdapter.styleFunctionFromSvgRules(styleConfig, function(feature) {
                return feature.get('data') || {};
            });
        }

        /**
         * @param {ol.Feature} feature
         */
        updateFeatureStyle(feature) {
            let itemSchema, style;
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
            // Avoid triggering recursive change events if same style already set.
            if (style !== feature.getStyle()) {
                feature.setStyle(style);
            }
        }

        /**
         * @param {Object} schema
         * @param {boolean} state
         */
        toggleSchema(schema, state) {
            // @todo ml: respect displayPermanent / displayOnInActive on a sub-schema basis
            // save in stateMap if the layer is not yet initialised
            this.stateMap_[schema.schemaName] = state;
            const subSchemas = !schema && [] || this.owner.expandCombination(schema);
            for (let s = 0; s < subSchemas.length; ++s) {
                const layer = this.schemaLayers_[subSchemas[s].schemaName];
                if (layer) {
                    layer.setVisible(!!state);
                }
            }
        }

        /**
         * @param {Object} schema
         * @returns {Array<ol.layer.Vector>}
         */
        getLayers(schema) {
            const subSchemas = this.owner.expandCombination(schema);
            let layers = [];
            for (let s = 0; s < subSchemas.length; ++s) {
                const subSchema = subSchemas[s];
                layers = this.getSchemaLayerGroup_(subSchema, true).getLayersArray(layers);
            }
            return layers;
        }

        /**
         * @param {Object} itemSchema
         * @param {boolean} [init]
         * @returns {ol.layer.Group|null}
         * @private
         */
        getSchemaLayerGroup_(itemSchema, init) {
            if (!this.schemaLayers_[itemSchema.schemaName] && init) {
                this.schemaLayers_[itemSchema.schemaName] = this.initSchemaLayerGroup_(itemSchema);
            }
            return this.schemaLayers_[itemSchema.schemaName] || null;
        }

        /**
         * @param {Object} itemSchema
         * @return {ol.layer.Group}
         * @private
         */
        initSchemaLayerGroup_(itemSchema) {
            const schemaName = itemSchema.schemaName;
            const styleConfigs = (this.owner.options.schemes[schemaName] || {}).styles;
            this.schemaStyles_[schemaName] = this.initializeStyles_(itemSchema, styleConfigs || {});
            const group = new ol.layer.Group();
            // Need at least one layer inside group so draw controls
            // have a valid target layer + source even on empty datasets
            const firstLayer = this.createSchemaFeatureLayer_(itemSchema);
            group.getLayers().push(firstLayer);
            if (schemaName in this.stateMap_) {
                group.setVisible(this.stateMap_[schemaName]);
            }
            this.olMap.addLayer(group);
            return group;
        }

        /**
         * @param {ol.layer.Vector} layer
         */
        registerLayerEvents(layer) {
            const self = this;
            layer.getSource().on('change', function() {
                self.owner.updateSaveAll();
            });
            layer.getSource().on('changefeature', function(evt) {
                self.updateFeatureStyle(evt.feature);
            });
        }

        /**
         * @param {Function} callback
         */
        forAllFeatures(callback) {
            let layers = [];
            Object.values(this.schemaLayers_).forEach(function(layer) {
                layers = layer.getLayersArray(layers);
            });
            for (let i = 0; i < layers.length; ++i) {
                layers[i].getSource().forEachFeature(callback);
            }
        }

        /**
         * @param {Object} schema
         * @param {Function} callback
         */
        forAllSchemaFeatures(schema, callback) {
            const self = this;
            let layers = [];
            this.owner.expandCombination(schema).forEach(function(itemSchema) {
                if (self.schemaLayers_[itemSchema.schemaName]) {
                    self.schemaLayers_[itemSchema.schemaName].getLayersArray(layers);
                }
            });
            for (let i = 0; i < layers.length; ++i) {
                layers[i].getSource().forEachFeature(callback);
            }
        }

        /**
         * @param {Object} schema
         * @param {Function} callback
         * @return {Array<ol.Feature>}
         */
        filterFeatures(schema, callback) {
            const self = this;
            let features = [];
            let sources = [];
            this.owner.expandCombination(schema).forEach(function(itemSchema) {
                sources = sources.concat(self.getLayers(itemSchema).map(function(layer) {
                    return layer.getSource();
                }));
            });
            for (let s = 0; s < sources.length; ++s) {
                features = features.concat(sources[s].getFeatures().filter(callback));
            }
            return features;
        }

        /**
         * @param {ol.layer.Group} groupLayer
         * @param {boolean} keepOne
         * @private
         */
        trimGroupLayer_(groupLayer, keepOne) {
            const sublayers = groupLayer.getLayers().getArray().slice();
            for (let i = 0; i < sublayers.length; ++i) {
                const sublayer = sublayers[i];
                if (sublayer instanceof ol.layer.Group) {
                    this.trimGroupLayer_(sublayer, false);
                } else {
                    const popuplation = sublayer.getSource().getFeatures().length;
                    if ((!keepOne || i > 0) && !popuplation) {
                        groupLayer.getLayers().remove(sublayer);
                    }
                }
            }
        }

        /**
         * @param {Object} schema
         * @param {Array<ol.Feature>} features
         */
        replaceFeatures(schema, features) {
            const self = this;
            const layerGroups = [];
            this.owner.expandCombination(schema).forEach(function(itemSchema) {
                const layerGroup = self.getSchemaLayerGroup_(itemSchema, false);
                if (layerGroup) {
                    layerGroups.push(layerGroup);
                    layerGroup.getLayersArray().forEach(function(layer) {
                        layer.getSource().clear();
                    });
                }
            });
            this.addFeatures(features);

            layerGroups.forEach(function(layerGroup) {
                // GC: remove extra empty vector layers from their groups (will always keep one)
                self.trimGroupLayer_(layerGroup, true);
            });
        }

        /**
         * @param {Array<ol.Feature>} features
         */
        addFeatures(features) {
            const self = this;
            const layerBuckets = {};
            features.forEach(function(feature) {
                const itemSchema = self.owner.getItemSchema(feature);
                if (!layerBuckets[itemSchema.schemaName]) {
                    layerBuckets[itemSchema.schemaName] = {
                        groupLayer: self.schemaLayers_[itemSchema.schemaName],
                        schema: itemSchema,
                        features: []
                    };
                }
                layerBuckets[itemSchema.schemaName].features.push(feature);
            });
            const mfpl = FeatureRenderer.MAX_FEATURES_PER_LAYER;
            Object.keys(layerBuckets).forEach(function(bucketName) {
                const bucket = layerBuckets[bucketName];
                let layerIndex = -1;
                let chunkTarget, population;

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

                    const chunkLength = Math.min(bucket.features.length, mfpl - population);
                    const chunk = bucket.features.slice(0, chunkLength);
                    chunkTarget.addFeatures(chunk);
                    bucket.features = bucket.features.slice(chunkLength);
                }
            });
        }

        /**
         * @param {Object} itemSchema
         * @param {ol.Feature} feature
         */
        removeFeature(itemSchema, feature) {
            const layers = this.getLayers(itemSchema);
            for (let i = 0; i < layers.length; ++i) {
                // NOTE: hasFeature uses id / uid indexes and is a little faster than the RBush
                //       check in removeFeature if the feature does not exist
                if (layers[i].getSource().hasFeature(feature)) {
                    layers[i].getSource().removeFeature(feature);
                    return;
                }
            }
        }

        /**
         * @param {Object} itemSchema
         * @param {Object} styleConfigs
         * @return {Object}
         * @private
         */
        initializeStyles_(itemSchema, styleConfigs) {
            const styles = {};
            const keys = Object.keys(styleConfigs);
            for (let i = 0; i < keys.length; ++i) {
                const key = keys[i];
                let settings = styleConfigs[key];
                let styleFn;
                if (key === 'default') {
                    styleFn = this.createLayerStyleFunction_(itemSchema, settings);
                } else {
                    settings = Object.assign({}, styleConfigs['default'], settings);
                    styleFn = this.createStyleFunction_(settings);
                }
                styles[key] = styleFn;
            }
            return styles;
        }

        /**
         * @return {Object}
         * @private
         */
        initializeGlobalStyles_() {
            return {
                invisible: new ol.style.Style(),
                editing: this.createEditingStyle_()
            };
        }

        /**
         * @param {Object} schema
         * @return {ol.layer.Vector}
         * @private
         */
        createSchemaFeatureLayer_(schema) {
            const options = {
                source: new ol.source.Vector(),
                visible: true
            };
            if (schema.maxScale) {
                options.maxResolution = Mapbender.Model.scaleToResolution(parseInt(schema.maxScale, 10));
            }
            if (schema.minScale) {
                options.inResolution = Mapbender.Model.scaleToResolution(parseInt(schema.minScale, 10));
            }
            const layer = new ol.layer.Vector(options);
            layer.setStyle(this.schemaStyles_[schema.schemaName]['default']);
            this.registerLayerEvents(layer);
            return layer;
        }

        /**
         * @param {ol.Feature} feature
         * @private
         */
        customStyleFeature_(feature) {
            const itemSchema = this.owner.getItemSchema(feature);
            const styleField = itemSchema.featureType.styleField;
            const itemData = feature.get("data");
            const jsonStyle = styleField && itemData && itemData[styleField];

            if (jsonStyle) {
                const styleConfig = JSON.parse(jsonStyle);
                const styleFn = this.createStyleFunction_(styleConfig);
                feature.set('customStyleConfig', styleConfig);
                feature.set('customStyleFn', styleFn);
            }
        }

        /**
         * @return {Function}
         * @private
         */
        createEditingStyle_() {
            // Adopted from "ol4-extensions" repository
            // @see https://github.com/mapbender/ol4-extensions/blob/0.0.4/selectableModify.js#L3
            const baseStyle = ol.style.Style.defaultFunction()[0].clone();
            const extractEdges = function(geometry) {
                let polygons, lines;
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
                    for (let p = 0; p < polygons.length; ++p) {
                        const polygon = polygons[p];
                        const rings = polygon.getCoordinates();
                        for (let r = 0; r < rings.length; ++r) {
                            const ring = rings[r];
                            lines.push(new ol.geom.LineString(ring));
                        }
                    }
                }
                return lines || [];
            };
            const verticesStyle = new ol.style.Style({
                geometry: function(feature) {
                    // Concatenate all vertices
                    const coordinates = Array.prototype.concat.apply([], extractEdges(feature.getGeometry()).map(function(lineString) {
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
            const midpointStyle = new ol.style.Style({
                geometry: function(feature) {
                    const lineStrings = extractEdges(feature.getGeometry());
                    const coordinates = Array.prototype.concat.apply([], lineStrings.map(function(lineString) {
                        const midpoints = [];
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

            return function(feature) {
                return [baseStyle, verticesStyle, midpointStyle];
            };
        }
    }

    Mapbender.Digitizer.FeatureRenderer = FeatureRenderer;
})();
