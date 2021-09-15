(function ($) {
    "use strict";

    Mapbender.Digitizer = Mapbender.Digitizer || {};

    $.fn.dataTable.ext.errMode = 'throw';


    /**
     * Escape HTML chars
     * @returns {string}
     */
    String.prototype.escapeHtml = function () {

        return this.replace(/["&'\/<>]/g, function (a) {
            return {
                '"': '&quot;',
                '&': '&amp;',
                "'": '&#39;',
                '/': '&#47;',
                '<': '&lt;',
                '>': '&gt;'
            }[a];
        });
    };


    $.widget("mapbender.mbDigitizer", {

        options: {
            classes: {},
            create: null,
            debug: false,
            // disabled: false,
            fileURI: "uploads/featureTypes",
            schemes: {},
            target: null,
        },
        schemes: null,
        map: null,

        styles: {
            'default': {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor: "#6fb536",
                fillOpacity: 0.3
                //, label: '${label}'
            },
            'select': {
                strokeWidth: 3,
                fillColor: "#F7F79A",
                strokeColor: '#6fb536',
                fillOpacity: 0.5,
                graphicZIndex: 15
            },
            // 'selected': {
            //     strokeWidth: 3,
            //     fillColor: "#74b1f7",
            //     strokeColor: '#b5ac14',
            //     fillOpacity: 0.7,
            //     graphicZIndex: 15
            // },
            'copy': {
                strokeWidth: 5,
                fillColor: "#f7ef7e",
                strokeColor: '#4250b5',
                fillOpacity: 0.7,
                graphicZIndex: 1000
            },
            'unsaved': {
                strokeWidth: 3,
                fillColor: "#FFD14F",
                strokeColor: '#F5663C',
                fillOpacity: 0.5
            },

            'invisible': {
                display: 'none'
            },

            'labelText': {
                strokeWidth: 0,
                fillColor: '#cccccc',
                fillOpacity: 0,
                strokeColor: '#5e1a2b',
                strokeOpacity: 0,
                pointRadius: 15,
                label: '${label}',
                fontSize: 15
            },
            'labelTextHover': {
                strokeWidth: 0,
                fillColor: '#cccccc',
                strokeColor: '#2340d3',
                fillOpacity: 1,
                pointRadius: 15,
                label: '${label}',
                fontSize: 15
            },

        },

        initialScheme: null,

        printClient: null,

        useAllScheme: false,

        displayOnInactive: false,

        disabled: true,

        isFullyActive: true,

        _create: function () {

            var widget = this.widget = this;
            var element = widget.element;

            widget.id = element.attr("id");

            if (!Mapbender.checkTarget("mbDigitizer", widget.options.target)) {
                return;
            }

            if (typeof widget.options.useAllScheme !== "undefined") {
                widget.useAllScheme = widget.options.useAllScheme;
            }


            widget.displayOnInactive = widget.options.displayOnInactive;

            var dataManagerId = widget.options.dataManager;
            if (dataManagerId) {
                Mapbender.elementRegistry.waitReady(dataManagerId).then(function (dataManager) {
                    widget.dataManager = dataManager;
                });
            }

            var qe = new Mapbender.Digitizer.QueryEngine(widget);
            widget.query = qe.query;
            widget.getElementURL = qe.getElementURL;

            var createSpinner = function () {

                widget.spinner = new function () {
                    var spinner = this;

                    spinner.openRequests = 0;

                    var $parent = $('#' + widget.id).parents('.container-accordion').prev().find('.tablecell').prepend("<div class='spinner' style='display:none'></div>");
                    spinner.$element = $parent.find(".spinner");

                    spinner.addRequest = function () {
                        spinner.openRequests++;
                        if (spinner.openRequests >= 1) {
                            spinner.$element.show();
                        }
                    };

                    spinner.removeRequest = function () {
                        spinner.openRequests--;
                        if (spinner.openRequests === 0) {
                            spinner.$element.hide();
                        }
                    };


                };
            };

            createSpinner();


            Mapbender.elementRegistry.waitReady(widget.options.target).then(widget.setup.bind(widget));

            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
                widget.printClient = printClient;
                $.extend(widget.printClient, Mapbender.Digitizer.printPlugin);
            });
        },


        setup: function () {
            var widget = this;
            var element = $(widget.element);
            var options = widget.options;



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

                if (!selector.previousSchema) {
                  console.warn("No previous schema found");
                } else {
                    selector.previousSchema.deactivateSchema();
                }
                schema.activateSchema();
                selector.previousSchema = schema;

            });

            widget.map = $('#' + options.target).data('mapbenderMbMap').map.olMap;

            var initializeSelectorOrTitleElement = function () {

                var options = widget.options;
                var element = $(widget.element);
                var titleElement = $("> div.title", element);


                widget.hasOnlyOneScheme = _.size(options.schemes) === 1;

                if (widget.hasOnlyOneScheme) {
                    titleElement.html(_.toArray(options.schemes)[0].label);
                    widget.selector.hide();
                } else {
                    titleElement.hide();
                }
            };

            var usesAllScheme = function () {
                return !widget.hasOnlyOneScheme && widget.useAllScheme;
            };

            // TODO this is not the proper implementation - fix that
            var isOpenByDefault = function () {
                var sidePane = $(widget.element).closest(".sidePane");

                var accordion = $(".accordionContainer", sidePane);
                return accordion.length === 0;
            };

            var createSchemes = function () {


                var rawSchemes = widget.options.schemes;
                widget.schemes = {};
                var index = 0;
                _.each(rawSchemes, function (rawScheme, schemaName) {
                    rawScheme.schemaName = schemaName;
                    widget.schemes[schemaName] = new Mapbender.Digitizer.Scheme(rawScheme, widget, index++);
                    if (!widget.schemes[schemaName].disableAggregation) {
                        widget.selector.appendSchema(widget.schemes[schemaName])
                    }
                });


                var basicScheme = Object.keys(widget.schemes)[0];


                if (usesAllScheme()) {
                    widget.schemes['all'] = new Mapbender.Digitizer.AllScheme({
                        label: Mapbender.trans('mb.digitizer.schema.allgeometries'),
                        schemaName: 'all'
                    }, widget, index++);
                    widget.selector.appendSchema(widget.schemes['all'],true);
                    basicScheme = 'all';
                }

                widget.selector.val(basicScheme);

                widget.initialScheme = widget.schemes[basicScheme];

                if (isOpenByDefault() && !widget.isFullyActive) {
                    widget.activate();
                }


            };

            var createMapContextMenu = function () {
                var map = widget.map;


                var options = {
                    selector: 'div',
                    events: {
                        show: function (options) {
                            return widget.isFullyActive && widget.getCurrentSchema().mapContextMenu.allowUseContextMenu(options);
                        }
                    },
                    build: function (trigger, e) {
                        return widget.isFullyActive && widget.getCurrentSchema().mapContextMenu.buildContextMenu(trigger, e);
                    }
                };

                $(map.div).contextMenu(options);

            };

            var createElementContextMenu = function () {
                var element = $(widget.element);

                var options = {
                    position: function (opt, x, y) {
                        opt.$menu.css({top: y, left: x + 10});
                    },
                    selector: '.mapbender-element-result-table > div > table > tbody > tr',
                    events: {
                        show: function (options) {
                            return widget.getCurrentSchema().elementContextMenu.allowUseContextMenu(options);
                        }
                    },
                    build: function (trigger, e) {
                        return widget.getCurrentSchema().elementContextMenu.buildContextMenu(trigger, e);
                    }
                };

                $(element).contextMenu(options);

            };


            initializeSelectorOrTitleElement();

            createSchemes();

            createMapContextMenu();

            createElementContextMenu();

            // widget.map.div.oncontextmenu = function(e) {
            //
            //     if(!e){ //dear IE...
            //         var e = window.event;
            //         e.returnValue = false;
            //     }
            //     var f = widget.getCurrentSchema().layer.getFeatureFromEvent(e);
            //     alert(f);
            //     //f is the pointed vector.feature :)
            //
            //     return false; //Prevent display of browser context menu
            // };

            widget.registerMapEvents();

            widget._trigger('ready');

            if (widget.displayOnInactive) {
                widget.activate();
                widget.isFullyActive = false;
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


        registerMapEvents: function () {
            var widget = this;
            var map = widget.map;

            map.events.register("moveend", this, function () {
                widget.isEnabled() && widget.getCurrentSchema().getData({ triggered_by_map_move: true });
            });

            // Zoomend implies Moveend
            // map.events.register("zoomend", this, function () {
            //     widget.isEnabled() && widget.getCurrentSchema().getData({zoom: true});
            // });

            map.events.register("mouseover", this, function () {
                widget.isEnabled() && widget.getCurrentSchema().mapContextMenu.enable();
            });

            map.events.register("mouseout", this, function () {
                widget.isEnabled() && widget.getCurrentSchema().mapContextMenu.disable();
            });
            map.resetLayersZIndex();
        },

        getBasicSchemes: function () {
            var widget = this;

            return _.pick(widget.schemes, function (schema, key) {
                return key !== "all";
            });
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

        activate: function () {
            var widget = this;
            widget.enable();
            widget.isFullyActive = true;
            widget.getCurrentSchema().activateSchema(true); // triggers schema activation
        },

        deactivate: function () {
            var widget = this;
            widget.disable();
            widget.isFullyActive = false;
            widget.getCurrentSchema().deactivateSchema(true);
        },
        // Sidepane integration api
        hide: function() {
            this.deactivate();
        },
        reveal: function() {
            this.activate();
        },

        getConnectedDataManager: function() {
            var widget = this;
            if (!widget.dataManager) {
                throw new Error("Data Manager is not activated");
            }
            return widget.dataManager;
        },





    });

})(jQuery);
