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
        toolsets: {
            point: [{type: 'drawPoint'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
            line: [{type: 'drawLine'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
            polygon: [{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
            label: [{type: 'drawText'}, {type: 'moveFeature'}]
        },
        /**
         * @type {OpenLayers.Map}
         */
        map: null,
        currentSchema: null,
        // TODO this should not be here but in css file
        featureEditDialogWidth: "423px",

        /**
         * Default styles merged by schema styles if defined
         */
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
            'selected': {
                strokeWidth: 3,
                fillColor: "#74b1f7",
                strokeColor: '#b5ac14',
                fillOpacity: 0.7,
                graphicZIndex: 15
            },
            'copy': {
                strokeWidth: 5,
                fillColor: "#f7ef7e",
                strokeColor: '#4250b5',
                fillOpacity: 0.7,
                graphicZIndex: 15
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
        /**
         * Constructor.
         *
         * At this moment not all elements (like a OpenLayers) are avaible.
         *
         * @private
         */
        _create: function () {

            var widget = this.widget = this;
            var element = widget.element;

            QueryEngine.setId(element.attr("id"));

            if (!Mapbender.checkTarget("mbDigitizer", widget.options.target)) {
                return;
            }

            Mapbender.elementRegistry.onElementReady(widget.options.target, $.proxy(widget._setup, widget));

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


        _getNonBlackListedOptions: function () {
            var widget = this;
            var blacklist = ['schemes', 'target', 'create', 'jsSrc', 'disabled'];
            return _.omit(widget.options, blacklist);
        },

        _createSchemes: function () {
            var widget = this;
            var newSchemes = {};
            newSchemes['all'] = new AllScheme({label: 'all geometries', schemaName: 'all'}, widget);
            _.each(widget.options.schemes, function (rawScheme, schemaName) {
                rawScheme.schemaName = schemaName;
                newSchemes[schemaName] = new Scheme(rawScheme, widget);
            });

            widget.options.schemes = newSchemes;
        },


        getGeometryNameByGeomType: function (geomType) {

            return geomType;
        },

        getSchemaByGeomType: function (geomtype) {
            var widget = this;
            var schema = null;
            _.each(widget.options.schemes, function (scheme) {
                if (scheme.featureType.geomType === geomtype) {
                    schema = scheme;
                }
            });
            if (!schema) {
                console.warn("No Scheme found for feature", feature);
            }
            return schema;
        },

        _createOnSelectorChangeCallback: function () {
            var widget = this;
            var selector = widget.selector;

            return function () {
                var option = selector.find(":selected");
                var newSchema = option.data("schemaSettings");

                widget.currentSchema && widget.currentSchema.deactivateSchema();

                newSchema.activateSchema();
                newSchema._getData();
            }

        },

        _initializeSelector: function () {
            var widget = this;
            var options = widget.options;
            var selector = widget.selector;

            if (options.schema) {
                selector.val(options.schema);
            }

            var onSelectorChange = widget._createOnSelectorChangeCallback();
            selector.on('change', onSelectorChange);
            onSelectorChange();

        },

        _initializeMapEvents: function () {
            var widget = this;
            var map = widget.map;

            map.events.register("moveend", this, function () {
                widget.currentSchema._getData();
            });
            map.events.register("zoomend", this, function (e) {
                widget.currentSchema._getData();
                widget.updateClusterStrategies();
            });
            map.resetLayersZIndex();
        },

        _initializeSelectorOrTitleElement: function () {
            var widget = this;
            var options = widget.options;
            var element = $(widget.element);
            var titleElement = $("> div.title", element);


            // var hasOnlyOneScheme = _.size(options.schemes) === 1;
            //
            // if (hasOnlyOneScheme) {
            //     titleElement.html(_.toArray(options.schemes)[0].label);
            //     widget.selector.hide();
            // } else {
                titleElement.hide();
            //}
        },

        _setup: function () {

            var widget = this;

            Mapbender.Digitizer = this;

            var element = $(widget.element);
            var options = widget.options;

            widget.selector = $("select.selector", element);

            widget.map = $('#' + options.target).data('mapbenderMbMap').map.olMap;

            widget._initializeSelectorOrTitleElement();

            widget._createSchemes();

            widget._createMapContextMenu();

            widget._createElementContextMenu();

            widget._initializeSelector();

            widget._initializeActivationContainer();

            widget._initializeMapEvents();

            widget._trigger('ready');

            widget.updateClusterStrategies();

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




        /**
         * Update cluster strategies
         */
        updateClusterStrategies: function () {

            var widget = this;
            var options = widget.options;
            var scale = Math.round(widget.map.getScale());
            var clusterSettings;
            var closestClusterSettings;

            $.each(options.schemes, function (i, schema) {
                clusterSettings = null;

                if (!schema.clustering) {
                    return;
                }

                $.each(schema.clustering, function (y, _clusterSettings) {
                    if (_clusterSettings.scale == scale) {
                        clusterSettings = _clusterSettings;
                        return false;
                    }

                    if (_clusterSettings.scale < scale) {
                        if (closestClusterSettings && _clusterSettings.scale > closestClusterSettings.scale) {
                            closestClusterSettings = _clusterSettings;
                        } else {
                            if (!closestClusterSettings) {
                                closestClusterSettings = _clusterSettings;
                            }
                        }
                    }
                });

                if (!clusterSettings && closestClusterSettings) {
                    clusterSettings = closestClusterSettings
                }

                if (clusterSettings) {

                    if (clusterSettings.hasOwnProperty('disable') && clusterSettings.disable) {
                        schema.clusterStrategy.distance = -1;
                        var features = schema.layer.features;
                        schema.reloadFeatures([]);
                        schema.clusterStrategy.deactivate();
                        //schema.layer.redraw();
                        schema.isClustered = false;
                        schema.reloadFeatures(features);

                    } else {
                        schema.clusterStrategy.activate();
                        schema.isClustered = true;
                    }
                    if (clusterSettings.hasOwnProperty('distance')) {
                        schema.clusterStrategy.distance = clusterSettings.distance;
                    }

                } else {
                    //schema.clusterStrategy.deactivate();
                }
            });
        },


        activate: function () {
            var widget = this;
            widget.options.__disabled = false;
            widget.currentSchema.activateSchema();

        },

        deactivate: function () {
            var widget = this;
            widget.options.__disabled = true;
            if (!widget.currentSchema.displayOnInactive) {
                widget.currentSchema.deactivateSchema();
            }
        },


        /**
         *
         * @param featureTypeName
         */

        refreshConnectedDigitizerFeatures: function (featureTypeName) {
            var widget = this;
            $(".mb-element-digitizer").not(".mb-element-data-manager").each(function (index, element) {
                var schemes = widget.options.schemes;
                schemes[featureTypeName] && schemes[featureTypeName].layer && schemes[featureTypeName].layer._getData();
            })


        },


    });

})(jQuery);
