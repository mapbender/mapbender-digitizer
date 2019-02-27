(function ($) {

    $.widget("mapbender.digitizingToolSet", {

        options: {
            layer: null,
            translations: {
                drawText : "Draw text",
                drawPoint: "Draw point",
                drawLine: "Draw line",
                drawPolygon: "Draw polygon",
                drawRectangle: "Draw rectangle",
                drawCircle: "Draw circle",
                drawEllipse: "Draw ellipse",
                drawDonut: "Draw donut",
                modifyFeature: "Select and edit geometry position/size",
                moveFeature: "Move geometry",
                selectFeature: "Select geometry",
                removeSelected: "Remove selected geometries",
                removeAll: "Remove all geometries"
            },
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

        /**
         * Init controls
         *
         * @private
         */
        _create: function () {
            var toolSet = this;
            toolSet.$buttons = {};

            toolSet.options.injectedMethods.deactivateCurrentControl = function () {
                toolSet.deactivateCurrentControl();
            };

            toolSet.controlFactory = DigitizingControlFactory(toolSet.options.layer, toolSet.options.injectedMethods,toolSet.createControlEvents());
            toolSet.element.addClass('digitizing-tool-set');
            toolSet.refresh();

            $(this.element).on('click', '.-fn-tool-button', function (e) {

                var $el = $(e.currentTarget);
                var control = $el.data('control');
                var $mapElement = $(control.map.div) || null;

                if (toolSet.toggleControl(control)) {
                    $mapElement.css({cursor: 'crosshair'});
                } else {
                    $mapElement.css({cursor: 'default'});
                }
            });



        },


        createControlEvents: function () {
            var toolSet = this;
            var controlEvents = {

                activate: function(event) {
                    var $button = toolSet.$buttons[this.name];
                    //toolSet._trigger('controlActivate', null, event); // TODO uncommented because purpose unknown
                    $button.addClass('active');
                },

                deactivate: function(event) {
                    var $button = toolSet.$buttons[this.name];
                    //toolSet._trigger('controlDeactivate', null, event); // TODO uncommented because purpose unknown
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
            //toolSet._trigger('ready', null, this); // TODO uncommented because purpose unknown
        },

        // TODO uncommented because purpose unknown
        // _setOptions: function (options) {
        //
        //     console.log("set Options");
        //     this._super(options);
        //     this.refresh();
        // },


        _createPlainControlButton: function (item) {
            var toolSet = this;

            var $button = $("<button class='button' type='button'/>");

            $button.addClass(item.type);
            $button.addClass('-fn-tool-button');
            $button.data(item);

            $button.attr('title', toolSet.options.translations[item.type] || item.type);
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




        /**
         * Toggle controls and return true if controls turned on
         *
         * @param control
         * @returns {boolean}
         */
        toggleControl: function (control) {
            var newState = this.activeControl !== control;
            this.deactivateCurrentControl();

            if (newState) {
                control.activate();
                this.activeControl = control;
            }
            return newState;
        },

        /**
         * Deactivate current OpenLayer controls
         */
        deactivateCurrentControl: function () {
            var control = this.activeControl;
            if (control) {
                if (control instanceof OpenLayers.Control.SelectFeature) {
                    control.unselectAll();
                }
                control.deactivate();
            }

            this.activeControl = null;
        }



    });

})(jQuery);
