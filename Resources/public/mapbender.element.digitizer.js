(function ($) {
    "use strict";


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

    /**
     * Translate digitizer keywords
     * @param title
     * @param withoutSuffix
     * @returns {*}
     */


    /**
     * Digitizing tool set
     *
     * @author Andriy Oblivantsev <eslider@gmail.com>
     * @author Stefan Winkelmann <stefan.winkelmann@wheregroup.com>
     *
     * @copyright 20.04.2015 by WhereGroup GmbH & Co. KG
     */
    $.widget("mapbender.mbDigitizer", {
        toolsets: {
            point: [{type: 'drawPoint'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
            line: [{type: 'drawLine'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
            polygon: [{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}],
        },
        /**
         * @type {OpenLayers.Map}
         */
        map: null,
        currentSchema: null,
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
            },
            'copy': {},


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


        _createMapContextMenu: function () {
            var widget = this;
            var map = widget.map;


            var options = {
                selector: 'div',
                events: {
                    show: function (options) {
                        var schema = widget.currentSchema;
                        return schema.useContextMenu;
                    }
                },
                build: function (trigger, e) {
                    var items = {};
                    var schema = widget.currentSchema;
                    var feature = schema.layer.getFeatureFromEvent(e);
                    var features;

                    if (!feature) {
                        items['no-items'] = {name: "Nothing selected!"}
                    } else {

                        if (feature._sketch) {
                            return items;
                        }

                        features = feature.cluster || [feature];

                        _.each(features, function (feature) {
                            items[feature.fid] = schema.createContextMenuSubMenu(feature);
                        });
                    }

                    return {
                        items: items,
                        callback: function (key, options) {
                            var selectedElement = options.$selected;
                            if (!selectedElement) {
                                return
                            }
                            var parameters = options.items[selectedElement.parent().closest('.context-menu-item').data('contextMenuKey')];

                            if (!parameters) {
                                return;
                            }

                            if (parameters.items[key].action) {
                                parameters.items[key].action(key, options, parameters);
                            }
                        }
                    };
                }
            };

            $(map.div).contextMenu(options);

        },

        _createElementContextMenu: function () {
            var widget = this;
            var element = $(widget.element);

            $(element).contextMenu({
                selector: '.mapbender-element-result-table > div > table > tbody > tr',
                events: {
                    show: function (options) {
                        var tr = $(options.$trigger);
                        var resultTable = tr.closest('.mapbender-element-result-table');
                        var api = resultTable.resultTable('getApi');
                        var olFeature = api.row(tr).data();

                        if (!olFeature) {
                            return false;
                        }

                        var schema = widget.findFeatureSchema(olFeature);
                        return schema.useContextMenu;
                    }
                },
                build: function ($trigger, e) {

                    var tr = $($trigger);
                    var resultTable = tr.closest('.mapbender-element-result-table');
                    var api = resultTable.resultTable('getApi');
                    var olFeature = api.row(tr).data();

                    if (!olFeature) {
                        return {
                            callback: function (key, options) {
                            }
                        };
                    }

                    var schema = widget.findFeatureSchema(olFeature);
                    var items = {};

                    items['changeStyle'] = {name: Mapbender.DigitizerTranslator.translate('feature.style.change')};
                    items['zoom'] = {name: Mapbender.DigitizerTranslator.translate('feature.zoomTo')};
                    if (schema.allowDelete) {
                        items['removeFeature'] = {name: Mapbender.DigitizerTranslator.translate('feature.remove.title')};
                    }

                    if (schema.allowEditData) {
                        items['edit'] = {name: Mapbender.DigitizerTranslator.translate('feature.edit')};
                    }

                    return {
                        callback: function (key, options) {
                            switch (key) {
                                case 'removeFeature':
                                    schema.removeFeature(olFeature);
                                    break;

                                case 'zoom':
                                    schema.zoomToJsonFeature(olFeature);
                                    break;

                                case 'edit':
                                    schema._openFeatureEditDialog(olFeature);
                                    break;

                                case 'exportGeoJson':
                                    widget.exportGeoJson(olFeature);
                                    break;

                                case 'changeStyle':
                                    schema.openChangeStyleDialog(olFeature);
                                    break;
                            }
                        },
                        items: items
                    };
                }
            });

        },


        _getNonBlackListedOptions: function () {
            var widget = this;
            var blacklist = ['schemes', 'target', 'create', 'jsSrc', 'disabled'];
            return _.omit(widget.options, blacklist);
        },

        _createSchemes: function () {
            var widget = this;
            var newSchemes = {};
            newSchemes['all'] = new AllScheme({ label: 'all geometries', schemaName: 'all' },widget);
            _.each(widget.options.schemes, function (rawScheme, schemaName) {
                rawScheme.schemaName = schemaName;
                newSchemes[schemaName] = new Scheme(rawScheme, widget);
            });

            widget.options.schemes = newSchemes;
        },


        getGeometryNameByFeatureClass: function (className) {

            switch (className) {
                case 'OpenLayers.Geometry.Polygon' :
                    return 'polygon';
                case 'OpenLayers.Geometry.LineString' :
                    return 'line';
                case 'OpenLayers.Geometry.Point' :
                    return 'point';
            }

            console.warn("feature has no geometry with associated scheme", feature);
            return null;
        },
        // TODO this must be adjusted when adding
        getSchemaByOLFeature: function(feature) {
            var widget = this;
            var geometryName = widget.getGeometryNameByFeatureClass(feature.geometry.CLASS_NAME);
            var schema = null;
            _.each(widget.options.schemes,function(scheme) {
                  if (scheme.featureType.geomType === geometryName) {
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


            var hasOnlyOneScheme = _.size(options.schemes) === 1;

            if (hasOnlyOneScheme) {
                titleElement.html(_.toArray(options.schemes)[0].label);
                selector.hide();
            } else {
                titleElement.hide();
            }
        },

        _setup: function () {

            var widget = this;
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
         * Query intersect by bounding box
         *
         * @param request Request for ajax
         * @param bbox Bounding box or some object, which has toGeometry() method.
         * @param debug Drag
         *
         * @returns ajax XHR object
         *
         * @private
         *
         */
        // _queryIntersect: function (request, bbox, debug) {
        //     var widget = this;
        //     var geometry = bbox.toGeometry();
        //     var _request = $.extend(true, {intersectGeometry: geometry.toString()}, request);
        //
        //     if (debug) {
        //         if (!widget._boundLayer) {
        //             widget._boundLayer = new OpenLayers.Layer.Vector("bboxGeometry");
        //             widget.map.addLayer(widget._boundLayer);
        //         }
        //
        //         var feature = new OpenLayers.Feature.Vector(geometry);
        //         widget._boundLayer.addFeatures([feature], null, {
        //             strokeColor: "#ff3300",
        //             strokeOpacity: 0,
        //             strokeWidth: 0,
        //             fillColor: "#FF9966",
        //             fillOpacity: 0.1
        //         });
        //     }
        //     return widget.query('select', _request).done(function (featureCollection) {
        //         var schema = widget.options.schemes[_request["schema"]];
        //         schema._onFeatureCollectionLoaded(featureCollection, this);
        //     });
        //
        // },


        /**
         * Get target OpenLayers map object
         *
         * @returns  {OpenLayers.Map}
         */
        getMap: function () {
            return this.map;
        },


        /**
         * Open feature edit dialog
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         */
        exportGeoJson: function (feature) {
            var widget = this;
            QueryEngine.query('export', {
                schema: widget.currentSchema.schemaName,
                feature: feature,
                format: 'GeoJSON'
            }).done(function (response) {

            })
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

        /**
         * Find olFeature schema by olFeature data
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @returns {*}
         */
        findFeatureSchema: function (olFeature) {
            var widget = this;
            var options = widget.options;
            return _.find(options.schemes, {layer: olFeature.layer});
        },


        /**
         * Get OL feature by X:Y coordinates.
         *
         * Dirty but works.
         *
         * @param x
         * @param y
         * @returns {Array}
         * @private
         */
        // _getFeaturesFromEvent: function (x, y) {
        //     var features = [], targets = [], layers = [];
        //     var layer, target, feature, i, len;
        //     var map = this.map;
        //
        //     //map.resetLayersZIndex();
        //
        //     // go through all layers looking for targets
        //     for (i = map.layers.length - 1; i >= 0; --i) {
        //         layer = map.layers[i];
        //         if (layer.div.style.display !== "none") {
        //             if (layer === this.activeLayer) {
        //                 target = document.elementFromPoint(x, y);
        //                 while (target && target._featureId) {
        //                     feature = layer.getFeatureById(target._featureId);
        //                     if (feature) {
        //                         features.push(feature);
        //                         target.style.visibility = 'hidden';
        //                         targets.push(target);
        //                         target = document.elementFromPoint(x, y);
        //                     } else {
        //                         target = false;
        //                     }
        //                 }
        //             }
        //             layers.push(layer);
        //             layer.div.style.display = "none";
        //         }
        //     }
        //
        //     // restore feature visibility
        //     for (i = 0, len = targets.length; i < len; ++i) {
        //         targets[i].style.display = "";
        //         targets[i].style.visibility = 'visible';
        //     }
        //
        //     // restore layer visibility
        //     for (i = layers.length - 1; i >= 0; --i) {
        //         layers[i].div.style.display = "block";
        //     }
        //
        //     //map.resetLayersZIndex();
        //     return features;
        // },


        activate: function () {
            var widget = this;
            // QueryEngine.query('getConfiguration').done(function (response) {
            //     // TODO why are formItems reloaded when Scheme is activated?
            //     // _.each(response.schemes, function (schema, schemaName) {
            //     //     widget.options.schemes[schemaName].formItems = response.schemes[schemaName].formItems
            //     // });
            //
            //
            //
            //
            // })
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

        /**
         * Download file by feature and his attribute name
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature OpenLayers
         * @param {String} attributeName
         */
        // download: function (feature, attributeName) {
        //     var widget = this;
        //     /**@type {Scheme} */
        //     var schema = widget.currentSchema;
        //     var attributes = feature.attributes;
        //     var tableName = schema.featureType.table;
        //     var relativeWebPath = Mapbender.configuration.application.urls.asset;
        //     window.open(relativeWebPath + widget.options.fileUri + '/' + tableName + '/' + attributeName + '/' + attributes[attributeName]);
        //
        // }
    });

})(jQuery);
