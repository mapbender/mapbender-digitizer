(function ($) {
    "use strict";

    Mapbender.Digitizer.Toolset = function (options) {

        var toolSet = this;

        $.extend(toolSet, options);

        toolSet.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(toolSet.schema.widget.map);

        toolSet.element = $("<div />").addClass('digitizing-tool-set').addClass('left');
        toolSet.createToolbar();

    };

    Mapbender.Digitizer.Toolset.prototype = {


        createPlainControlButton_: function (rawButton) {
            var toolSet = this;
            var schema = rawButton.schema;

            var interaction = schema && schema.featureType.interaction || {title: null, className: null};
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

                var $button = toolSet.createPlainControlButton_(rawButton);
                var type = rawButton.type;

                var interaction = controlFactory[type] && controlFactory[type](toolSet.schema.layer.getSource());
                if (!interaction) {
                    console.warn("interaction " + type + " does not exist");
                    return;
                }


                var original_setActive = interaction.setActive;
                interaction.setActive = function (active) {
                    if (active) {
                        $button.addClass('active');
                    } else {
                        $button.removeClass('active');
                    }
                    original_setActive.apply(this, arguments);
                };


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

                element.append($button);
            });
        },

    };

})(jQuery);
