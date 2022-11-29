(function ($) {
    "use strict";
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {Mapbender.Digitizer.DigitizingControlFactory} controlFactory
     *
     * @constructor
     */
    Mapbender.Digitizer.FeatureEditor = function(owner, olMap, controlFactory) {
        this.owner = owner;
        this.olMap = olMap;
        this.controlFactory = controlFactory;
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
        this.listenedSchemas_ = {};
        this.unsavedFeatures_ = {};
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
         * @param {Array<Element>} [dmToolset] for reintegration (data-manager's entire tool set is a few [optional] buttons)
         */
        renderButtons: function(schema, dmToolset) {
            var $groupWrapper = $(document.createElement('div'))
                // @see https://getbootstrap.com/docs/3.4/components/#btn-groups-toolbar
                .addClass('btn-toolbar')
            ;
            var utilityButtons = _.union(this.extractDmButtons_(dmToolset || []), this.renderUtilityButtons(schema));
            if (utilityButtons.length) {
                $groupWrapper.append(this.renderButtonGroup_(utilityButtons));
            }
            var geometryButtons = this.renderGeometryToolButtons(schema);
            if (geometryButtons.length) {
                $groupWrapper.append(this.renderButtonGroup_(geometryButtons));
            }
            return $groupWrapper.get(0);
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
        getGeometryToolNames: function(schema) {
            return this.normalizeToolSet_(schema).map(function(toolSpec) {
                return toolSpec.type;
            });
        },
        normalizeToolSet_: function(schema) {
            var seen = {};
            var toolSpecs = [];
            var standardTools = ['modifyFeature', 'moveFeature'];
            if (schema.allowDigitize) {
                var validNames = this.getValidToolNames(schema);
                // Should be false with a point / multipoint schema (modify meaningless vs move), true otherwise
                var addModify = -1 !== validNames.indexOf('modifyFeature');
                var normalized = (schema.toolset || this.getDefaultGeometryToolNames(schema)).map(function(tc) {
                    var obj = (typeof tc === 'string') && {type: tc} || Object.assign({}, tc);
                    obj.schema = schema;
                    return obj
                }).filter(function(toolSpec) {
                    return -1 === standardTools.indexOf(toolSpec.type)
                        && -1 !== validNames.indexOf(toolSpec.type)
                    ;
                });
                // Deduplicate
                for (var t = 0; t < normalized.length; ++t) {
                    var toolSpec = normalized[t];
                    if (!seen[toolSpec.type]) {
                        toolSpecs.push(toolSpec);
                        seen[toolSpec.type] = true;
                    }
                }
                if (addModify) {
                    toolSpecs.push({type: 'modifyFeature'});
                }
                toolSpecs.push({type: 'moveFeature'});
            }
            return toolSpecs;
        },
        renderGeometryToolButtons: function(schema) {
            var toolNames = this.getGeometryToolNames(schema);
            var buttons = [];
            for (var i = 0; i < toolNames.length; ++i) {
                var toolName = toolNames[i];
                var iconClass = this.iconMap_[toolName];
                var $icon = $(document.createElement('span')).addClass(iconClass);
                var tooltip = Mapbender.trans('mb.digitizer.toolset.' + toolName);
                var $button = $(document.createElement('button'))
                    .attr({
                        type: 'button',
                        'data-toolname': toolName,
                        title: tooltip
                    })
                    .addClass('-fn-toggle-tool btn btn-default')
                    .append($icon)
                    .data({
                        schema: schema
                    })
                ;
                buttons.push($button);
            }
            return buttons;
        },
        registerEvents: function() {
            var widget = this.owner;
            widget.element.on('click', '.-fn-hide-all', function() {
                var source = widget.getSchemaLayer(widget._getCurrentSchema()).getSource();
                source.getFeatures().forEach(function (feature) {
                    feature.set('hidden', true);
                });
            });
            widget.element.on('click', '.-fn-show-all', function() {
                var source = widget.getSchemaLayer(widget._getCurrentSchema()).getSource();
                source.getFeatures().forEach(function (feature) {
                    feature.set('hidden', false);
                });
            });
            widget.element.on('click', '.-fn-save-all', function() {
                var schema = widget._getCurrentSchema();
                var source = widget.getSchemaLayer(schema).getSource();
                var features = source.getFeatures().filter(function (feature) {
                    return feature.get('dirty');
                });
                widget.updateMultiple(schema, features);
            });
        },
        setSchema: function(schema) {
            var schemaName = schema.schemaName;
            if (!this.listenedSchemas_[schemaName]) {
                var widget = this.owner;
                this.unsavedFeatures_[schemaName] = []

                var source = this.owner.getSchemaLayer(schema).getSource();
                var unsavedFeatureList = this.unsavedFeatures_[schemaName];
                var updateSaveAll = function() {
                    $('.-fn-save-all', widget.element).prop('disabled', !unsavedFeatureList.length);
                }
                var trackModified = function(feature, dirtyState) {
                    var index = unsavedFeatureList.indexOf(feature);
                    // Ignore newly created features (empty id) in tracking
                    if (dirtyState && -1 === index && widget._getUniqueItemId(schema, feature)) {
                        unsavedFeatureList.push(feature);
                        updateSaveAll();
                    }
                    if (!dirtyState && -1 !== index) {
                        unsavedFeatureList.splice(index, 1);
                        updateSaveAll();
                    }
                };
                var addFeature = function(feature) {
                    feature.on(ol.ObjectEventType.PROPERTYCHANGE, function (event) {
                        if (event.key === 'dirty') {
                            trackModified(feature, feature.get('dirty'));
                        }
                    });
                    trackModified(feature, feature.get('dirty'));
                };
                source.getFeatures().forEach(function(feature) {
                    addFeature(feature);
                });
                source.on(ol.source.VectorEventType.ADDFEATURE, function(event) {
                    addFeature(event.feature);
                });
                source.on(ol.source.VectorEventType.REMOVEFEATURE, function(event) {
                    // feature going away, remove from tracking
                    trackModified(event.feature, false);
                });
                // Avoid binding events again for the same schema
                this.listenedSchemas_[schemaName] = true;
            } else {
                // empty unsaved list (in-place)
                this.unsavedFeatures_[schemaName].splice(0, -1);
            }
        },
        /**
         * Renders buttons that do NOT represent geometry interactions
         * @param schema
         * @return {{}}
         * @static
         */
        renderUtilityButtons: function(schema) {
            var buttons = [];
            var $button;

            if (schema.allowChangeVisibility) {
                $button = $('<button type="button" class="btn -fn-hide-all btn-default" />');
                $button.append('<i class="fa far fa-eye-slash">');
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.hideAll'));
                buttons.push($button);

                $button = $('<button type="button" class="btn -fn-show-all btn-default" />');
                $button.append('<i class="fa far fa-eye">');
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.showAll'));
                buttons.push($button);
            }
            // If geometry modification is allowed, we must offer a way to save
            if (schema.allowDigitize) {
                $button = $('<button type="button" class="btn -fn-save-all btn-success" />');
                $button.append('<i class="fa fas fa-save">');
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.saveAll'));
                $button.prop('disabled', true);
                buttons.push($button);
            }
            return buttons;
        },
        renderCurrentExtentSwitch: function (schema) {
            var widget = this.owner;
            var $checkbox = $('<input type="checkbox" name="current-extent" />');
            var title = Mapbender.trans('mb.digitizer.toolset.current-extent');
            $checkbox.prop('checked', schema.searchType === 'currentExtent');
            $checkbox.change(function (e) {
                widget._getData(schema);
            });
            var $div = $("<div/>");
            $div.addClass("form-group checkbox");
            var $label = $("<label/>");
            $label.text(title);
            $label.prepend($checkbox);
            $div.append($label);
            return $div;
        },
        renderButtonGroup_: function(contents) {
            var $group = $(document.createElement('div'))
                // @see https://getbootstrap.com/docs/3.4/components/#btn-groups
                .addClass('btn-group')
            ;
            $group.append(contents);
            return $group.get(0);
        },
        /**
         * @param {Array<Element>} dmToolset
         * @private
         * @return {Array<Element>}
         */
        extractDmButtons_: function(dmToolset) {
            var $buttons = $('button,.btn,.button', $(dmToolset));
            // Prevent top-level item creation
            // Unlinke DataManager, all item creation happens with a drawing tool,
            // and doesn't work when using pure form entry
            $buttons = $buttons.not('.-fn-create-item');
            return $buttons.get();
        }
    };

    Object.assign(Mapbender.Digitizer.FeatureEditor.prototype, {
        getDrawingTool: function(type, schema) {
            if (!this.tools_[schema.schemaName]) {
                this.tools_[schema.schemaName] = {};
            }
            if (!this.tools_[schema.schemaName][type]) {
                var newInteraction = this.createDrawingTool(type);
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
         * @param {String} type
         */
        createDrawingTool: function(type) {
            var widget = this.owner;
            var schema = widget._getCurrentSchema();
            var layer = schema && widget.getSchemaLayer(schema);
            var source = layer && layer.getSource();
            var interaction;
            switch (type) {
                case 'modifyFeature':
                    interaction = new ol.interaction.Modify({
                        features: this.modifyingCollection_
                    });
                    break;
                default:
                    interaction = this.controlFactory[type](source);
                    break;
            }
            interaction.setActive(false);
            this.olMap.addInteraction(interaction);
            return interaction;
        }
    });

})(jQuery);
