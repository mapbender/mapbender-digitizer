(function ($) {
    "use strict";

    Mapbender.Digitizer.Toolset = function (options) {

        var toolSet = this;
        $.extend(toolSet, options);

        var schema = toolSet.schema;

        toolSet.buttons = schema.toolset && !_.isEmpty(schema.toolset) ? schema.toolset : Mapbender.Digitizer.Utilities.getDefaultToolsetByGeomType(schema.featureType.geomType);

        toolSet.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(toolSet.schema.widget.map);

        toolSet.element = $("<div />").addClass('digitizing-tool-set').addClass('left');
        toolSet.createToolbar();

    };

    Mapbender.Digitizer.Toolset.prototype = {


        createPlainControlButton_: function (rawButton,interaction) {
            var toolSet = this;
            var schema = rawButton.schema;

            var geomType = toolSet.geomType;

            var $button = $("<button class='button' type='button'/>");

            $button.addClass(rawButton.type);

            $button.attr('title', interaction.title || Mapbender.DigitizerTranslator.translate('toolset.' + geomType + '.' + rawButton.type));
            // add icon css class
            $button.addClass(interaction.className || "icon-" + rawButton.type.replace(/([A-Z])+/g, '-$1').toLowerCase());

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
            var controlFactory = toolSet.controlFactory;
            var buttons = toolSet.buttons;

            buttons.forEach(function (rawButton) {

                var type = rawButton.type;

                var interaction = controlFactory[type] && controlFactory[type](toolSet.schema.layer.getSource());
                if (!interaction) {
                    console.warn("interaction " + type + " does not exist");
                    return;
                }

                var $button = toolSet.createPlainControlButton_(rawButton,interaction);

                interaction.setActive(false);

                schema.widget.map.addInteraction(interaction);

                $button.click(function (e) {

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
                        schema.selectControl.setActive(false);
                    } else {
                        $button.removeClass('active');
                        schema.selectControl.setActive(true);
                    }

                });

                element.append($button);
            });
        },

    };

})(jQuery);
