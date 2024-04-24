;!(function() {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};


    /**
     * Checks if a polygon with or without holes has self-intersections by testing each edge against every other edge.
     * @param {ol.geom.Polygon} polygon - The OpenLayers Polygon geometry to check.
     * @returns {boolean} True if there are self-intersections, false otherwise.
     */
    function hasSelfIntersections(polygon) {
        const rings = polygon.getCoordinates(); // Includes outer boundary and any inner boundaries (holes)

        // Function to check if two line segments intersect
        function doLinesIntersect(a, b, c, d) {
            let a1 = b[1] - a[1];
            let b1 = a[0] - b[0];
            let c1 = a1 * a[0] + b1 * a[1];

            let a2 = d[1] - c[1];
            let b2 = c[0] - d[0];
            let c2 = a2 * c[0] + b2 * c[1];

            let determinant = a1 * b2 - a2 * b1;

            if (determinant === 0) {
                // Lines are parallel
                return false;
            } else {
                let x = (b2 * c1 - b1 * c2) / determinant;
                let y = (a1 * c2 - a2 * c1) / determinant;
                let onSegment = (point, linePoint1, linePoint2) => {
                    return Math.min(linePoint1[0], linePoint2[0]) <= point[0] && point[0] <= Math.max(linePoint1[0], linePoint2[0]) &&
                        Math.min(linePoint1[1], linePoint2[1]) <= point[1] && point[1] <= Math.max(linePoint1[1], linePoint2[1]);
                };
                return onSegment([x, y], a, b) && onSegment([x, y], c, d);
            }
        }

        // Check each ring against every other ring
        for (let i = 0; i < rings.length; i++) {
            const ring1 = rings[i];
            for (let j = i; j < rings.length; j++) {
                const ring2 = rings[j];
                // Compare each segment in ring1 with each segment in ring2
                for (let k = 0; k < ring1.length - 1; k++) {
                    for (let l = (i === j ? k + 2 : 0); l < ring2.length - 1; l++) {
                        // Avoid checking consecutive segments in the same ring, unless comparing different rings
                        if (i === j && k === 0 && l === ring1.length - 2) {
                            continue; // Closing segment of the same ring
                        }
                        if (doLinesIntersect(ring1[k], ring1[k + 1], ring2[l], ring2[l + 1])) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }




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
            let olMap = this.owner.mbMap.getModel().olMap;

            const interactions = olMap.getInteractions().getArray();
            interactions.forEach(interaction => {
                if (interaction instanceof ol.interaction.Snap && interaction.DIGITIZER) {
                    olMap.removeInteraction(interaction);
                }
            });
            const createSnapInteraction = (source) => {
                let snapInteraction = new ol.interaction.Snap({
                    source: source,
                    pixelTolerance: 10
                });
                snapInteraction.DIGITIZER = true; // Marking the interaction as custom
                olMap.addInteraction(snapInteraction);
            };

            let layers = this.owner.getSnappingLayers(schema);

            layers.forEach(layer => {
                let source = layer.getSource();
                createSnapInteraction(source);
            });
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
                let geom = feature.getGeometry();

                if (geom.getType() === 'Polygon' && hasSelfIntersections(geom)) {
                    $.notify(Mapbender.trans('mb.digitizer.intersection.error'));
                    setTimeout(() => {
                        widget.renderer.removeFeature(schema, feature);
                    }, 0);
                    return;
                }
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

                    let originalGeometry;

                    let interaction = new ol.interaction.Modify({
                        features: this.modifyingCollection_,
                        deleteCondition: function(event) {
                            return ol.events.condition.singleClick(event);
                        },
                    });

                     let handleKeyDown = (evt) => {
                        if (evt.key === 'Escape') {
                            $('.-fn-toggle-tool[data-toolname=modifyFeature]',this.owner.element).click();
                        }
                    }

                    const originalSetActive = interaction.setActive.bind(interaction);
                    interaction.setActive = function(active) {
                        originalSetActive(active);
                        if (active) {
                            document.addEventListener('keydown', handleKeyDown);
                        } else {
                            document.removeEventListener('keydown', handleKeyDown);
                        }
                    };

                    interaction.on('modifystart', function(e) {
                       if (e.features.getLength() > 1) {
                           console.error("Error: Modification of more than one feature is not possible");
                           return;
                       }
                       if (e.features.getLength() == 0) {
                           console.error("Error: Modification of zero features");
                           return;
                       }
                       originalGeometry = e.features.getArray()[0].getGeometry().clone();
                    });
                    interaction.on('modifyend', function(e) {
                        e.features.forEach(function(feature) {
                            let geom = feature.getGeometry();
                            if (geom.getType() === 'Polygon' && hasSelfIntersections(geom)) {
                                $.notify(Mapbender.trans('mb.digitizer.intersection.error'));
                                feature.setGeometry(originalGeometry);
                            }
                        });
                    });

                    return interaction;
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
