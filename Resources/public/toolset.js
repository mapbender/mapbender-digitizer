(function ($) {
    "use strict";
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    /**
     * @param {*} owner jQueryUI widget instance
     * @param {ol.PluggableMap} olMap
     * @param {ol.layer.Vector} layer
     * @param {Mapbender.Digitizer.DigitizingControlFactory} controlFactory
     *
     * @constructor
     */
    Mapbender.Digitizer.FeatureEditor = function(owner, olMap, layer, controlFactory) {
        this.owner = owner;
        this.olMap = olMap;
        this.layer = layer;
        this.controlFactory = controlFactory;
        this.activeInteraction = null;
        this.paused_ = false;
        this.tools_ = {};
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
            // Disable select control (click on feature to open editor) while drawing
            // NOTE: hover highlighting remains active
            // @todo: provide access to select control without expecting monkey-patched schema property
            schema.renderer.selectControl.setActive(!state);
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
        getGeometryToolConfigs: function(schema) {
            if (schema.allowDigitize) {
                var geomType = schema.featureType.geomType;
                return schema.toolset || Mapbender.Digitizer.Utilities.getDefaultToolsetByGeomType(geomType);
            } else {
                return [];
            }
        },
        renderGeometryToolButtons: function(schema) {
            var geomType = schema.featureType.geomType;
            var configs = this.getGeometryToolConfigs(schema);
            var buttons = [];
            for (var i = 0; i < configs.length; ++i) {
                var buttonConfig = configs[i];
                var toolName = buttonConfig.type;
                var toolExists = typeof (Mapbender.Digitizer.DigitizingControlFactory.prototype[toolName]) === 'function';
                if (!toolExists) {
                    console.warn("interaction " + toolName + " does not exist");
                    continue;
                }
                var iconClass = this.iconMap_[toolName];
                var $icon = $(document.createElement('span')).addClass(iconClass);
                var tooltip = Mapbender.trans('mb.digitizer.toolset.' + geomType + '.' + buttonConfig.type);
                var $button = $(document.createElement('button'))
                    .attr({
                        type: 'button',
                        'data-toolname': toolName,
                        title: tooltip
                    })
                    .addClass('-fn-toggle-tool')
                    .append($icon)
                    .data({
                        schema: schema
                    })
                ;
                buttons.push($button);
            }
            return buttons;
        },
        /**
         * Renders buttons that do NOT represent geometry interactions
         * @param schema
         * @return {{}}
         * @static
         */
        renderUtilityButtons: function(schema) {
            var buttons = [];
            var widget = this.owner;
            var $button;

            if (schema.allowChangeVisibility) {
                $button = $("<button class='button' type='button'/>");
                $button.append('<i class="fa far fa-eye-slash">');
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.hideAll'));
                $button.click(function (event) {
                    schema.layer.getSource().getFeatures().forEach(function (feature) {
                        feature.set('hidden', true);
                    });
                });
                buttons.push($button);

                $button = $("<button class='button' type='button'/>");
                $button.append('<i class="fa far fa-eye">');
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.showAll'));
                $button.click(function (event) {
                    schema.layer.getSource().getFeatures().forEach(function (feature) {
                        feature.set('hidden', false);
                    });
                });
                buttons.push($button);
            }
            // If geometry modification is allowed, we must offer a way to save
            if (schema.allowDigitize) {
                $button = $("<button class='button' type='button'/>");
                $button.append('<i class="fa fas fa-save">');
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.saveAll'));
                $button.prop('disabled', true);
                $button.click(function () {
                    schema.layer.getSource().getFeatures().filter(function (feature) {
                        return (["isNew", "isChanged"].includes(feature.get("modificationState")));
                    }).forEach(function (feature) {
                        widget._saveItem(schema, undefined, feature);
                    });
                });
                buttons.push($button);
            }
            return buttons;
        },
        renderCurrentExtentSwitch: function (schema) {
            var widget = this.owner;
            var menu = this;
            var $checkbox = $('<input type="checkbox" name="current-extent" />');
            var title = Mapbender.trans('mb.digitizer.toolset.current-extent');
            $checkbox.prop('checked', schema.currentExtentSearch);
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
        changeCurrentExtentSearch_: function(currentExtentSearch) {
            var widget = this.owner;
            if (this.resultTable) {
                var features = this.schema.layer.getSource().getFeatures();
                if (currentExtentSearch) {
                    features = features.filter(function(feature) {
                        return widget.isInExtent(feature);
                    });
                }
                this.resultTable.redraw(features);  // @todo: resolve custom vis-ui dependency
            }
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
                var newInteraction = this.createDrawingTool(type, schema);
                this.tools_[schema.schemaName][type] = newInteraction;
                var widget = this.owner;
                newInteraction.on(ol.interaction.DrawEventType.DRAWEND, function(event) {
                    var feature = event.feature;
                    feature.set("modificationState", "isNew");
                    feature.set('dirty', true);
                    // @todo: do not rely on schema.widget property; editor should know its owner
                    widget._openEditDialog(schema, event.feature);
                });
            }
            return this.tools_[schema.schemaName][type];
        },
        /**
         * @param {String} type
         * @param {Object} schema
         */
        createDrawingTool: function(type, schema) {
            var interaction = this.controlFactory[type] && this.controlFactory[type](this.layer.getSource());
            if (!interaction) {
                console.warn("interaction " + type + " does not exist");
                return;
            }
            interaction.setActive(false);
            this.olMap.addInteraction(interaction);
            return interaction;
        }
    });

})(jQuery);
