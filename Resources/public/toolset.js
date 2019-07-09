(function ($) {
    "use strict";

    Mapbender.Digitizer.Toolset = function(options) {

        var toolSet = this;

        $.extend(toolSet, options);

        toolSet.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(toolSet.layer, toolSet.injectedMethods);

        toolSet.element = $("<div />").addClass('digitizing-tool-set').addClass('left');
        toolSet.createToolbar();

    };

    Mapbender.Digitizer.Toolset.prototype = {





        _createPlainControlButton: function (rawButton) {
            var toolSet = this;
            var schema = rawButton.schema;

            var control = schema && schema.featureType.control || { title: null, className: null };
            var geomType = toolSet.geomType;

            var $button = $("<button class='button' type='button'/>");

            $button.addClass(rawButton.type);

            $button.attr('title', control.title || Mapbender.DigitizerTranslator.translate('toolset.'+geomType +'.' + rawButton.type));
            // add icon css class
            $button.addClass(control.className || "icon-" + rawButton.type.replace(/([A-Z])+/g, '-$1').toLowerCase());

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

            $.each(buttons, function (i, rawButton) {

                var $button = toolSet._createPlainControlButton(rawButton);
                var type = rawButton.type;


                var control = controlFactory[type] && controlFactory[type](rawButton.schema && rawButton.schema.schemaName);
                if (!control) {
                    console.warn("control "+type+" does not exist");
                    return;
                }
                control.setActive(false);

                schema.widget.map.addInteraction(control);

                control.$button = $button;

                $($button).click(function (e) {

                    if (control.getActive()) {
                       control.setActive(false);
                       control.$button.removeClass('active');

                    } else {
                        toolSet.activeControl && toolSet.activeControl.setActive(false);
                        control.setActive(true);
                        toolSet.activeControl = control;
                        control.$button.addClass('active');

                    }

                });

                element.append($button);
            });
        },

    };

})(jQuery);
