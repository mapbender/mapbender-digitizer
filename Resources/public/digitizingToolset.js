(function ($) {
    "use strict";

    $.widget("mapbender.digitizingToolSet", {

        options: {
            layer: null,
            geomType: null,
            schema: null,
            injectedMethods: {
                openFeatureEditDialog: function (feature) {
                    console.warn("this method shoud be overwritten");
                },
                getDefaultAttributes: function () {
                    console.warn("this method shoud be overwritten");
                    return [];
                },
                preventModification: function () {
                    console.warn("this method shoud be overwritten");
                    return false;
                },
                preventMove: function () {
                    console.warn("this method shoud be overwritten");
                    return false;
                },
                extendFeatureDataWhenNoPopupOpen: function () {
                    console.warn("this method shoud be overwritten");
                    return false;
                },
                setModifiedState: function (feature, control, on) {
                    console.warn("this method shoud be overwritten");
                    return false;
                }
            },
            controlEvents: {},

            defaultAttributes: []
        },
        controlFactory: null,
        activeControl: null,

        _create: function () {

            var toolSet = this;

            toolSet.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(toolSet.options.layer, toolSet.options.injectedMethods,toolSet.createControlEvents());
            toolSet.element.addClass('digitizing-tool-set');
            toolSet.createToolbar();

        },

        createControlEvents: function () {
            var toolSet = this;
            var controlEvents = {

                activate: function(event) {
                    var control = this;
                    control.$button.addClass('active');
                },

                deactivate: function(event) {
                    var control = this;

                    control.$button.removeClass('active');
                    $(control.map.div).css({cursor: 'default'});

                }
            },

            controlEvents = _.defaults(toolSet.options.controlEvents,controlEvents);
            return controlEvents;
        },




        _createPlainControlButton: function (rawButton) {
            var toolSet = this;
            var schema = rawButton.schema;

            var control = schema && schema.featureType.control || { title: null, className: null };
            var geomType = toolSet.options.geomType;

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
            var element = $(toolSet.element);
            var controlFactory = toolSet.controlFactory;
            var buttons = toolSet.options.buttons;

            $.each(buttons, function (i, rawButton) {

                var $button = toolSet._createPlainControlButton(rawButton);
                var type = rawButton.type;

                var control = controlFactory[type](rawButton.schema && rawButton.schema.schemaName);
                if (!control) {
                    console.warn("control "+type+" does not exist");
                    return;
                }

                control.$button = $button;

                $($button).click(function (e) {

                    if (control.active) {
                        control.deactivate();
                    } else {
                        toolSet.activeControl && toolSet.activeControl.deactivate();
                        control.activate();
                        toolSet.activeControl = control;

                    }

                });


                control.layer.map.addControl(control);
                element.append($button);
            });
        },




    });

})(jQuery);
