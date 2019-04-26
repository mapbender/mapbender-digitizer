(function ($) {
    "use strict";

    $.widget("mapbender.digitizingToolSet", {

        options: {
            layer: null,
            geomType: null,
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

            console.log(toolSet,"§§§");
            toolSet.$buttons = {};

            toolSet.controlFactory = DigitizingControlFactory(toolSet.options.layer, toolSet.options.injectedMethods,toolSet.createControlEvents());
            toolSet.element.addClass('digitizing-tool-set');
            toolSet.refresh();

            $(this.element).on('click', '.-fn-tool-button', function (e) {

                var $el = $(e.currentTarget);
                var control = $el.data('control');

               if (control.active) {
                 control.deactivate();
               } else {
                   toolSet.deactivateControls();
                   control.activate();
               }

            });



        },

        deactivateControls:  function() {
            var toolSet = this;
            _.each(toolSet.controlFactory,function(control) {
                if (control.active) {
                    control.deactivate();
                }
            });
        },

        createControlEvents: function () {
            var toolSet = this;
            var controlEvents = {

                activate: function(event) {
                    var $button = toolSet.$buttons[this.name];
                    $button.addClass('active');
                },

                deactivate: function(event) {
                    var $button = toolSet.$buttons[this.name];
                    $button.removeClass('active');

                }
            },

            controlEvents = _.defaults(toolSet.options.controlEvents,controlEvents);
            return controlEvents;
        },

        /**
         * Refresh toolSet
         */
        refresh: function () {
            var toolSet = this;
            var element = $(toolSet.element);
            element.empty();
            toolSet.createToolbar();
        },



        _createPlainControlButton: function (item) {
            var toolSet = this;
            var geomType = toolSet.options.geomType;

            var $button = $("<button class='button' type='button'/>");

            $button.addClass(item.type);
            $button.addClass('-fn-tool-button');
            $button.data(item);

            $button.attr('title', Mapbender.DigitizerTranslator.translate('toolset.'+geomType +'.' + item.type));
            // add icon css class
            $button.addClass("icon-" + item.type.replace(/([A-Z])+/g, '-$1').toLowerCase());

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

                var control = controlFactory[type];
                if (!control) {
                    console.warn("control "+type+" not found");
                    return;
                }
                $button.data('control', control);
                toolSet.$buttons[type] = $button;

                control.layer.map.addControl(control);
                element.append($button);
            });
        },




    });

})(jQuery);
