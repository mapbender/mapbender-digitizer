;!(function() {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     *
     * @constructor
     */
    Mapbender.Digitizer.FeatureEditor = function(owner, olMap) {
        this.owner = owner;
        this.olMap = olMap;
        this.activeInteraction = null;
        this.paused_ = false;
        this.schemaTools_ = {};
        this.sharedTools_ = {};
        this.modifyingCollection_ = new ol.Collection([]);
        this.geometryFunctions_ = {};
    };

    Object.assign(Mapbender.Digitizer.FeatureEditor.prototype, {
        /**
         * @param {boolean} state
         */
        setActive: function(state) {
            if (this.activeInteraction) {
                this.activeInteraction.setActive(state);
            }
            // cannot resume from this
            this.paused_ = false;
        },
        pause: function() {
            if (!this.paused_ && this.activeInteraction && this.activeInteraction.getActive()) {
                this.activeInteraction.setActive(false);
                this.paused_ = true;
            }
        },
        resume: function() {
            if (this.paused_ && this.activeInteraction) {
                this.activeInteraction.setActive(true);
            }
            this.paused_ = false;
        },
        toggleTool: function(toolName, schema, state) {
            var tool = this.getDrawingTool(toolName, schema);
            if (state) {
                if (this.activeInteraction && this.activeInteraction !== tool) {
                    console.warn("WARNING: enabling multiple drawing tools at the same time", toolName, this.activeInteraction);
                }
            }
            this.activeInteraction = state && tool || null;
            tool.setActive(!!state);
        },
        setEditFeature: function(feature) {
            this.modifyingCollection_.forEach(function(feature) {
                feature.set('editing', false);
            });
            this.modifyingCollection_.clear();
            if (feature) {
                feature.set('editing', true);
                this.modifyingCollection_.push(feature);
            }
        },
        getDrawingTool: function(type, schema) {
            let tool;
            if (type === 'moveFeature' || type === 'modifyFeature') {
                tool = this.getModificationTool_(type);
            } else {
                tool = this.getCreationTool_(schema, type);
            }
            this.addSnapInteraction(schema);
            return tool;
        },

        addSnapInteraction: function(schema) {
            let layer = this.owner.getSchemaLayer(schema);
            let olMap = this.owner.mbMap.getModel().olMap;
            let source = layer.getSource();

            // remove existing custom snap interactions
            const interactions = olMap.getInteractions().getArray();
            for (let i = interactions.length - 1; i >= 0; i--) {
                let interaction = interactions[i];
                if (interaction instanceof ol.interaction.Snap && interaction.DIGITIZER) {
                    olMap.removeInteraction(interaction);
                }
            }

            // create a new snap interaction with a custom property
            let snapInteraction = new ol.interaction.Snap({
                source,
                pixelTolerance: 10
            });
            snapInteraction.DIGITIZER = true;  // Adding a custom property
            olMap.addInteraction(snapInteraction);
        },

        getModificationTool_: function(type) {
            if (!this.sharedTools_[type]) {
                var interaction = this.createModificationTool_(type);
                this.addModifyEvents_(interaction);
                this.initMap_(interaction);
                this.sharedTools_[type] = interaction;
            }
            return this.sharedTools_[type];
        },
        getCreationTool_: function(schema, type) {
            if (!this.schemaTools_[schema.schemaName]) {
                this.schemaTools_[schema.schemaName] = {};
            }
            var toolGroup = this.schemaTools_[schema.schemaName];
            if (!toolGroup[type]) {
                var interaction = this.createDrawingTool_(type, schema);
                this.addCreateEvents_(interaction, schema);
                this.initMap_(interaction);
                toolGroup[type] = interaction;
            }
            return toolGroup[type];
        },
        initMap_: function(interaction) {
            interaction.setActive(false);
            this.olMap.addInteraction(interaction);
        },
        addCreateEvents_: function(interaction, schema) {
            var widget = this.owner;
            interaction.on(ol.interaction.DrawEventType.DRAWEND, function(event) {
                var feature = event.feature;
                widget.initializeNewFeature(schema, feature);
                widget._openEditDialog(schema, event.feature);
            });
            this.addModifyEvents_(interaction);  // For drawDonut
        },
        addModifyEvents_: function(interaction) {
            interaction.on([ol.interaction.ModifyEventType.MODIFYEND, ol.interaction.ModifyEventType.MODIFYSTART, ol.interaction.TranslateEventType.TRANSLATEEND], function(event) {
                event.features.forEach(function(feature) {
                    feature.set('dirty', true);
                });
            });
        },
        /**
         * @param {String} type
         * @param {*} schema
         */
        createDrawingTool_: function(type, schema) {
            var layer = this.owner.getSchemaLayers(schema)[0];

            var options = {
                source: layer.getSource(),
                // prevent double-click zoom on draw end / attribute editor opening on nearby existing geometry
                stopClick: true,
                condition: this.leftClickOnly_
            };
            switch (type) {
                case 'drawPoint':
                    options.type = 'Point';
                    return new ol.interaction.Draw(options);
                case 'drawLine':
                    options.type = 'LineString';
                    return new ol.interaction.Draw(options);
                case 'drawPolygon':
                    options.type = 'Polygon';
                    return new ol.interaction.Draw(options);
                case 'drawRectangle':
                case 'drawCircle':
                case 'drawEllipse':
                    options.type = 'Circle';
                    options.freehand = true;
                    options.geometryFunction = this.getGeometryFunction_(type);
                    return new ol.interaction.Draw(options);
                case 'drawDonut':
                    options.type = 'Polygon';
                    return new Mapbender.Digitizer.Interactions.DrawDonut(options);
                default:
                    throw new Error("Unhandled tool type " + type);
            }
        },
        createModificationTool_: function(type) {
            switch (type) {
                case 'modifyFeature':
                    return new ol.interaction.Modify({
                        features: this.modifyingCollection_
                    });
                case 'moveFeature':
                    return this.createMoveFeature_();
                default:
                    throw new Error("Unhandled tool type " + type);
            }
        },
        createMoveFeature_: function() {
            var self = this;
            // ol.interaction.Translate does not have a "condition" option, but it
            // supports completely replacing the handleDownEvent method via Pointer
            // base class.
            // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Pointer.js#L57
            var handleDownEvent = function(event) {
                return self.leftClickOnly_(event) && ol.interaction.Translate.prototype.handleDownEvent.call(this, event);
            };

            return new ol.interaction.Translate({
                handleDownEvent: handleDownEvent,
                layers: function(layer) {
                    var schema = self.owner._getCurrentSchema();
                    var subSchemas = (schema && self.owner.expandCombination(schema) || []).filter(function(schema) {
                        return schema.allowDigitize;
                    });
                    for (var s = 0; s < subSchemas.length; ++s) {
                        if (-1 !== self.owner.getSchemaLayers(subSchemas[s]).indexOf(layer)) {
                            return true;
                        }
                    }
                    return false;
                }
            });
        },
        leftClickOnly_: function(event) {
            if (event.pointerEvent && event.pointerEvent.button !== 0) {
                return false;
            } else {
                return ol.events.condition.noModifierKeys(event);
            }
        },
        getGeometryFunction_: function(type) {
            if (typeof (this.geometryFunctions_[type]) !== 'undefined') {
                return this.geometryFunctions_[type];
            }
            var geometryFunction = null;
            if (type === 'drawRectangle') {
                geometryFunction = ol.interaction.Draw.createBox();
            }
            if (type === 'drawCircle' || type === 'drawEllipse') {
                geometryFunction = function(coordinates, geometry) {
                    var center = coordinates[0];
                    var last = coordinates[1];
                    var dx = center[0] - last[0];
                    var dy = type === 'drawCircle' && dx || (center[1] - last[1]);
                    var radius = Math.sqrt(dx * dx + dy * dy);
                    var circle = new ol.geom.Circle(center, radius);
                    var polygon = ol.geom.Polygon.fromCircle(circle, 64);
                    polygon.scale(dx/radius, dy/radius);
                    if (!geometry) {
                        geometry = polygon;
                    } else {
                        geometry.setCoordinates(polygon.getCoordinates());
                    }
                    return geometry;
                };
            }
            this.geometryFunctions_[type] = geometryFunction;
            return geometryFunction;
        },
        __dummy__: null
    });
}());
