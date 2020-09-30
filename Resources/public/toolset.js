(function ($) {
    "use strict";
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    /**
     * @param {ol.layer.Vector} layer
     * @param {Mapbender.Digitizer.DigitizingControlFactory} controlFactory
     *
     * @constructor
     */
    Mapbender.Digitizer.FeatureEditor = function(layer, controlFactory) {
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
        },
        registerSchemaEvents: function(schema) {
            var editor = this;
            // @todo: should not trigger / listen on source
            var source = schema.renderer.getLayer().getSource();
            source.on('controlFactory.FeatureModified', function (event) {
                if (schema.deactivateControlAfterModification) {
                    editor.activeInteraction && editor.activeInteraction.setActive(false);
                    editor.activeInteraction = null;
                }
            });

            $(schema).on("Digitizer.StartFeatureSave",function(event){
                editor.pause();
            });

            $(schema).on("Digitizer.EndFeatureSave",function(event){
                editor.resume();
            });
        }
    });

    Mapbender.Digitizer.Toolset = function(owner) {
        this.owner = owner;
    };

    Mapbender.Digitizer.Toolset.prototype = {
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
                var iconClass = "icon-" + buttonConfig.type.replace(/([A-Z])+/g, '-$1').toLowerCase(); // @todo: use font awesome css
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
        renderCurrentExtentSwitch: function (schema) {
            var menu = this;
            var $checkbox = $("<input type='checkbox' />");
            var title = Mapbender.trans('mb.digitizer.toolset.current-extent');
            $checkbox.prop('checked', schema.currentExtentSearch);
            $checkbox.change(function (e) {
                var currentExtentSearch = !!$(e.originalEvent.target).prop("checked");
                menu.changeCurrentExtentSearch_(currentExtentSearch)
            });
            var $div = $("<div/>");
            $div.addClass("form-group checkbox");
            var $label = $("<label/>");
            $label.text(title);
            $label.prepend($checkbox);
            $div.append($label);
            return [$div];
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
        }
    };


    Object.assign(Mapbender.Digitizer.FeatureEditor.prototype, {
        getDrawingTool: function(type, schema) {
            if (!this.tools_[schema.schemaName]) {
                this.tools_[schema.schemaName] = {};
            }
            if (!this.tools_[schema.schemaName][type]) {
                this.tools_[schema.schemaName][type] = this.createDrawingTool(type, schema);
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
            // @todo: replace event triggered on interaction with simple method call to toggle selectControl
            //        on renderer
            interaction.on('controlFactory.Activation', function (event) {
                schema.renderer.selectControl.setActive(!event.active);
            });

            schema.widget.mbMap.getModel().olMap.addInteraction(interaction);
            return interaction;
        }
    });

})(jQuery);
