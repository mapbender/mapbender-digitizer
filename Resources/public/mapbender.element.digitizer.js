(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';


    /**
     * Escape HTML chars
     * @returns {string}
     */
    String.prototype.escapeHtml = function () {

        return this.replace(/[\"&'\/<>]/g, function (a) {
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

        options:  {
            classes: {},
            create: null,
            debug: false,
            disabled: false,
            fileURI: "uploads/featureTypes",
            schemes: {},
            target: null,
        },
        schemes: {},
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
                strokeWidth: 1,
                fillColor: "#F7F79A",
                strokeColor: '#6fb536',
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
            }

        },
        printClient: null,

        _create: function () {

            var widget = this.widget = this;
            var element = widget.element;

            QueryEngine.setId(element.attr("id"));

            if (!Mapbender.checkTarget("mbDigitizer", widget.options.target)) {
                return;
            }

            Mapbender.elementRegistry.onElementReady(widget.options.target, $.proxy(widget._setup, widget));
            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function(printClient){
                widget.printClient = printClient;
                $.extend(widget.printClient ,Mapbender.DigitzerPlugins.print);
            }.bind(this));


            widget.dataManager = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];


        },

        buildMapContextMenu: function () {
            console.warn("This method should be overwritten");
        },

        allowUseMapContextMenu: function () {
            console.warn("This method should be overwritten");
        },

        _createMapContextMenu: function () {
            var widget = this;
            var map = widget.map;


            var options = {
                selector: 'div',
                events: {
                    show: function (options) {
                        return widget.allowUseMapContextMenu(options);
                    }
                },
                build: function (trigger, e) {
                    return widget.buildMapContextMenu(trigger, e);
                }
            };

            $(map.div).contextMenu(options);

        },

        buildElementContextMenu: function (trigger, e) {
            console.warn("This method should be overwritten");

        },

        allowUseElementContextMenu: function (options) {
            console.warn("This method should be overwritten");
        },

        _createElementContextMenu: function () {
            var widget = this;
            var element = $(widget.element);

            var options = {
                position: function (opt, x, y) {
                    opt.$menu.css({top: y, left: x + 10});
                },
                selector: '.mapbender-element-result-table > div > table > tbody > tr',
                events: {
                    show: function (options) {
                        return widget.allowUseElementContextMenu(options);
                    }
                },
                build: function (trigger, e) {
                    return widget.buildElementContextMenu(trigger, e);
                }
            };

            $(element).contextMenu(options);

        },


        _createSchemes: function () {
            var widget = this;
            var rawSchemes = widget.options.schemes;
            _.each(rawSchemes, function (rawScheme, schemaName) {
                rawScheme.schemaName = schemaName;
                widget.schemes[schemaName] = new Scheme(rawScheme, widget);
            });

            if (!widget.hasOnlyOneScheme) {
                widget.schemes['all'] = new AllScheme({label: 'all geometries', schemaName: 'all'}, widget);
            }
        },


        getDefaultToolsetByGeomType: function(geomType) {

            switch(geomType) {
                case 'point':
                    return [{type: 'drawPoint'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}];
                case 'line':
                    return [{type: 'drawLine'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}];
                case 'polygon':
                    return [{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}];
                case 'label' :
                    return [{type: 'drawText'}, {type: 'moveFeature'}];

            }

            console.warn("No valid geom type",geomType)

        },



        getSchemaByGeomType: function (geomtype) {
            var widget = this;
            var schema = null;
            _.each(widget.schemes, function (scheme) {
                if (scheme.featureType.geomType === geomtype) {
                    schema = scheme;
                }
            });
            if (!schema) {
                console.warn("No Scheme found for geomtype", geomtype);
            }
            return schema;
        },


        deactivateSchema: function() {},


        _initializeSelector: function () {
            var widget = this;
            var selector = widget.selector;


            widget.onSelectorChange = function () {
                var option = selector.find(":selected");
                var newSchema = option.data("schemaSettings");

                widget.deactivateSchema();

                newSchema.activateSchema();
            };

            selector.on('change', widget.onSelectorChange);

        },


        getData: function(zoom) {},


        _initializeMapEvents: function () {
            var widget = this;
            var map = widget.map;

            map.events.register("moveend", this, function () {
                widget.getData();
            });
            map.events.register("zoomend", this, function () {
                widget.getData(true);
            });
            map.resetLayersZIndex();
        },

        _initializeSelectorOrTitleElement: function () {
            var widget = this;
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
        },

        _setup: function () {

            var widget = this;

            Mapbender.Digitizer = this;

            var element = $(widget.element);
            var options = widget.options;

            widget.selector = $("select.selector", element);

            widget.map = $('#' + options.target).data('mapbenderMbMap').map.olMap;

            widget._initializeActivationContainer();

            widget._initializeSelectorOrTitleElement();

            widget._createSchemes();

            widget._createMapContextMenu();

            widget._createElementContextMenu();

            widget._initializeSelector();

            widget._initializeMapEvents();

            widget._trigger('ready');

        },


        // TODO Kanonen->Spatzen: refactoring
        _initializeActivationContainer: function () {
            var widget = this;

            var containerInfo = new MapbenderContainerInfo(widget, {
                onactive: function () {
                    widget.activate();
                },
                oninactive: function () {
                    widget.deactivate();
                }
            });

            return containerInfo;

        },

        activate: function () {
            var widget = this;
            widget.options.__disabled = false;
            widget.onSelectorChange();
        },

        deactivate: function () {
            var widget = this;
            widget.options.__disabled = true;
            widget.deactivateSchema();
        },


        // TODO muss getetest werden
        refreshConnectedDigitizerFeatures: function (featureTypeName) {
            var widget = this;
            $(".mb-element-digitizer").not(".mb-element-data-manager").each(function (index, element) {
                var schemes = widget.schemes;
                schemes[featureTypeName] && schemes[featureTypeName].layer && schemes[featureTypeName].layer.getData();
            })


        },


    });

})(jQuery);
