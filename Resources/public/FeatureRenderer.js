(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Mapbender.Digitizer.StyleAdapter} styleAdapter
     * @param {Object} schema
     * @constructor
     */
    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(owner, olMap, styleAdapter) {
        this.owner = owner;
        this.olMap = olMap;
        this.styleAdapter = styleAdapter;
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
        createLayerStyleFunction_: function(styleConfig) {
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
        updateFeatureStyle: function(schema, feature) {
            if (feature.get('editing')) {
                feature.setStyle(this.globalStyles_['editing']);
            } else if (feature.get("hidden")) {
                feature.setStyle(this.globalStyles_['invisible']);
            } else if (feature.get('hover')) {
                feature.setStyle(this.schemaStyles_[schema.schemaName]['select']);
            } else if (feature.get('dirty')) {
                feature.setStyle(this.schemaStyles_[schema.schemaName]['unsaved']);
            } else {
                feature.setStyle(null);
            }
        }
    });

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        // @todo: salvage this
        onFeatureUpdatedOnServer: function(schema) {
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
            layer.setStyle(this.createLayerStyleFunction_(styleConfigs['default']));
            delete this.schemaStyles_[schema.schemaName]['default'];
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
