(function ($) {
    "use strict";
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
        registerSchemaEvents: function(schema) {
            var editor = this;
            this.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
                var feature = event.feature;

                feature.on('Digitizer.ModifyFeature', function (event) {

                    if (schema.deactivateControlAfterModification) {
                        toolSet.activeInteraction && toolSet.activeInteraction.setActive(false);
                        toolSet.activeInteraction = null;
                    }

                    feature.changed();

                });
            });

            $(schema).on("Digitizer.StartFeatureSave",function(event){
                editor.pause();
            });

            $(schema).on("Digitizer.EndFeatureSave",function(event){
                editor.resume();
            });
        }
    });

    Mapbender.Digitizer.Toolset = function (schema) {

        var toolSet = this;
        toolSet.schema = schema;

        toolSet.buttons = schema.toolset;

        toolSet.element = $("<div />").addClass('digitizing-tool-set').addClass('left');
        toolSet.createToolbar();


    };

    Mapbender.Digitizer.Toolset.prototype = {


        createPlainControlButton_: function (rawButton) {
            var toolSet = this;

            var schema = toolSet.schema;
            var geomType = schema.getGeomType();

            var $button = $("<button class='button' type='button'/>");

            $button.addClass(rawButton.type);

            $button.attr('title', Mapbender.trans('mb.digitizer.toolset.' + geomType + '.' + rawButton.type));
            // add icon css class
            $button.addClass("icon-" + rawButton.type.replace(/([A-Z])+/g, '-$1').toLowerCase());

            return $button;
        },

        /**
         * Build Navigation
         *
         */
        createToolbar: function () {
            var toolSet = this;
            var schema = toolSet.schema;
            var element = $(toolSet.element);
            var buttons = toolSet.buttons || Mapbender.Digitizer.Utilities.getDefaultToolsetByGeomType(schema.getGeomType());

            buttons.forEach(function (rawButton) {

                var $button = toolSet.createPlainControlButton_(rawButton);

                element.append($button);
            });
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
