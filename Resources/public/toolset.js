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
    };

    Object.assign(Mapbender.Digitizer.FeatureEditor.prototype, {
        registerSchemaEvents: function(schema) {
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
                toolSet.activeInteraction.setActive(false);
            });

            $(schema).on("Digitizer.EndFeatureSave",function(event){
                toolSet.activeInteraction.setActive(true);
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
        /**
         * @param {String} type
         */
        getDrawingTool: function(type) {
            var interaction = this.controlFactory[type] && this.controlFactory[type](schema.layer.getSource());
            if (!interaction) {
                console.warn("interaction " + type + " does not exist");
                return;
            }

            interaction.setActive(false);

            schema.widget.map.addInteraction(interaction);



            $button.on('click',null,function (e) {

                if (interaction.getActive()) {
                    interaction.setActive(false);
                    toolSet.activeInteraction = null;
                } else {
                    toolSet.activeInteraction && toolSet.activeInteraction.setActive(false);
                    interaction.setActive(true);
                    toolSet.activeInteraction = interaction;
                }

            });

            // Keep activation status of buttons in sync with active control
            interaction.on('controlFactory.Activation', function (event) {
                if (event.active) {
                    $button.addClass('active');
                    // @todo: move selectControl property Schema => FeatureEdit
                    schema.selectControl.setActive(false);
                } else {
                    $button.removeClass('active');
                    // @todo: move selectControl property Schema => FeatureEdit
                    schema.selectControl.setActive(true);
                }
            });
        }
    });

})(jQuery);
