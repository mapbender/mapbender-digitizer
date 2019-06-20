(function ($) {
    "use strict";

    Mapbender.Digitizer.Toolset = function(options) {

        var toolSet = this;

        $.extend(toolSet, options);

        var schema = toolSet.schema;


        toolSet.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(toolSet.layer, toolSet.injectedMethods,toolSet.createControlEvents());


        if (schema.allowGeometrylessfeatureBtn) {

            Mapbender.Digitizer.DigitizingControlFactory.prototype.createGeometryLessFeature = function (schemaName) {
                return new OpenLayers.Control ({
                    activate: function() {
                       schema.openFeatureEditDialog(toolSet.createGeometryLessFeature());
                    },
                    layer: schema.layer,
                });
            };
        }

        toolSet.element = $("<div />").addClass('digitizing-tool-set').addClass('left');
        toolSet.createToolbar();

    };

    Mapbender.Digitizer.Toolset.prototype = {

        createGeometryLessFeature: function () {
            var toolSet = this;
            var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(NaN, NaN));
            feature.data = {};
            feature.isNew = true;
            feature.renderIntent = "unsaved";
            var layer = toolSet.schema.layer;
            layer.addFeatures([feature]);
            feature.layer = layer;

            var properties = toolSet.schema.getDefaultProperties();
            feature.attributes = {};
            properties.forEach(function(prop){
                feature.attributes[prop] = "";
            });

            return feature;
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

                controlEvents = _.defaults(toolSet.controlEvents || {},controlEvents);

            return controlEvents;
        },




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

    };

})(jQuery);
