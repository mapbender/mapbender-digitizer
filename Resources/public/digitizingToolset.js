/**
 * Digitizing tool set
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 * @author Stefan Winkelmann <stefan.winkelmann@wheregroup.com>
 *
 * @copyright 20.04.2015 by WhereGroup GmbH & Co. KG
 */
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
            controlEvents: {
                openFeatureEditDialog: function (feature) { console.warn("this method shoud be overwritten"); },
                getDefaultAttributes: function() { console.warn("this method shoud be overwritten"); return []; },
                preventModification: function () { console.warn("this method shoud be overwritten"); return false;},
                preventMove: function () { console.warn("this method shoud be overwritten"); return false; },
                extendFeatureDataWhenNoPopupOpen: function() { console.warn("this method shoud be overwritten"); return false; }
            },
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
            toolSet.options.controlEvents.deactivateCurrentControl = function() {
                toolSet.deactivateCurrentControl();
            };
            toolSet.controlFactory = DigitizingControlFactory(toolSet.getLayer(),toolSet.options.controlEvents);
            toolSet.element.addClass('digitizing-tool-set');
            toolSet.refresh();

            $(this.element).on('click', '.-fn-tool-button', this.onToolButtonClick.bind(this));

            $(this.element).data("digitizingToolSet",this);

        },

        /**
         * Refresh toolSet
         */
        refresh: function () {
            var toolSet = this;
            var element = $(toolSet.element);
            var children = toolSet.options.children;

            // clean navigation
            element.empty();

            toolSet.buildNavigation(children);

            toolSet._trigger('ready', null, this);
        },

        _setOptions: function (options) {
            this._super(options);
            this.refresh();
        },


        _createPlainControlButton: function(item) {
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

        _registerControlEvents: function(control,button) {
            var toolSet = this;

            var drawControlEvents = control.events;
            drawControlEvents.register('activate', button, function (e) {
                toolSet._trigger('controlActivate', null, e);
                button.addClass('active');
            });
            drawControlEvents.register('deactivate', button, function (e) {
                toolSet._trigger('controlDeactivate', null, e);
                button.removeClass('active');
            });

            //var controlEvents = toolSet.options.controlEvents;
            //Map event handler to ol controls
            // $.each(controlEvents, function (eventName, eventHandler) {
            //     control[eventName] = eventHandler;
            //     // featureadded is event, onStart and onComplete are Methods
            //     drawControlEvents.register(eventName, null, eventHandler);
            //     console.log(eventName+" registered for ",control);
            // });

        },
        /**
         * Build Navigation
         *
         * @param buttons
         */
        buildNavigation: function (buttons) {
            var toolSet = this;
            var element = $(toolSet.element);
            var controlFactory = toolSet.controlFactory;

            $.each(buttons, function (i, item) {
                //var item = this;
                if (!item || !item.hasOwnProperty('type')) {
                    return;
                }
                var button = toolSet._createPlainControlButton(item);

                if (controlFactory.hasOwnProperty(item.type)) {
                    var control = controlFactory[item.type];
                    button.data('control', control);
                    toolSet._registerControlEvents(control,button);
                    control.layer.map.addControl(control);
                }

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
