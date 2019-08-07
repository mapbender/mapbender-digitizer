(function () {
    "use strict";

    Mapbender.Digitizer = function($element,options) {

        var widget  = this;

        $.extend(widget, options);

        widget.id = $element.attr("id");

        widget.$element = $element;

        var $spinner = (function() {
            var $parent = $('#' + widget.id).parents('.container-accordion').prev().find('.tablecell');
            $parent.prepend("<div class='spinner' style='display:none'></div>");
            $spinner = $parent.find(".spinner");
            return $spinner;
        })();

        widget.spinner = Mapbender.Digitizer.createSpinner_($spinner);

        var qe = new Mapbender.Digitizer.QueryEngine(widget.id,widget.spinner);
        widget.query = qe.query;
        widget.getElementURL = qe.getElementURL;

        widget.disabled = true;



        Mapbender.elementRegistry.waitReady(widget.target).then(widget.setup.bind(widget));

        Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
            widget.printClient = printClient;
            $.extend(widget.printClient, Mapbender.Digitizer.printPlugin);
        });
    };

    Mapbender.Digitizer.createSpinner_ = function ($element) {

        var spinner = new function () {
            var spinner = this;

            spinner.openRequests = 0;

            spinner.$element = $element;

            spinner.addRequest = function () {
                spinner.openRequests++;
                if (spinner.openRequests >= 1) {
                    spinner.$element.trigger("show");
                }
            };

            spinner.removeRequest = function () {
                spinner.openRequests--;
                if (spinner.openRequests === 0) {
                    spinner.$element.trigger("hide");
                }
            };


        };

        return spinner;
    };

    Mapbender.Digitizer.prototype = {


        createSelector_: function() {
            var widget = this;
            var element = $(widget.$element);

            widget.selector = $("select.selector", element);

            widget.selector.getSelectedSchema = function() {
                var selector = this;
                var option = selector.find(":selected");
                return option.data("schemaSettings");
            };

            widget.selector.appendSchema = function(schema,prepend) {
                var selector = this;
                var option = $("<option/>");
                option.val(schema.schemaName).html(schema.label);
                option.data("schemaSettings", schema);
                prepend ? selector.prepend(option) : selector.append(option);
            };

            widget.selector.on('focus', function () {
                var selector = widget.selector;
                selector.previousSchema = selector.getSelectedSchema();

            }).on('change', function () {

                var selector = widget.selector;
                var schema = selector.getSelectedSchema();

                selector.previousSchema.deactivateSchema();
                schema.activateSchema();
                selector.previousSchema = schema;

            });
        },


        setup: function () {
            var widget = this;


            widget.createSelector_();

            widget.map = $('#' + widget.target).data('mapbenderMbMap').map.olMap;


            var initializeSelectorOrTitleElement = function () {

                var element = $(widget.$element);
                var titleElement = $("> div.title", element);


                widget.hasOnlyOneScheme = _.size(widget.schemes) === 1;

                if (widget.hasOnlyOneScheme) {
                    titleElement.html(_.toArray(widget.schemes)[0].label);
                    widget.selector.hide();
                } else {
                    titleElement.hide();
                }
            };


            // TODO this is not the proper implementation - fix that
            var isOpenByDefault = function () {
                var sidePane = $(widget.$element).closest(".sidePane");

                var accordion = $(".accordionContainer", sidePane);
                return accordion.length === 0;
            };

            var createSchemes = function () {


                var rawSchemes = widget.schemes;
                widget.schemes = {};
                var index = 0;
                _.each(rawSchemes, function (rawScheme, schemaName) {
                    rawScheme.schemaName = schemaName;
                    widget.schemes[schemaName] = new Mapbender.Digitizer.Scheme(rawScheme, widget, index++);
                    widget.selector.appendSchema(widget.schemes[schemaName])
                });


                var basicScheme = Object.keys(widget.schemes)[0];


                widget.selector.val(basicScheme);

                widget.initialScheme = widget.schemes[basicScheme];

                if (isOpenByDefault()) {
                    widget.activate(true);
                }


            };


            initializeSelectorOrTitleElement();

            createSchemes();

            widget.contextMenu = new Mapbender.Digitizer.MapContextMenu(widget);

            if (widget.displayOnInactive) {
                widget.activate(false);
            }

        },

        disable: function () {
            var widget = this;
            widget.disabled = true;
        },

        enable: function () {
            var widget = this;
            widget.disabled = false;
        },

        isEnabled: function () {
            var widget = this;
            return !widget.disabled;
        },


        getProjectionCode: function() {
            var widget = this;
            return widget.map.getView().getProjection().getCode().split(':').pop();
        },


        getSchemaByName: function (schemaName) {
            var widget = this;
            var scheme = widget.getBasicSchemes()[schemaName];
            if (!scheme) {
                throw new Error("No Basic Scheme exists with the name " + schemaName);
            }
            return scheme;
        },

        getCurrentSchema: function() {
            var widget = this;
            return widget.initialScheme;
        },




        recalculateLayerVisibility_: function(activateWidget) {
            var widget = this;

            $.each(widget.schemes,function(schemaName,schema){
                if (activateWidget) {
                    if (schema === widget.getCurrentSchema() || schema.displayPermanent) {
                        schema.layer.setVisible(true);
                    }
                } else {
                    if (!widget.displayOnInactive) {
                        schema.layer.setVisible(false);
                    }
                }
            });

        },

        activate: function () {
            var widget = this;
            if (!widget.isEnabled()) {
                widget.enable();
                widget.getCurrentSchema().activateSchema(true);
                widget.recalculateLayerVisibility_(true);
            }
        },

        deactivate: function () {
            var widget = this;
            widget.disable();
            widget.getCurrentSchema().deactivateSchema(true);
            widget.recalculateLayerVisibility_(false);
        },


        // TODO muss repariert werden
        refreshConnectedDigitizerFeatures: function (featureTypeName) {
            var widget = this;
            $(".mb-element-digitizer").not(".mb-element-data-manager").each(function (index, element) {
                var schemes = widget.schemes;
                schemes[featureTypeName] && schemes[featureTypeName].layer && schemes[featureTypeName].layer.getData();
            })


        },
    }


})();
