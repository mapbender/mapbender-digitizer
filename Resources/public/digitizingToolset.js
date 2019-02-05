(function ($) {

    $.widget("mapbender.digitizingToolSet", {

        options: {
            layer: null,
            translations: {
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
                triggerModifiedState: function (feature, control, on) {
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
            toolSet.options.injectedMethods.deactivateCurrentControl = function () {
                toolSet.deactivateCurrentControl();
            };
            toolSet.controlFactory = DigitizingControlFactory(toolSet.getLayer(), toolSet.options.injectedMethods,toolSet.options.controlEvents);
            toolSet.element.addClass('digitizing-tool-set');
            toolSet.refresh();

            $(this.element).on('click', '.-fn-tool-button', this.onToolButtonClick.bind(this));

            $(this.element).data("digitizingToolSet", this);

        },

        /**
         * Refresh toolSet
         */
        refresh: function () {
            var toolSet = this;
            var element = $(toolSet.element);

            // clean navigation
            element.empty();

            toolSet.buildNavigation();

            toolSet._trigger('ready', null, this);
        },

        _setOptions: function (options) {
            this._super(options);
            this.refresh();
        },


        _createPlainControlButton: function (item) {
            var toolSet = this;

            var button = $("<button class='button' type='button'/>");

            button.addClass(item.type);
            button.addClass('-fn-tool-button');
            button.data(item);

            button.attr('title', toolSet.options.translations[item.type]);
            // add icon css class
            button.addClass("icon-" + item.type.replace(/([A-Z])+/g, '-$1').toLowerCase());

            return button;
        },

        /**
         * Build Navigation
         *
         */
        buildNavigation: function () {
            var toolSet = this;
            var element = $(toolSet.element);
            var controlFactory = toolSet.controlFactory;
            var buttons = toolSet.options.buttons;

            $.each(buttons, function (i, rawButton) {

                var button = toolSet._createPlainControlButton(rawButton);

                var control = controlFactory[rawButton.type];
                if (!control) {
                    console.warn("control "+rawButton.type+" not found");
                    return;
                }
                button.data('control', control);

                control.layer.map.addControl(control);
                element.append(button);
            });
        },

        /**
         * Activate selected tool
         *
         * @param e
         */


        onToolButtonClick: function (e) {
            var $el = $(e.currentTarget);
            var control = $el.data('control');
            var $mapElement = $(control.map.div) || null;

            if (this.toggleControl(control)) {
                $mapElement.css({cursor: $el.data('control-cursor') || 'crosshair'});
            } else {
                $mapElement.css({cursor: 'default'});
            }
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
                $(control.map.div).css({cursor: 'default'});
                control.deactivate();
            }

            this.activeControl = null;
        },

        /**
         * Get OpenLayer Layer
         *
         * @return OpenLayers.Map.OpenLayers.Class.initialize
         */
        getLayer: function () {
            return this.options.layer;
        }


    });

})(jQuery);
