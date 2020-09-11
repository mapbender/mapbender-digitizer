(function ($) {
    "use strict";

    Mapbender.Digitizer.Toolset = function (schema) {

        var toolSet = this;
        toolSet.schema = schema;

        toolSet.buttons = schema.toolset;

        toolSet.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(schema.widget.map);

        toolSet.element = $("<div />").addClass('digitizing-tool-set').addClass('left');
        toolSet.createToolbar();

        schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;

            feature.on('Digitizer.ModifyFeature', function (event) {

                if (schema.deactivateControlAfterModification) {
                    toolSet.activeInteraction && schema.menu.toolSet.activeInteraction.setActive(false);
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

    };

    Mapbender.Digitizer.Toolset.prototype = {


        createPlainControlButton_: function (rawButton,interaction) {
            var toolSet = this;

            var schema = toolSet.schema;
            var geomType = schema.getGeomType();

            var $button = $("<button class='button' type='button'/>");

            $button.addClass(rawButton.type);

            $button.attr('title', Mapbender.DataManager.Translator.translate('toolset.' + geomType + '.' + rawButton.type));
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
            var controlFactory = toolSet.controlFactory;
            var buttons = toolSet.buttons;

            buttons.forEach(function (rawButton) {

                var type = rawButton.type;

                var interaction = controlFactory[type] && controlFactory[type](schema.layer.getSource());
                if (!interaction) {
                    console.warn("interaction " + type + " does not exist");
                    return;
                }

                var $button = toolSet.createPlainControlButton_(rawButton,interaction);

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
