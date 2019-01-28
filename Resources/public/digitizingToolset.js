/**
 * Digitizing tool set
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 * @author Stefan Winkelmann <stefan.winkelmann@wheregroup.com>
 *
 * @copyright 20.04.2015 by WhereGroup GmbH & Co. KG
 */
(function($) {

    $.widget("mapbender.digitizingToolSet", {

        options:           {
            layer:    null,
            // Open layer control events
            controlEvents: [],
            translations:{
                drawPoint: "Draw point",
                drawLine: "Draw line",
                drawPolygon: "Draw polygon",
                drawRectangle: "Draw rectangle",
                drawCircle: "Draw circle",
                drawEllipse: "Draw ellipse",
                drawDonut: "Draw donut",
                selectAndEditGeometry: "Select and edit geometry position/size",
                moveGeometry: "Move geometry",
                selectGeometry: "Select geometry",
                removeSelected: "Remove selected geometries",
                removeAll: "Remove all geometries"
            }
        },
        controls:          null,
        _activeControls:   [],
        currentController: null,

        /**
         * Init controls
         *
         * @private
         */
        _create: function() {
            var widget = this;
            var mapElement = widget.getMapElement();
            var options = widget.options;
            var translations = options.translations;
            widget.controls = DigitizingControlFactory(translations);
            widget.element.addClass('digitizing-tool-set');
            widget.refresh();

            $(this.element).on('click', '.-fn-tool-button', this.onToolButtonClick.bind(this));

        },

        /**
         * Refresh widget
         */
        refresh: function() {
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

            // Init map controllers
            for (var k in widget._activeControls) {
                map.addControl(widget._activeControls[k]);
            }

            widget._trigger('ready', null, this);
        },

        _setOptions: function(options) {
            this._super(options);
            this.refresh();
        },

        /**
         * Toggle controller and return true if controller turned on
         *
         * @param controller
         * @returns {boolean}
         */
        toggleController: function(controller) {
            var widget = this;
            var setOn = widget.currentController != controller;
            if(setOn) {
                widget.setController(controller);
            } else {
                widget.deactivateCurrentController();
            }
            return setOn;
        },

        /**
         * Switch between current and element controller.
         *
         * @param controller
         */
        setController: function(controller) {
            var widget = this;

            if(controller) {
                controller.activate();
            }

            if(widget.currentController) {
                widget.deactivateCurrentController();
            }

            widget.currentController = controller;
        },

        /**
         * Build Navigation
         *
         * @param buttons
         */
        buildNavigation: function(buttons) {
            var widget = this;
            var element = $(widget.element);
            var controls = widget.controls;
            var controlEvents = widget.options.controlEvents;

            $.each(buttons, function(i, item) {
                //var item = this;
                if(!item || !item.hasOwnProperty('type')){
                    return;
                }
                var button = $("<button class='button' type='button'/>");
                var type = item.type;

                button.addClass(item.type);
                button.addClass('-fn-tool-button');
                button.data(item);

                if(controls.hasOwnProperty(type)) {
                    var controlDefinition = controls[type];

                    if(controlDefinition.hasOwnProperty('infoText')){
                        button.attr('title',controlDefinition.infoText)
                    }

                    // add icon css class
                    button.addClass("icon-" + type.replace(/([A-Z])+/g,'-$1').toLowerCase());

                    if(controlDefinition.hasOwnProperty('cssClass')){
                        button.addClass(controlDefinition.cssClass)
                    }

                    //button.on('click', controlDefinition.onClick);

                    if(controlDefinition.hasOwnProperty('control')) {
                        button.data('control', controlDefinition.control);
                        widget._activeControls.push(controlDefinition.control);

                        var drawControlEvents = controlDefinition.control.events;
                        drawControlEvents.register('activate', button, function(e) {
                            widget._trigger('controlActivate', null, e);
                            button.addClass('active');
                        });
                        drawControlEvents.register('deactivate', button, function(e) {
                            widget._trigger('controlDeactivate', null, e);
                            button.removeClass('active');
                        });

                        // Map event handler to ol controls
                        $.each(controlEvents,function(eventName,eventHandler){
                            controlDefinition.control[eventName] = eventHandler;

                            drawControlEvents.register(eventName, null, eventHandler);
                        });
                    }
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
            var controls = $el.data('control');
            var $mapElement = $(controls.map.div) || null;

            if (this.toggleControls(controls)) {
                $mapElement.css({cursor: $el.data('control-cursor') || 'crosshair'});
            } else {
                $mapElement.css({cursor: 'default'});
            }
        },

        /**
         * Toggle controls and return true if controls turned on
         *
         * @param controls
         * @returns {boolean}
         */
        toggleControls: function(controls) {
            var newState = this.activeControls !== controls;
            this.deactivateCurrentControls();

            if(newState) {
                controls.activate();
                // $.each(controls, function(key,control){
                //     control.activate();
                // });
                this.activeControls = controls;
            }
            return newState;
        },

        /**
         * Deactivate current OpenLayer controls
         */
        deactivateCurrentControls: function() {
            $.each(this.activeControls || [], function(key, control){
                if(control) {
                    if(control instanceof OpenLayers.Control.SelectFeature) {
                        control.unselectAll();
                    }
                    $(control.map.div).css({cursor: 'default'});
                    control.deactivate();
                }
            });

            this.activeControls = [];
        },

        /**
         * Get OpenLayer Layer
         *
         * @return OpenLayers.Map.OpenLayers.Class.initialize
         */
        getLayer: function() {
            return this.options.layer;
        },

        /**
         * Get map jQuery HTML element
         *
         * @return HTMLElement jquery HTML element
         */
        getMapElement: function() {
            var layer = this.getLayer();
            return layer?$(layer.map.div):null;
        },

        /**
         * Has layer?
         * @return {boolean}
         */
        hasLayer: function(){
            return !!this.getLayer();
        },

        /**
         * Deactivate current OpenLayer controller
         */
        deactivateCurrentController: function(){
            var widget = this;
            var mapElement = widget.getMapElement();
            var previousController = widget.currentController;

            if(previousController) {
                if(previousController instanceof OpenLayers.Control.SelectFeature) {
                    previousController.unselectAll();
                }

                previousController.deactivate();
                widget.currentController = null;
            }

            mapElement.css({cursor: 'default'});
        }
    });

})(jQuery);
