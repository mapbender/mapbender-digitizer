(function ($) {
    "use strict";
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
        this.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory();
        this.activeInteraction = null;
        this.paused_ = false;
        this.tools_ = {};
        this.modifyingCollection_ = new ol.Collection([]);
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
        }
    });

    Mapbender.Digitizer.Toolset = function(owner) {
        this.owner = owner;
    };

    Mapbender.Digitizer.Toolset.prototype = {
        iconMap_: {
            drawCircle: "icon-draw-circle",
            drawDonut: "icon-draw-donut",
            drawEllipse: "icon-draw-ellipse",
            drawLine: "icon-draw-line",
            drawPoint: "icon-draw-point",
            drawPolygon: "icon-draw-polygon",
            drawRectangle: "icon-draw-rectangle",
            modifyFeature: "icon-modify-feature",
            moveFeature: "icon-move-feature"
        },
        /**
         * @param {Object} schema
         * @return {Array<String>}
         * @static
         */
        getValidToolNames: function(schema) {
            switch (schema.featureType.geomType) {
                case 'point':
                case 'multipoint':
                    return ['drawPoint', 'moveFeature'];
                case 'line':
                case 'multiline':
                    return ['drawLine', 'modifyFeature', 'moveFeature'];
                case 'polygon':
                case 'multipolygon':
                    return ['drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut', 'modifyFeature', 'moveFeature'];
                default:
                    // everything
                    return [
                        'drawPoint',
                        'drawLine',
                        'drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut',
                        'modifyFeature', 'moveFeature'
                    ];
            }
        },
        pause: function() {
            // @todo: reintegrate with FeatureEditor :)
            $('button.-fn-toggle-tool', this.owner.element).prop('disabled', true);
        },
        resume: function() {
            // @todo: reintegrate with FeatureEditor :)
            $('button.-fn-toggle-tool', this.owner.element).prop('disabled', false);
        },
        getDefaultGeometryToolNames: function(schema) {
            return this.getValidToolNames(schema);
        },
        normalizeToolSet_: function(schema) {
            var seen = {};
            var toolSpecs = [];
            var subSchemas = this.owner.expandCombination(schema);
            var standardTools = ['modifyFeature', 'moveFeature'];
            var addModify = false;
            var addMove = false;
            for (var s = 0; s < subSchemas.length; ++s) {
                // Ignore tools if geometry editing not allowed
                if (!subSchemas[s].allowDigitize) {
                    continue;
                }
                var validNames = this.getValidToolNames(subSchemas[s]);
                // Note: Modify not allowed on single point geometries
                //       Move allowed on everything
                addModify = addModify || -1 !== validNames.indexOf('modifyFeature');
                addMove = true;
                var subSchemaTools = (subSchemas[s].toolset || validNames).map(function(tc) {
                    var obj = (typeof tc === 'string') && {type: tc} || Object.assign({}, tc);
                    obj.schema = obj.schema || subSchemas[s].schemaName;
                    return obj;
                }).filter(function(toolSpec) {
                    return (!seen[toolSpec.type])
                        && -1 === standardTools.indexOf(toolSpec.type)
                        && -1 !== validNames.indexOf(toolSpec.type)
                    ;
                });
                for (var t = 0; t < subSchemaTools.length; ++t) {
                    var toolSpec = subSchemaTools[t];
                    if (!seen[toolSpec.type]) {
                        toolSpecs.push(toolSpec);
                        seen[toolSpec.type] = true;
                    }
                }
            }
            if (addModify) {
                toolSpecs.push({type: 'modifyFeature'});
            }
            if (addMove) {
                toolSpecs.push({type: 'moveFeature'});
            }
            return toolSpecs;
        },
        renderGeometryToolButtons: function(schema) {
            var toolSpecs = this.normalizeToolSet_(schema);
            var buttons = [];
            for (var i = 0; i < toolSpecs.length; ++i) {
                var toolName = toolSpecs[i].type;
                var iconClass = this.iconMap_[toolName];
                var $icon = $(document.createElement('span')).addClass(iconClass);
                var tooltip = Mapbender.trans(toolSpecs[i].label || ('mb.digitizer.toolset.' + toolName));
                var btnSchema = this.owner.options.schemes[toolSpecs[i].schema] || schema;
                var $button = $(document.createElement('button'))
                    .attr({
                        type: 'button',
                        'data-toolname': toolName,
                        title: tooltip
                    })
                    .addClass('-fn-toggle-tool btn btn-default')
                    .append($icon)
                    .data({
                        schema: btnSchema
                    })
                ;
                buttons.push($button);
            }
            return buttons;
        },
        registerEvents: function() {
            var widget = this.owner;
            widget.element.on('click', '.-fn-visibility-all', function() {
                var state = !!$(this).attr('data-visibility');
                widget.renderer.forAllSchemaFeatures(widget._getCurrentSchema(), function (feature) {
                    if (widget.getItemSchema(feature).allowChangeVisibility) {
                        feature.set('hidden', !state);
                    }
                });
            });
        }
    };

    Object.assign(Mapbender.Digitizer.FeatureEditor.prototype, {
        getDrawingTool: function(type, schema) {
            if (!this.tools_[schema.schemaName]) {
                this.tools_[schema.schemaName] = {};
            }
            if (!this.tools_[schema.schemaName][type]) {
                var newInteraction = this.createDrawingTool(schema, type);
                this.tools_[schema.schemaName][type] = newInteraction;
                var widget = this.owner;
                newInteraction.on(ol.interaction.DrawEventType.DRAWEND, function(event) {
                    var feature = event.feature;
                    widget.initializeNewFeature(schema, feature);
                    widget._openEditDialog(schema, event.feature);
                });
                newInteraction.on([ol.interaction.ModifyEventType.MODIFYEND, ol.interaction.ModifyEventType.MODIFYSTART, ol.interaction.TranslateEventType.TRANSLATEEND], function(event) {
                    event.features.forEach(function(feature) {
                        feature.set('dirty', true);
                    });
                });
            }
            return this.tools_[schema.schemaName][type];
        },
        /**
         * @param {Object} schema
         * @param {String} type
         */
        createDrawingTool: function(schema, type) {
            var interaction;
            switch (type) {
                case 'modifyFeature':
                    interaction = new ol.interaction.Modify({
                        features: this.modifyingCollection_
                    });
                    break;
                case 'moveFeature':
                    interaction = this.controlFactory[type](this.owner);
                    break;
                default:
                    var layer = this.owner.getSchemaLayer(schema);
                    var source = layer && layer.getSource();
                    interaction = this.controlFactory[type](source);
                    break;
            }
            interaction.setActive(false);
            this.olMap.addInteraction(interaction);
            return interaction;
        }
    });

})(jQuery);
