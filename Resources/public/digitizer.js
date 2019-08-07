(function () {
    "use strict";

    Mapbender.Digitizer = function($element,options) {

        var widget  = this;

        $.extend(widget, options);

        widget.id = $element.attr("id");

        widget.$element = $element;

        var $spinner = (function() {
            var $parent = $('#' + widget.id).parents('.container-accordion').prev().find('.tablecell');
            var spinner = $("<div class='spinner' style='display:none'></div>");
            $parent.prepend(spinner);
            return spinner;
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

    Mapbender.Digitizer.createSpinner_ = function ($spinner) {

        var spinner = new function () {
            var spinner = this;

            spinner.openRequests = 0;

            spinner.$element = $spinner;

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

    Mapbender.Digitizer.createSelector_= function($element, schemes) {

        var selector = new function() {
            var selector = this;

            selector.getSelectedSchema = function() {
                var $option = $element.find(":selected") || $element.find("option").first();
                return schemes[$option.val()]
            };

            $.each(schemes,function(schemaName,schema) {
                var option = $("<option/>").val(schemaName).html(schemaName);
                $element.append(option);
            });

            $element.on('focus', function () {
                selector.previousSchema = selector.getSelectedSchema();
            }).on('change', function () {
                var schema = selector.getSelectedSchema();
                selector.previousSchema.deactivateSchema();
                schema.activateSchema();
                selector.previousSchema = schema;

            });

        };

        return selector;

    };

    Mapbender.Digitizer.prototype = {

        setup: function () {
            var widget = this;

            widget.map = $('#' + widget.target).data('mapbenderMbMap').map.olMap;

            var $title = (function($element){
                var title = $('<div class="title"></div>');
                $element.append(title);

            })(widget.$element);

            var $selector = (function($element){
                var selector =  $('<select class="selector"></select>');
                $element.append(selector);
                return selector;
            })(widget.$element);

            var rawSchemes = widget.schemes;
            widget.schemes = {};
            $.each(rawSchemes, function (schemaName,rawScheme) {
                rawScheme.schemaName = schemaName;
                widget.schemes[schemaName] = new Mapbender.Digitizer.Scheme(rawScheme, widget);
            });
            Object.freeze(widget.schemes);



            widget.selector = Mapbender.Digitizer.createSelector_($selector,widget.schemes);

            if (Object.keys(widget.schemes).length === 1) {
               $selector.hide();
               $title.html(Object.keys(widget.schemes)[0]);
            } else { }

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
            var scheme = widget.schemes[schemaName];
            if (!scheme) {
                throw new Error("No Basic Scheme exists with the name " + schemaName);
            }
            return scheme;
        },

        getCurrentSchema: function() {
            var widget = this;
            return widget.selector.getSelectedSchema();
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


        // // TODO muss repariert werden
        // refreshConnectedDigitizerFeatures: function (featureTypeName) {
        //     var widget = this;
        //     $(".mb-element-digitizer").not(".mb-element-data-manager").each(function (index, element) {
        //         var schemes = widget.schemes;
        //         schemes[featureTypeName] && schemes[featureTypeName].layer && schemes[featureTypeName].layer.getData();
        //     })
        //
        //
        // },
    }


})();
