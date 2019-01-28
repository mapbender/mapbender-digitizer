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
            // Open layer control events
            controlEvents: [],
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
            }
        },
        controlFactory: null,
        activeControl: null,
        currentController: null,

        /**
         * Init controls
         *
         * @private
         */
        _create: function () {
            var widget = this;
            widget.controlFactory = DigitizingControlFactory(widget.getLayer());
            widget.element.addClass('digitizing-tool-set');
            widget.refresh();

            $(this.element).on('click', '.-fn-tool-button', this.onToolButtonClick.bind(this));

        },

        /**
         * Refresh widget
         */
        refresh: function () {
            var widget = this;
            var element = $(widget.element);
            var children = widget.options.children;
            var layer = widget.getLayer();
            var map = layer.map;

            // clean controllers
            //widget.cleanUp();

            // clean navigation
            element.empty();

            widget.buildNavigation(children);

            widget._trigger('ready', null, this);
        },

        _setOptions: function (options) {
            this._super(options);
            this.refresh();
        },


        /**
         * Build Navigation
         *
         * @param buttons
         */
        buildNavigation: function (buttons) {
            var widget = this;
            var element = $(widget.element);
            var controlFactory = widget.controlFactory;
            var controlEvents = widget.options.controlEvents;

            $.each(buttons, function (i, item) {
                //var item = this;
                if (!item || !item.hasOwnProperty('type')) {
                    return;
                }
                var button = $("<button class='button' type='button'/>");
                var type = item.type;

                button.addClass(item.type);
                button.addClass('-fn-tool-button');
                button.data(item);

                if (controlFactory.hasOwnProperty(type)) {
                    var control = controlFactory[type];

                    button.attr('title', widget.options.translations[type]);

                    // add icon css class
                    button.addClass("icon-" + type.replace(/([A-Z])+/g, '-$1').toLowerCase());

                    button.data('control', control);

                    var drawControlEvents = control.events;
                    drawControlEvents.register('activate', button, function (e) {
                        widget._trigger('controlActivate', null, e);
                        button.addClass('active');
                    });
                    drawControlEvents.register('deactivate', button, function (e) {
                        widget._trigger('controlDeactivate', null, e);
                        button.removeClass('active');
                    });

                    // Map event handler to ol controls
                    $.each(controlEvents, function (eventName, eventHandler) {
                        control[eventName] = eventHandler;

                        drawControlEvents.register(eventName, null, eventHandler);
                    });

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
