(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';

    /**
     * Regular Expression to get checked if string should be translated
     *
     * @type {RegExp}
     */
    var translationReg = /^trans:\w+\.(\w|-|\.{1}\w+)+\w+$/;


    /**
     * Escape HTML chars
     * @returns {string}
     */
    String.prototype.escapeHtml = function() {

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

    OpenLayers.Layer.prototype.findFeatureByPropertyValue = function(propName, propValue) {
        var layer = this;
        for (var i = 0; i < layer.features.length; i++) {
            if (layer.features[i][propName] === propValue) {
                return layer.features[i];
            }
        }
        return null;
    };

    /**
     * Translate digitizer keywords
     * @param title
     * @param withoutSuffix
     * @returns {*}
     */
     Mapbender.digitizer_translate = function(title, withoutSuffix) {
        return Mapbender.trans(withoutSuffix ? title : "mb.digitizer." + title);
    };



    /**
     * Translate object
     *
     * @param items
     * @returns object
     */
    function translateObject(items) {
        for (var k in items) {
            var item = items[k];
            if (typeof item === "string" && item.match(translationReg)) {
                items[k] = Mapbender.digitizer_translate(item.split(':')[1], true);
            } else if (typeof item === "object") {
                translateObject(item);
            }
        }
        return item;
    }

    function getValueOrDefault(o, s, d) {
        s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        for (var i = 0, n = a.length; i < n; i++) {
            var k = a[i];
            if (k in o) {
                o = o[k];
            } else {
                return d;
            }
        }
        return o;
    }

    Mapbender.layerManager = new function () {
        var layerManager = this;
        /**
         * @define {OpenLayers.Map}
         */
        var olMap;

        /**
         * Set map object to handle with
         *
         * @param {OpenLayers.Map} map
         */
        layerManager.setMap = function (map) {
            olMap = map;
            return layerManager;
        };

        /**
         * Refresh layer. Only if visible.
         *
         * @see http://osgeo-org.1560.x6.nabble.com/layer-WMS-don-t-redraw-td5086852.html
         * @see http://dev.openlayers.org/apidocs/files/OpenLayers/Layer-js.html#OpenLayers.Layer.redraw
         * @see https://gis.stackexchange.com/questions/36741/how-to-update-a-vector-layer-with-wfs-protocol-after-updating-the-filter
         * @param {OpenLayers.Layer} layer
         * @return {OpenLayers.Layer}
         */
        layerManager.refreshLayer = function (layer) {
            if (!layer.getVisibility()) {
                return layer;
            }

            layer.setVisibility(false);
            layer.setVisibility(true);

            if (layer.redraw) {
                layer.redraw(true);
            }

            if (layer.refresh) {
                layer.refresh({force: true});
            }
            return layer;
        };

        /**
         * Get layers by layer instance ID
         *
         * @param {number|string} _layerInstanceId
         * @return {Array<OpenLayers.Layer>}
         */
        layerManager.getLayersByInstanceId = function (_layerInstanceId) {
            var layers = [];
            _.each(Mapbender.configuration.layersets, function (layerSet) {
                _.each(layerSet, function (layerCollection) {
                    _.each(layerCollection, function (layerInstanceInfo) {
                        var layerInstanceId = layerInstanceInfo.origId;
                        var layerId = layerInstanceInfo.ollid;
                        if (layerInstanceId == _layerInstanceId) {
                            var items = _.where(olMap.layers, {id: layerId});
                            layers = layers.concat(items);
                        }
                    });
                })
            });
            return layers;
        }
    };





    /**
     * Check and replace values recursive if they should be translated.
     * For checking used "translationReg" variable
     *
     *
     * @param items
     */
    function translateStructure(items) {
        var isArray = items instanceof Array;
        for (var k in items) {
            if (isArray || k == "children") {
                translateStructure(items[k]);
            } else {
                if (typeof items[k] == "string" && items[k].match(translationReg)) {
                    items[k] = Mapbender.digitizer_translate(items[k].split(':')[1], true);
                }
            }
        }
    }



    /**
     * Example:
     *     Mapbender.confirmDialog({html: "Feature löschen?", title: "Bitte bestätigen!", onSuccess:function(){
                  return false;
           }});
     * @param options
     * @returns {*}
     */
    Mapbender.confirmDialog = function (options) {
        var dialog = $("<div class='confirm-dialog'>" + (options.hasOwnProperty('html') ? options.html : "") + "</div>").popupDialog({
            title: options.hasOwnProperty('title') ? options.title : "",
            maximizable: false,
            dblclick: false,
            minimizable: false,
            resizable: false,
            collapsable: false,
            modal: true,
            buttons: options.buttons || [{
                text: options.okText || "OK",
                click: function (e) {
                    if (!options.hasOwnProperty('onSuccess') || options.onSuccess(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }, {
                text: options.cancelText || "Abbrechen",
                'class': 'critical',
                click: function (e) {
                    if (!options.hasOwnProperty('onCancel') || options.onCancel(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }]
        });
        return dialog;
    };

    /**
     * Digitizing tool set
     *
     * @author Andriy Oblivantsev <eslider@gmail.com>
     * @author Stefan Winkelmann <stefan.winkelmann@wheregroup.com>
     *
     * @copyright 20.04.2015 by WhereGroup GmbH & Co. KG
     */
    $.widget("mapbender.mbDigitizer", {
        options: {
            // Default option values
            allowDigitize: true,
            allowDelete: true,
            allowSave: true,
            allowEditData: true,
            allowCustomerStyle: false,
            allowChangeVisibility: false,
            allowDeleteByCancelNewGeometry: false,
            allowCancelButton: true,
            allowLocate: false,
            showVisibilityNavigation: false,
            allowPrintMetadata: false,

            // Copy data
            copy: {
                enable: false,
                rules: [],
                data: {},
                style: {
                    strokeWidth: 5,
                    fillColor: "#f7ef7e",
                    strokeColor: '#4250b5',
                    fillOpacity: 0.7,
                    graphicZIndex: 15
                }
            },

            // Save data
            save: {}, // pop a confirmation dialog when deactivating, to ask the user to save or discard
            // current in-memory changes
            confirmSaveOnDeactivate: true,
            openFormAfterEdit: true,
            maxResults: 5001,
            pageLength: 10,
            oneInstanceEdit: true,
            searchType: "currentExtent",
            inlineSearch: false,
            useContextMenu: false,

            // Layer list names/ids to be refreshed after feature save complete
            refreshLayersAfterFeatureSave: [],

            clustering: [{
                scale: 5000000,
                distance: 30
            }]
        }, // Default tool-sets
        toolsets: {
            point: [

                {type: 'drawPoint'}, //{type: 'modifyFeature'},
                {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}
                //{type: 'removeAll'}
            ],
            line: [{type: 'drawLine'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}
                //{type: 'removeAll'}
            ],
            polygon: [{type: 'drawPolygon'}, {type: 'drawRectangle'}, {type: 'drawCircle'}, {type: 'drawEllipse'}, {type: 'drawDonut'}, {type: 'modifyFeature'}, {type: 'moveFeature'}, {type: 'selectFeature'}, {type: 'removeSelected'}

                //{type: 'removeAll'}
            ]
        },
        map: null,
        currentSettings: null,
        featureEditDialogWidth: "423px",
        unsavedFeatures: {},
        layers: [],
        printClient : null,

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

            if (!Mapbender.checkTarget("mbDigitizer", widget.options.target)) {
                return;
            }

            widget.elementUrl = Mapbender.configuration.application.urls.element + '/' + element.attr('id') + '/';
            Mapbender.elementRegistry.onElementReady(widget.options.target, $.proxy(widget._setup, widget));
            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function(printClient){
                this.printClient = printClient;
                $.extend(this.printClient ,Mapbender.DigitzerPlugins.print);
            }.bind(this));


            /**
             * Reload schema layers after feature was modified or removed
             */
            element.bind('mbdigitizerfeaturesaved mbdigitizerfeatureremove', function (event, feature) {
                var schema = feature.schema;
                var refreshLayerNames = schema.refreshLayersAfterFeatureSave;

                if (_.size(refreshLayerNames)) {
                    Mapbender.layerManager.setMap(schema.layer.map);
                    _.each(refreshLayerNames, function (layerInstanceId) {
                        var layers = Mapbender.layerManager.getLayersByInstanceId(layerInstanceId);
                        _.each(layers, function (layer) {
                            Mapbender.layerManager.refreshLayer(layer);
                        });
                    });
                }
            });
        },

        /**
         * Open change style dialog
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @returns {*}
         */
        openChangeStyleDialog: function (olFeature) {
            var widget = this;
            var layer = olFeature.layer;
            var styleMap = layer.options.styleMap;
            var styles = styleMap.styles;
            var defaultStyleData = olFeature.style || _.extend({}, styles["default"].defaultStyle);

            if (olFeature.styleId) {
                _.extend(defaultStyleData, styles[olFeature.styleId].defaultStyle);
            }
            var styleOptions = {
                data: defaultStyleData,
                commonTab: false
            };

            if (olFeature.geometry.CLASS_NAME === "OpenLayers.Geometry.LineString") {
                styleOptions.fillTab = false;
            }

            var styleEditor = $("<div/>")
                .featureStyleEditor(styleOptions)
                .bind('featurestyleeditorsubmit', function (e, context) {
                    var styleData = styleEditor.formData();
                    var schemaName = widget.currentSettings.schemaName;
                    styleEditor.disableForm();
                    widget._applyStyle(styleData, olFeature);
                    if (olFeature.fid) {
                        widget._saveStyle(schemaName, styleData, olFeature)
                            .done(function (response) {
                                widget._applyStyle(response.style, olFeature);
                                styleEditor.enableForm();
                            });
                    } else {
                        // defer style saving until the feature itself is saved, and has an id to associate with
                        var styleDataCopy = $.extend({}, styleData);
                        olFeature.saveStyleDataCallback = $.proxy(widget._saveStyle, widget, schemaName, styleDataCopy);
                    }
                    widget._applyStyle(styleData, olFeature);
                    styleEditor.featureStyleEditor("close");
                });
            return styleEditor;
        },

        /**
         *
         * @param styleData
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @private
         */
        _applyStyle: function (styleData, olFeature) {
            var style = new OpenLayers.Style(styleData);
            var styleMap = olFeature.layer.options.styleMap;
            var styleId = styleData.id || Mapbender.Util.UUID();
            var oldStyleId = olFeature.styleId || null;
            styleMap.styles[styleId] = style;
            olFeature.styleId = styleId;
            olFeature.layer.drawFeature(olFeature, styleId);
            if (oldStyleId && oldStyleId != styleId) {
                delete styleMap.styles[oldStyleId];
            }
        },
        /**
         *
         * @param schemaName
         * @param styleData
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @returns {*|xhr}
         * @private
         */

        _saveStyle: function (schemaName, styleData, olFeature) {
            return this.query('style/save', {
                style: styleData,
                featureId: olFeature.fid,
                schema: schemaName
            });
        },




        _createElementContextMenu: function() {
            var widget = this;
            var element = $(widget.element);

            $(element).contextMenu({
                selector: '.mapbender-element-result-table > div > table > tbody > tr',
                position: function (opt, x, y) {
                    opt.$menu.css({top: y + 5, left: x + 5});
                },
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

                    //items['changeStyle'] = {name: Mapbender.digitizer_translate('feature.style.change')};
                    items['zoom'] = {name: Mapbender.digitizer_translate('feature.zoomTo')};
                    if (schema.allowDelete) {
                        items['removeFeature'] = {name: Mapbender.digitizer_translate('feature.remove.title')};
                    }

                    if (schema.allowEditData) {
                        items['edit'] = {name: Mapbender.digitizer_translate('feature.edit')};
                    }

                    return {
                        callback: function (key, options) {
                            switch (key) {
                                case 'removeFeature':
                                    widget.removeFeature(olFeature);
                                    break;

                                case 'zoom':
                                    widget.zoomToJsonFeature(olFeature);
                                    break;

                                case 'edit':
                                    widget._openFeatureEditDialog(olFeature);
                                    break;

                                case 'exportGeoJson':
                                    widget.exportGeoJson(olFeature);
                                    break;

                                // case 'changeStyle':
                                //     widget.openChangeStyleDialog(olFeature);
                                //     break;
                            }
                        },
                        items: items
                    };
                }
            });

        },


        _removeContextMenuMap: function() {
            var widget = this;
            var map = widget.map;

            $(map.div).contextMenu("destroy");
        },

        _setContextMenuMap: function() {
            var widget = this;
            var map = widget.map;

            function createSubMenu(olFeature) {
                var layer = olFeature.layer;
                var schema = widget.findSchemaByLayer(layer);
                var subItems = {
                    zoomTo: {
                        name: Mapbender.digitizer_translate('feature.zoomTo'),
                        action: function (key, options, parameters) {
                            widget.zoomToJsonFeature(parameters.olFeature);
                        }
                    }
                };

                if (schema.allowChangeVisibility) {
                    subItems['style'] = {
                        name: Mapbender.digitizer_translate('feature.visibility.change'),
                        action: function (key, options, parameters) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    };
                }

                if (schema.allowCustomerStyle) {
                    subItems['style'] = {
                        name: Mapbender.digitizer_translate('feature.style.change'),
                        action: function (key, options, parameters) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    };
                }

                if (schema.allowEditData) {
                    subItems['edit'] = {
                        name: Mapbender.digitizer_translate('feature.edit'),
                        action: function (key, options, parameters) {
                            widget._openFeatureEditDialog(parameters.olFeature);
                        }
                    }
                }

                if (schema.allowDelete) {
                    subItems['remove'] = {
                        name: Mapbender.digitizer_translate('feature.remove.title'),
                        action: function (key, options, parameters) {
                            widget.removeFeature(parameters.olFeature);
                        }
                    }
                }

                return {
                    name: "Feature #" + olFeature.fid,
                    olFeature: olFeature,
                    items: subItems
                };
            }


            $(map.div).contextMenu({
                selector: 'div',
                events: {
                    show: function (options) {
                        var schema = widget.currentSettings;
                        return schema.useContextMenu;
                    }
                },
                build: function (trigger, e) {
                    var items = {};
                    var schema = widget.currentSettings;
                    var feature = schema.layer.getFeatureFromEvent(e);
                    var features;

                    if (!feature) {
                        items['no-items'] = {name: "Nothing selected!"}
                    } else {

                        if (feature._sketch) {
                            return items;
                        }

                        features = feature.cluster ? feature.cluster : [feature];

                        _.each(features, function (feature) {
                            if (!feature.layer) {
                                feature.layer = olFeature.layer;
                            }
                            items[feature.fid] = createSubMenu(feature);
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
            });

        },

        _createTableTranslations: function() {
            var widget = this;
            var options = widget.options;

            if (options.tableTranslation) {
                translateObject(options.tableTranslation);
            } else {
                options.tableTranslation = {
                    sSearch: Mapbender.digitizer_translate("search.title") + ':',
                    sEmptyTable: Mapbender.digitizer_translate("search.table.empty"),
                    sZeroRecords: Mapbender.digitizer_translate("search.table.zerorecords"),
                    sInfo: Mapbender.digitizer_translate("search.table.info.status"),
                    sInfoEmpty: Mapbender.digitizer_translate("search.table.info.empty"),
                    sInfoFiltered: Mapbender.digitizer_translate("search.table.info.filtered")
                };
                //translateObject(options.tableTranslation);
            }
        },

        _buildSelectOptionsForAllSchemes: function() {
            var widget = this;
            var map = widget.map;

            var options = widget.options;
            $.each(options.schemes, function (schemaName) {
               var schema = this;
               var layer = schema.layer = widget.createSchemaFeatureLayer(schema);
               map.addLayer(layer);

               schema.schemaName = schemaName;
               schema._buildSelectOptions();
            })

        },

        _setup: function () {

            var widget = this;
            var element = $(widget.element);
            var titleElement = $("> div.title", element);
            var selector = widget.selector = $("select.selector", element);
            var options = widget.options;
            var map = widget.map = $('#' + options.target).data('mapbenderMbMap').map.olMap;
            var hasOnlyOneScheme = _.size(options.schemes) === 1;
            var currentSchemaName = getValueOrDefault(options, "schema");

            if (hasOnlyOneScheme) {
                titleElement.html(_.toArray(options.schemes)[0].label);
                selector.css('display', 'none');
            } else {
                titleElement.css('display', 'none');
            }

            var newSchemes = {};
            _.each(widget.options.schemes, function(el,index){
                el.widget = widget;
                newSchemes[index] = new Scheme(el);

                widget.activeLayer = widget.activeLayer || newSchemes[index].layer;
                widget.schemaName = widget.schemaName || newSchemes[index].schemaName;
                widget.currentSettings = widget.currentSettings || newSchemes[index];
            });

           var GeometrylessfeatureAddBtn = new Mapbender.DigitzerPlugins.GeometrylessfeatureAddBtn(this);
           GeometrylessfeatureAddBtn.toggleSchemeVisibilty();

           widget.options.schemes = newSchemes;



            widget._createElementContextMenu();

            widget._createTableTranslations();

            widget._buildSelectOptionsForAllSchemes();



            function onSelectorChange() {
                var option = selector.find(":selected");
                var schema = option.data("schemaSettings");
                var table = schema.table;
                var tableApi = table.resultTable('getApi');

                widget._trigger("beforeChangeDigitizing", null, {
                    next: schema,
                    previous: widget.currentSettings
                });

                if (widget.currentSettings) {
                    widget.currentSettings.deactivateSchema();
                }


                var initResultTableAndData = function() {

                    table.off('mouseenter', 'mouseleave', 'click');

                    table.delegate("tbody > tr", 'mouseenter', function () {
                        var tr = this;
                        var row = tableApi.row(tr);
                        widget._highlightFeature(row.data(), true);
                    });

                    table.delegate("tbody > tr", 'mouseleave', function () {
                        var tr = this;
                        var row = tableApi.row(tr);
                        widget._highlightFeature(row.data(), false);
                    });

                    table.delegate("tbody > tr", 'click', function () {
                        var tr = this;
                        var row = tableApi.row(tr);
                        var feature = row.data();
                        var isOpenLayerCloudPopup = schema.popup && schema.popup.type && schema.popup.type === 'openlayers-cloud';

                        feature.selected = $('.selection input', tr).is(':checked');

                        widget._highlightFeature(feature);

                        if (isOpenLayerCloudPopup) {
                            widget._openFeatureEditDialog(feature);
                        } else {
                            widget.zoomToJsonFeature(feature);
                        }
                    });
                    widget._trigger('schemaChanged');
                    widget._getData();
                }

                if (widget.currentSettings.schemaName != schema.schemaName || schema.displayOnInactive || schema.displayPermanent) {

                    widget.query('getConfiguration').done(function (response) {
                        _.each(response.schemes, function(schema,schemaName){
                            widget.options.schemes[schemaName].formItems = response.schemes[schemaName].formItems
                        });

                        widget.options.__disabled = false;
                        schema.activateSchema();
                        widget._setContextMenuMap();
                        initResultTableAndData();

                    });
                } else {
                    initResultTableAndData();
                }


            }

            if (currentSchemaName !== undefined) {
                selector.val(currentSchemaName);
            }

            selector.on('change', onSelectorChange);

            map.events.register("moveend", this, function () {
                widget._getData();
            });
            map.events.register("zoomend", this, function (e) {
                widget._getData();
                widget.updateClusterStrategies();
            });
            map.resetLayersZIndex();
            widget._trigger('ready');

            element.bind("mbdigitizerbeforechangedigitizing", function (e, sets) {
                var previousSettings = sets.previous;
                if (previousSettings) {
                    var digitizerToolSetElement = $("> div.digitizing-tool-set", previousSettings.frame);
                    digitizerToolSetElement.digitizingToolSet("deactivateCurrentControl");
                }
            });
            onSelectorChange();

            // Check position and react by
            var containerInfo = new MapbenderContainerInfo(widget, {
                onactive: function () {
                    widget.activate();
                },
                oninactive: function () {
                    widget.deactivate();
                }
            });

            widget.updateClusterStrategies();

        },

        /**
         * Evalute handler code
         * @param handlerCode
         * @param context
         * @private
         */
        _evaluateHandler: function (handlerCode, context) {

        },

        /**
         * Copy feature
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         */
        copyFeature: function (feature) {
            var widget = this;
            var schema = feature.schema;
            var layer = schema.layer;
            var newFeature = feature.clone();
            var config = schema.copy;
            var defaultAttributes = getValueOrDefault(config, "data", {});
            var allowCopy = true;

            _.each(schema.copy.rules, function (ruleCode) {
                var f = feature;
                eval('allowCopy = ' + ruleCode + ';');
                if (!allowCopy) {
                    return false;
                }
            });

            if (!allowCopy) {
                $.notify(Mapbender.digitizer_translate('feature.clone.on.error'));
                return;
            }

            var newAttributes = {};
            var uniqueKeyOfFeatureType = schema.featureType.uniqueId;

            _.extend(newAttributes, defaultAttributes);
            _.each(feature.attributes, function (v, k) {
                if (v === '' || v === null || k == uniqueKeyOfFeatureType) {
                    return;
                }
                newAttributes[k] = v;
            });

            newFeature.data = newFeature.properties = newFeature.attributes = newAttributes;
            newFeature.schema = schema;
            delete newFeature.fid;

            return widget.saveFeature(newFeature).done(function (response) {
                if (response.errors) {
                    Mapbender.error(Mapbender.digitizer_translate("feature.copy.error"));
                    return;
                }

                var request = this;
                var feature = request.feature;
                var rawFeature = response.features[0];

                // layer.removeFeatures([newFeature]);
                layer.drawFeature(feature, 'copy');
                // newFeature.disabled = false;

                widget._trigger("copyfeature", null, feature);

                var successHandler = getValueOrDefault(config, "on.success");
                if (successHandler) {
                    var r = function (feature) {
                        return eval(successHandler + ";");
                    }(feature);
                } else {
                    widget._openFeatureEditDialog(feature);
                }
            });
        },

        /**
         * On save button click
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature OpenLayers feature
         * @param disabledProperties
         * @private
         * @return {jQuery.jqXHR} ajax XHR
         */
        saveFeature: function (feature, disabledProperties) {
            if (feature.disabled) {
                return;
            }

            var widget = this;
            var schema = feature.schema;
            var dialog = feature.editDialog;
            var table = schema.table;
            var tableWidget = table.data('visUiJsResultTable');
            var tableApi = table.resultTable('getApi');
            var formData = dialog && dialog.formData() || schema.initialFormData(feature);
            if (disabledProperties) {
                disabledProperties.forEach(function (value) {
                    delete formData[value];
                });
            }
            var wkt = new OpenLayers.Format.WKT().write(feature);
            var srid = widget.map.getProjectionObject().proj.srsProjNumber;
            var request = {
                properties: formData,
                geometry: wkt,
                srid: srid,
                type: "Feature"
            };

            tableApi.draw({"paging": "page"});

            if (!feature.isNew && feature.fid) {
                request.id = feature.fid;
            }

            var errorInputs = $(".has-error", dialog);
            var hasErrors = errorInputs.size() > 0;

            if (!hasErrors) {
                feature.disabled = true;
                dialog && dialog.disableForm();

                return widget.query('save', {

                    schema: schema.schemaName,
                    feature: request
                }).done(function (response) {
                    if (response.hasOwnProperty('errors')) {
                        dialog && dialog.enableForm();
                        feature.disabled = false;
                        $.each(response.errors, function (i, error) {
                            $.notify(error.message, {
                                title: 'API Error',
                                autoHide: false,
                                className: 'error'
                            });
                            console.error(error.message);
                        });
                        return;
                    }

                    var hasFeatureAfterSave = response.features.length > 0;
                    delete widget.unsavedFeatures[feature.id];

                    if (response.solrImportStatus !== null) {
                        if (response.solrImportStatus === 0) {
                            $.notify(Mapbender.digitizer_translate("feature.solrImportStatus.successfully"), 'info');
                        } else {
                            $.notify(Mapbender.digitizer_translate("feature.solrImportStatus.error"), 'error');
                        }
                    }

                    if (!hasFeatureAfterSave) {
                        widget.reloadFeatures(schema.layer, _.without(schema.layer.features, feature));
                        dialog && dialog.popupDialog('close');
                        return;
                    }

                    var layer = schema.layer;
                    var dbFeature = response.features[0];
                    feature.fid = dbFeature.id;
                    feature.state = null;
                    if (feature.saveStyleDataCallback) {
                        // console.log("Late-saving style for feature", feature);
                        feature.saveStyleDataCallback(feature);
                        delete feature["saveStyleDataCallback"];
                    }
                    $.extend(feature.data, dbFeature.properties);

                    var geoJsonReader = new OpenLayers.Format.GeoJSON();
                    var newFeatures = geoJsonReader.read(response);
                    var newFeature = _.first(newFeatures);

                    _.each(['fid', 'disabled', 'state', 'data', 'layer', 'schema', 'isNew', 'renderIntent', 'styleId'], function (key) {
                        newFeature[key] = feature[key];
                    });

                    widget.reloadFeatures(schema.layer, _.union(_.without(layer.features, feature), [newFeature]));
                    feature = newFeature;

                    tableApi.row(tableWidget.getDomRowByData(feature)).invalidate();
                    tableApi.draw();

                    delete feature.isNew;

                    dialog && dialog.enableForm();
                    feature.disabled = false;
                    feature.oldGeom = false;
                    dialog && dialog.popupDialog('close');

                    this.feature = feature;

                    $.notify(Mapbender.digitizer_translate("feature.save.successfully"), 'info');

                    widget._trigger("featuresaved", null, feature);


                    var config = feature.schema;
                    if (config.hasOwnProperty("mailManager") && Mapbender.hasOwnProperty("MailManager")) {
                        try {
                            Mapbender.MailManager[config.mailManager](feature);
                        } catch (e) {
                            console.warn('The function' + config.mailManager + " is not supported by the Mapbender Mail Manager Extension");
                        }
                    }


                    var successHandler = getValueOrDefault(schema, "save.on.success");
                    if (successHandler) {
                        eval(successHandler);
                    }
                    if(schema.refreshFeaturesAfterSave){
                        _.each(schema.refreshFeaturesAfterSave, function(el,index){
                            widget.refreshConnectedDigitizerFeatures(el);
                        })
                    }
                });
            } else {
                return $.Deferred().reject(); // Same effect as error in ajax call
            }
        },

        /**
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @private
         */

        _createPopupConfiguration : function(olFeature) {

            var widget = this;
            var buttons = [];
            var schema = olFeature.schema;

            if (schema.printable) {

                var printButton = {
                    text: Mapbender.digitizer_translate('feature.print'),
                    click: function () {


                        var $dialog = $(this.currentPopup);
                        var feature = $dialog.data('feature');
                        var styleMap = this.currentSettings.layer.styleMap;

                        this.digitizerPrintLayer= new OpenLayers.Layer.Vector( 'digitizerPrintLayer')|| this.digitizerPrintLayer;
                        this.getMap().addLayer(this.digitizerPrintLayer);

                        this.digitizerPrintLayer.addFeatures([feature.clone()]);

                        this.digitizerPrintLayer.styleMap = this.currentSettings.layer.styleMap;
                        this.digitizerPrintLayer.features[0].renderIntent = 'select'
                        this.digitizerPrintLayer.redraw();

                        widget.printClient.printDigitizerFeature(feature, feature.schema.featureTypeName || feature.schema.schemaName).always(function() {
                            this.digitizerPrintLayer.removeAllFeatures();
                        }.bind(this));
                        // TODO

                    }.bind(this)
                };
                buttons.push(printButton);
            }
            if (schema.copy.enable) {
                buttons.push({
                    text: Mapbender.digitizer_translate('feature.clone.title'),
                    click: function (e) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        widget.copyFeature(feature);
                    }
                });
            }
            if (schema.allowCustomerStyle) {
                var styleButton = {
                    text: Mapbender.digitizer_translate('feature.style.change'),
                    click: function (e) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        widget.openChangeStyleDialog(feature);
                    }
                };
                buttons.push(styleButton);
            }
            if (schema.allowEditData && schema.allowSave) {
                var saveButton = {
                    text: Mapbender.digitizer_translate('feature.save.title'),
                    click: function () {

                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        var hasCoordinatesInput = !!$('.-fn-coordinates',dialog).length;
                        if(hasCoordinatesInput){

                            var inputX = $('.-fn-coordinates',dialog).find("[name=x]");
                            var inputY = $('.-fn-coordinates',dialog).find("[name=y]");

                            var x = Mapbender.Transformation.isDegree(inputX.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputX.val()) : inputX.val();
                            var y = Mapbender.Transformation.isDegree(inputY.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputY.val()) : inputY.val();

                            var activeEPSG = $('.-fn-active-epsgCode',dialog).find("select").val();

                            var coords = Mapbender.Transformation.transformToMapProj(x,y,activeEPSG);

                            if(!Mapbender.Transformation.areCoordinatesValid(coords)){
                                Mapbender.error('Coordinates are not valid');
                                return false;
                            // } else if(schema.popup.remoteData)  {
                            //     widget.openRemoteDataConfirmationDialog().done(function(answer) {
                            //         if (answer===true) {
                            //             widget._getRemoteData(feature, schema).done(function () {
                            //                 widget.saveFeature(feature, ['x', 'y']).fail(function () {
                            //                     $('.-fn-coordinates', dialog).find("[name=x]").val(x);
                            //                     $('.-fn-coordinates', dialog).find("[name=y]").val(y);
                            //                 });
                            //             });
                            //         } else {
                            //             widget.saveFeature(feature, ['x', 'y']).fail(function () {
                            //                 $('.-fn-coordinates', dialog).find("[name=x]").val(x);
                            //                 $('.-fn-coordinates', dialog).find("[name=y]").val(y);
                            //             });
                            //         }
                            //     });
                            //     return false;
                            } else {
                                widget.saveFeature(feature,['x','y']); // In case of !remoteData
                            }
                        } else {
                            widget.saveFeature(feature,['x','y']); // In case of !hasCoordinatesInput
                        }

                    }
                };
                buttons.push(saveButton);
            }
            if (schema.allowDelete) {
                buttons.push({
                    text: Mapbender.digitizer_translate('feature.remove.title'),
                    'class': 'critical',
                    click: function () {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        widget.removeFeature(feature);
                        widget.currentPopup.popupDialog('close');
                    }
                });
            }
            if (schema.allowCancelButton) {
                buttons.push({
                    text: Mapbender.digitizer_translate('cancel'),
                    click: function () {
                        this.currentPopup.popupDialog('close');
                    }.bind(this)
                });
            }
            var popupConfiguration = {
                title: Mapbender.digitizer_translate('feature.attributes'),
                width: widget.featureEditDialogWidth
            };

            if (schema.popup) {
                schema.popup.buttons = schema.popup.buttons || [];

                $.extend(popupConfiguration, schema.popup);

                if (popupConfiguration.buttons && !schema._popupButtonsInitialized) {
                    // Initialize custom button events
                    _.each(popupConfiguration.buttons, function (button) {
                        if (button.click) {
                            var eventHandlerCode = button.click;
                            button.click = function (e) {
                                var _widget = widget;
                                var el = $(this);
                                var form = $(this).closest(".ui-dialog-content");
                                var feature = form.data('feature');
                                var data = feature.data;

                                eval(eventHandlerCode);

                                e.preventDefault();
                                return false;
                            }
                        }
                    });

                    // Merge default and custom buttons
                    _.each(buttons, function (button) {
                        popupConfiguration.buttons.push(button);
                    });

                    schema._popupButtonsInitialized = true;
                }
            }

            return popupConfiguration;
        },

        /**
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         * @private
         */
        _processCurrentFormItemsWithDataManager : function(olFeature,formItemsForEditDialog) {
            var widget = this;
            var schema = olFeature.schema;
            // dataManager access function
            // TODO: maybe it would be better to create public methods on dataManager to do this
            function withSchema(dataManager, schemaName, callback) {
                var schema = dataManager.options.schemes[schemaName];
                // FIXME: following lines are a hack to get dataManager to open the correct popup
                // (it does open the popup for the scheme provided in currentSettings, not
                // the one passed to the _openEditPopup function)
                var prevSettings = dataManager.currentSettings;
                var prevActiveSchema = dataManager.activeSchema;
                dataManager.activeSchema = dataManager.currentSettings = schema;

                dataManager._getData(schema).then(function () {
                    callback(schema);
                    dataManager.currentSettings = prevSettings;
                    dataManager.activeSchema = prevActiveSchema;
                });
            }

            DataUtil.eachItem(formItemsForEditDialog, function (item) {

                if (schema.popup.remoteData && item.automatic_detection) {
                    var children = [];
                    var input = {
                        type: item.type,
                        title: item.title,
                        label: '',
                        name: item.name,
                        mandatory: item.mandatory,
                        options: item.options,
                        css: {width: '80%'},
                        keyup: item.keyup,

                    };

                    var button = {
                        type: "button",
                        title: "<i class='fa fa-plus'></i>",
                        css: {'margin-left': '15px', 'margin-bottom': '2px', 'width': '10%', 'max-width': '30px'},
                        label: '',
                        attr: {'href': '#', 'title': 'Automatisch ermitteln' },
                        click: function () {
                            var inputfield = $(widget.currentPopup).find("[name=" + item.name + "]");
                            inputfield.attr('disabled','disabled');
                            widget._getRemotePropertyValue(olFeature, schema, item.name).done(function (value) {
                                inputfield.removeAttr('disabled');
                                inputfield.val(value).keyup();
                            });
                            return false;
                        }
                    };

                    children.push(input);
                    children.push(button);

                    item.type = "fieldSet";
                    item.title = '';
                    item.label = '';
                    item.cssClass = 'automatic-detection-fieldset';
                    item.children = children;

                }

                if (item.type === "resultTable" && item.editable && !item.isProcessed) {
                    var onCreateClick;
                    var onEditClick;

                    if (!item.hasOwnProperty('dataManagerLink')) {
                        onCreateClick = function (e) {
                            e.preventDefault();
                            var item = $(this).next().data("item");
                            var popup = item.popupItems;
                            var table = $(this).siblings(".mapbender-element-result-table")

                            var feature = table.data('olFeature');
                            var data = {};

                            item.allowRemove = false;
                            data[item.dataStoreLink.fieldName] = data['linkId'] = feature.attributes[item.dataStoreLink.uniqueId];
                            data[item.dataStore.uniqueId] = null;
                            data.item = item;
                            widget._openEditDialog(data, popup, item, table);
                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var table = ui.parents('.mapbender-element-result-table');
                            var item = table.data('item');
                            var popup = item.popupItems;
                            var feature = table.data('olFeature');

                            item.allowRemove = true;
                            //rowData.externalId = rowData[item.dataStoreLink.uniqueId];//feature.attributes[item.dataStoreLink.uniqueId];


                            widget._openEditDialog(rowData, popup, item, table);

                            return false;
                        };
                    } else if (item.hasOwnProperty('dataManagerLink')) {
                        var schemaName = item.dataManagerLink.schema;
                        var fieldName = item.dataManagerLink.fieldName;
                        var schemaFieldName = item.dataManagerLink.schemaFieldName;

                        onCreateClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            withSchema(dm, schemaName, function (schema) {
                                dm._openEditDialog(schema.create());
                            });

                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];

                            withSchema(dm, schemaName, function (schema) {
                                var dataItem = _.find(schema.dataItems, function (d) {
                                    return d[schemaFieldName] === rowData[fieldName];
                                });
                                dm._openEditDialog(dataItem);
                            });

                            return false;
                        };
                    }

                    var cloneItem = $.extend({}, item);
                    cloneItem.isProcessed = true;
                    item.type = "container";
                    var button = {
                        type: "button",
                        title: "",
                        hover: Mapbender.digitizer_translate('feature.create'),
                        cssClass: "icon-create",
                        click: onCreateClick
                    };

                    item.children = [button, cloneItem];

                    var buttons = [];

                    buttons.push({
                        title: Mapbender.digitizer_translate('feature.edit'),
                        className: 'edit',
                        onClick: onEditClick
                    });

                    cloneItem.buttons = buttons;

                }


                if(item.type === 'coordinates'){
                    var children = [];
                    var mapProjection = widget.getMap().getProjectionObject().projCode;
                    var epsgCodes = item.epsgCodes;

                    // Add Map Projection to EPSG codes, only if it is not already there
                    var mapProjectionInEpsgCodes = false;
                    epsgCodes.forEach(function(code){
                       if (code[0]===mapProjection) {
                           mapProjectionInEpsgCodes = true;
                       }
                    });
                    if (!mapProjectionInEpsgCodes) {
                        epsgCodes.unshift([mapProjection,mapProjection]);
                    }

                    var EPSGSelection = {
                        title: item.title_epsg || 'EPSG:',
                        type: 'select',
                        options: epsgCodes,
                        value: mapProjection,
                        css : { width: '33.33%' },
                        cssClass: '-fn-active-epsgCode',
                        disabled: !!item.disabled,
                        change: function(event){

                            var oldEpsgCode = $('.-fn-coordinates-container').data('activeEpsgCode');
                            var oldProjection;
                            if (oldEpsgCode) {
                                oldProjection = new OpenLayers.Projection(oldEpsgCode);
                            }
                            var activeProj =  oldProjection || widget.getMap().getProjectionObject();
                            var epsgCode = $(event.currentTarget).find('select').val();
                            var inputX = $('.-fn-coordinates.x > input', widget.currentPopup);
                            var inputY = $('.-fn-coordinates.y > input', widget.currentPopup);
                            var x = Mapbender.Transformation.isDegree(inputX.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputX.val()) : inputX.val();
                            var y = Mapbender.Transformation.isDegree(inputY.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputY.val()) : inputY.val();

                            var projectionToTransform = new OpenLayers.Projection(epsgCode);
                            var lonlat = Mapbender.Transformation.transFromFromTo(new OpenLayers.LonLat(x, y),activeProj, projectionToTransform);
                            inputX.val(lonlat.x || '');
                            inputY.val(lonlat.y || '');
                            $('.-fn-coordinates-container').data('activeEpsgCode',epsgCode);

                        }
                    };

                    var input = {
                        type : 'input',
                        label: '',
                        css : { width: '33.33%' },
                        disabled: !!item.disabled,

                    };

                    // set default ordering, if the coordinatesFieldsOrder is not set in the digitizer YML
                    if (!item.coordinatesFieldsOrder) {
                        item.coordinatesFieldsOrder = ['x','y','epsg'];
                    }
                    _.each(item.coordinatesFieldsOrder, function(direction,i){
                      if (direction != 'epsg') {
                        var child  = {
                            cssClass : '-fn-coordinates ' + direction,
                            tile: direction + ': ',
                            title: (direction==='x' ? item.title_longitude || 'longitude' : item.title_latitude || 'latitude' ) + ': ',
                            name: direction,
                            css: " { width: 33%; }",
                            change : function(){

                                var dialog = widget.currentPopup;
                                var feature = dialog.data('feature');
                                var layer = widget.currentSettings.layer;

                                var inputX = $('.-fn-coordinates.x > input', widget.currentPopup);
                                var inputY = $('.-fn-coordinates.y > input', widget.currentPopup);
                                var x = Mapbender.Transformation.isDegree(inputX.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputX.val()) : inputX.val();
                                var y = Mapbender.Transformation.isDegree(inputY.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputY.val()) : inputY.val();

                                var activeProjection = $('.-fn-active-epsgCode', widget.currentPopup).find('select').val();

                                var projection = Mapbender.Transformation.transformToMapProj(x,y,activeProjection);

                                var oldGeometry = feature.geometry;
                                feature.geometry = new OpenLayers.Geometry.Point(projection.x,projection.y);

                                //var currentBounds = widget.map.calculateBounds();
                                //if (currentBounds.contains(projection.x,projection.y)) {

                                    if (oldGeometry.x && oldGeometry.y) {
                                        layer.renderer.eraseGeometry(oldGeometry);
                                    }
                                    layer.drawFeature(feature);
                                    widget._getData(widget.currentSettings); // Triggered in order to have new Feature in resultTable
                                // } else {
                                //
                                //     var transformedGeometry = Mapbender.Transformation.transformFromMapProj(oldGeometry.x, oldGeometry.y, activeProjection);
                                //     $('.-fn-coordinates.x > input', widget.currentPopup).val(transformedGeometry.x || '');
                                //     $('.-fn-coordinates.y > input', widget.currentPopup).val(transformedGeometry.y || '');
                                //
                                //     feature.geometry = oldGeometry;
                                //
                                //     $.notify('Coordinates are not in current viewport. Please zoom to a greater extent.');
                                // }

                            }
                        };
                        children.push($.extend(child,input));
                      } else {
                        children.push(EPSGSelection);
                      }
                    });
                    item.type = "fieldSet";
                    item.children=  children;
                    item.cssClass =  '-fn-coordinates-container coordinates-container';

                }
                if (item.type === "select" && !item.isProcessed && ((item.dataStore && item.dataStore.editable && item.dataStore.popupItems) || item.dataManagerLink)) {
                    var onCreateClick;
                    var onEditClick;

                    if (item.dataManagerLink) {
                        var schemaName = item.dataManagerLink.schema;
                        var schemaFieldName = item.dataManagerLink.schemaFieldName;

                        onCreateClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            withSchema(dm, schemaName, function (schema) {
                                dm._openEditDialog(schema.create());

                            });
                            $(dm.element).on('data.manager.item.saved', function (event, eventData) {
                                var uniqueIdKey = eventData.uniqueIdKey;
                                var text = item.itemPattern.replace('{id}', eventData.item[uniqueIdKey]).replace('{name}', eventData.item[item.itemName]);
                                var $option = $('<option />').val(eventData.item[uniqueIdKey]).text(text);
                                var $select = $('select[name=' + item.name + ']').append($option);
                                $select.val(eventData.item[uniqueIdKey]);
                            });
                            return false;
                        };

                        onEditClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var val = $(this).siblings().find('select').val();
                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            withSchema(dm, schemaName, function (schema) {
                                var dataItem = _.find(schema.dataItems, function (d) {
                                    return d[schemaFieldName].toString() === val;
                                });
                                var dialog = dm._openEditDialog(dataItem);

                            });

                            return false;
                        };
                    } else {
                        onCreateClick = function () {
                            var dataItemId = $(this).siblings().find('select').val();
                            var selectRef = $(this).siblings().find('select');

                            var dataStoreId = item.dataStore.id;
                            widget.query("datastore/get", {
                                schema: widget.schemaName,
                                id: dataStoreId,
                                dataItemId: dataItemId
                            }).done(function (data) {
                                widget._openEditDialog(data, item.dataStore.popupItems, item, selectRef);

                            });

                            return false;
                        };

                        onEditClick = function () {
                            var selectRef = $(this).siblings().find('select');
                            widget._openEditDialog({}, item.dataStore.popupItems, item, selectRef);

                            return false;
                        };
                    }

                    var cloneItem = $.extend({}, item);
                    cloneItem.isProcessed = true;
                    item.type = "fieldSet";
                    item.title = undefined;
                    item.children = [
                        cloneItem,
                        {
                            type: "button",
                            title: Mapbender.digitizer_translate('feature.edit'),
                            cssClass: 'edit',
                            click: onEditClick
                        },
                        {
                            type: "button",
                            title: "",
                            hover: Mapbender.digitizer_translate('feature.create'),
                            cssClass: "icon-create",
                            click: onCreateClick
                        }
                    ];
                }

                if (item.type === "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + olFeature.fid + "&field=" + item.name;
                    if (item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                        item.dbSrc = olFeature.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field == item.name) {
                                    if (fileInfo.formats) {
                                        item.accept = fileInfo.formats;
                                    }
                                }
                            });
                        }
                    }

                }

                if (item.type === 'image') {

                    if (!item.origSrc) {
                        item.origSrc = item.src;
                    }

                    if (item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                        item.dbSrc = olFeature.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field == item.name) {

                                    if (fileInfo.uri) {
                                        item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                    } else {
                                        item.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + item.name + "/" + item.dbSrc;
                                    }
                                }
                            });
                        }
                    }

                    var src = item.dbSrc ? item.dbSrc : item.origSrc;
                    if (!item.hasOwnProperty('relative') && !item.relative) {
                        item.src = src;
                    } else {
                        item.src = Mapbender.configuration.application.urls.asset + src;
                    }
                }
            });
        },


        /**
         * Open edit feature dialog
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature open layer feature
         * @private
         */
        _openFeatureEditDialog: function (olFeature) {

            var widget = this;
            var schema = olFeature.schema;
            var layer = olFeature.layer;
            var map = layer.map;
            var schemaPopupConfig = schema.popup ? schema.popup : {};
            var isOpenLayerCloudPopup = schemaPopupConfig.type && schemaPopupConfig.type === 'openlayers-cloud';

            if (widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
                if (isOpenLayerCloudPopup && schema.olFeatureCloudPopup) {
                    map.removePopup(schema.olFeatureCloudPopup);
                    schema.olFeatureCloudPopup.destroy();
                    schema.olFeatureCloudPopup = null;
                }
            }

            if (!schema.elementsTranslated) {
                translateStructure(widget.currentSettings.formItems);
                schema.elementsTranslated = true;
            }

            var formItemsForEditDialog = JSON.parse(JSON.stringify(widget.currentSettings.formItems)); // Deep clone hack!


            var popupConfiguration = this._createPopupConfiguration(olFeature);

            this._processCurrentFormItemsWithDataManager(olFeature,formItemsForEditDialog);

            var dialog = $("<div/>");
            olFeature.editDialog = dialog;





            dialog.data('feature', olFeature);
            dialog.data('digitizerWidget', widget);

            var formItems = formItemsForEditDialog;

            // If pop up isn't defined, generate inputs
            if (!_.size(formItems)) {
                formItems = [];
                _.each(olFeature.data, function (value, key) {
                    formItems.push({
                        type: 'input',
                        name: key,
                        title: key
                    })
                })
            }

            // Make variables available within generateElements by adding it to each item
            let iterate = (formItems) => {
                formItems.forEach((fi) => {
                    if (fi.children) {
                        iterate(fi.children);
                    } else {
                        fi.elementUrl = widget.elementUrl;
                        fi.schema = schema.schemaName;
                        fi.dialog = dialog;
                        fi.srs =  widget.map.getProjectionObject().proj.srsProjNumber;
                    }
                });
            }

            iterate(formItems);

            dialog.generateElements({children: formItems});
            dialog.popupDialog(popupConfiguration);
            schema.editDialog = dialog;
            widget.currentPopup = dialog;
            dialog.bind('edit-cancel', this.editCancel.bind(this));
            dialog.bind('popupdialogclose', function (event) {
                $('.-fn-coordinates-container').removeData('activeEpsgCode'); // In case of coordinate items, activeEPSG Code has to be resetted
                dialog.trigger('edit-cancel', {
                    'origin': 'close-button',
                    'feature': function () {
                        return dialog.data('feature')
                    }.bind(this),
                    'schema': schema
                });
            }.bind(this));


            if (popupConfiguration.modal) {
                dialog.bind('popupdialogclose', function () {
                    widget.currentPopup = null;
                });
            }


            if (isOpenLayerCloudPopup) {
                // Hide original popup but not kill it.
                dialog.closest('.ui-dialog').css({
                    'margin-left': '-100000px'
                }).hide(0);
            }

            var tables = dialog.find(".mapbender-element-result-table");
            _.each(tables, function (table, index) {

                var item = $(table).data('item');
                $(table).data('olFeature', olFeature);
                if (item.editable) {
                    item.columns.pop();
                }

                var dataStoreLinkName = item.dataStoreLink.name;
                if (dataStoreLinkName) {
                    var requestData = {
                        dataStoreLinkName: dataStoreLinkName,
                        fid: olFeature.fid,
                        fieldName: item.dataStoreLink.fieldName
                    };

                    widget.query('dataStore/get', requestData).done(function (data) {
                        if (Object.prototype.toString.call(data) === '[object Array]') {

                            var dataItems = [];
                            _.each(data, function (el, i) {
                                el.attributes.item = item;
                                dataItems.push(el.attributes)

                            });

                        } else {
                            data.item = item;
                            data = [data];
                        }

                        var tableApi = $(table).resultTable('getApi');
                        tableApi.clear();
                        tableApi.rows.add(dataItems);
                        tableApi.draw();

                    });
                }

            });

            olFeature.data.x = olFeature.geometry.x || '';
            olFeature.data.y = olFeature.geometry.y || '';

            if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
                $(dialog).prev().find('.close').focus();
            }

            setTimeout(function () {


                dialog.formData(olFeature.data);


                if (isOpenLayerCloudPopup) {
                    /**
                     * @var {OpenLayers.Popup.FramedCloud}
                     */
                    var olPopup = new OpenLayers.Popup.FramedCloud("popup", OpenLayers.LonLat.fromString(olFeature.geometry.toShortString()), null, dialog.html(), null, true);
                    schema.olFeatureCloudPopup = olPopup;
                    map.addPopup(olPopup);
                }

            }, 21);

            return dialog;

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
        _queryIntersect: function (request, bbox, debug) {
            var widget = this;
            var geometry = bbox.toGeometry();
            var _request = $.extend(true, {intersectGeometry: geometry.toString()}, request);

            if (debug) {
                if (!widget._boundLayer) {
                    widget._boundLayer = new OpenLayers.Layer.Vector("bboxGeometry");
                    widget.map.addLayer(widget._boundLayer);
                }

                var feature = new OpenLayers.Feature.Vector(geometry);
                widget._boundLayer.addFeatures([feature], null, {
                    strokeColor: "#ff3300",
                    strokeOpacity: 0,
                    strokeWidth: 0,
                    fillColor: "#FF9966",
                    fillOpacity: 0.1
                });
            }
            return widget.query('select', _request).done(function (featureCollection) {
                var schema = widget.options.schemes[_request["schema"]];
                widget._onFeatureCollectionLoaded(featureCollection, schema, this);
            });

        },

        /**
         * Analyse changed bounding box geometrie and load features as FeatureCollection.
         *
         * @param {Scheme} schema
         * @returns {*}
         * @private
         */

        _getData: function (schema) {

            var widget = this;
            schema = schema || widget.currentSettings;

            var map = widget.map;
            var projection = map.getProjectionObject();
            var extent = map.getExtent();
            var request = {
                srid: projection.proj.srsProjNumber,
                maxResults: schema.maxResults,
                schema: schema.schemaName
            };
            var isExtentOnly = schema.searchType === "currentExtent";

            if (isExtentOnly) {
                request = $.extend(true, {intersectGeometry: extent.toGeometry().toString()}, request);
            }

            switch (schema.searchType) {
                case  "currentExtent":
                    if (schema.hasOwnProperty("lastBbox")) {
                        var bbox = extent.toGeometry().getBounds();
                        var lastBbox = schema.lastBbox;

                        var topDiff = bbox.top - lastBbox.top;
                        var leftDiff = bbox.left - lastBbox.left;
                        var rightDiff = bbox.right - lastBbox.right;
                        var bottomDiff = bbox.bottom - lastBbox.bottom;

                        var sidesChanged = {
                            left: leftDiff < 0,
                            bottom: bottomDiff < 0,
                            right: rightDiff > 0,
                            top: topDiff > 0
                        };
                    }
            }

            // Only if search is defined
            if (schema.search) {

                // No user inputs - no search :)
                if (!schema.search.request) {
                    return;
                }

                // Aggregate request with search form values
                if (schema.search.request) {
                    request.search = schema.search.request;
                }

                // Check mandatory settings
                if (schema.search.mandatory) {

                    var mandatory = schema.search.mandatory;
                    var req = schema.search.request;
                    var errors = [];
                    _.each(mandatory, function (expression, key) {
                        if (!req[key]) {
                            errors.push(key);
                            return;
                        }
                        var reg = new RegExp(expression, "mg");
                        if (!(req[key]).toString().match(reg)) {
                            errors.push(key);
                            return;
                        }
                    });

                    // Input fields are note
                    if (_.size(errors)) {
                        // console.log("Search mandatory rules isn't complete", errors);
                        // Remove all features
                        widget.reloadFeatures(schema.layer, []);
                        schema.lastRequest = null;
                        return;
                    }
                }
            }

            // Prevent send same request
            if (!isExtentOnly // only if search isn't for current extent
                && schema.lastRequest && schema.lastRequest === JSON.stringify(request)) {
                return;
            }
            schema.lastRequest = JSON.stringify(request);

            // If schema search activated, then only
            if (schema.search && !isExtentOnly) {
                // Remove all features
                widget.reloadFeatures(schema.layer, []);
            }

            // Abort previous request
            if (schema.xhr) {
                schema.xhr.abort();
            }

            schema.xhr = widget.query('select', request).done(function (featureCollection) {
                widget._onFeatureCollectionLoaded(featureCollection, schema, this);
            });

            return schema.xhr;
        },

        // _initialFormData: function (feature) {
        //     return initialFormData(feature);
        // },


        /**
         * Highlight feature on the map
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         * @param {boolean} highlight
         * @private
         */
        _highlightFeature: function (feature, highlight) {

            if (!feature || (feature && !feature.layer)) {
                return;
            }

            if (feature.renderIntent && feature.renderIntent == 'invisible') {
                return;
            }

            var layer = feature.layer;
            var isFeatureVisible = _.contains(feature.layer.features, feature);
            var features = [];

            if (isFeatureVisible) {
                features.push(feature);
            } else {
                _.each(feature.layer.features, function (_feature) {
                    if (_feature.cluster && _.contains(_feature.cluster, feature)) {
                        features.push(_feature);
                        return false;
                    }
                });
            }
            _.each(features, function (feature) {
                var styleId = feature.styleId ? feature.styleId : 'default';
                if (feature.attributes && feature.attributes.label) {
                    layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
                } else {
                    if (highlight) {
                        layer.drawFeature(feature, 'select');
                    } else {
                        if (feature.selected) {
                            layer.drawFeature(feature, 'selected');
                        } else {
                            layer.drawFeature(feature, styleId);
                        }
                    }
                }
            });

            // layer.renderer.textRoot = layer.renderer.vectorRoot;
        },

        /**
         * Get target OpenLayers map object
         *
         * @returns  {OpenLayers.Map}
         */
        getMap: function () {
            return this.map;
        },

        /**
         * Zoom to JSON feature
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         */
        zoomToJsonFeature: function (feature) {

            if (!feature) {
                return
            }

            var widget = this;
            var olMap = widget.getMap();
            var schema = feature.schema ? feature.schema : widget.findFeatureSchema(feature);

            olMap.zoomToExtent(feature.geometry.getBounds());
            if (schema.hasOwnProperty('zoomScaleDenominator')) {
                olMap.zoomToScale(schema.zoomScaleDenominator, true);
            }
        },

        /**
         * Open feature edit dialog
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         */
        exportGeoJson: function (feature) {
            var widget = this;
            widget.query('export', {
                schema: widget.schemaName,
                feature: feature,
                format: 'GeoJSON'
            }).done(function (response) {

            })
        },

        /**
         * Find schema definition by open layer object
         *
         * @param layer
         */
        findSchemaByLayer: function (layer) {
            return _.find(this.options.schemes, {layer: layer});
        },

        /**
         * Update cluster strategies
         */
        updateClusterStrategies: function () {

            var widget = this;
            var options = widget.options;
            var scale = Math.round(widget.map.getScale());
            var map = widget.map;
            var clusterSettings;
            var closestClusterSettings;

            $.each(options.schemes, function (i, schema) {
                clusterSettings = null;

                if (!schema.clustering) {
                    return
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
                        widget.reloadFeatures(schema.layer, []);
                        schema.clusterStrategy.deactivate();
                        //schema.layer.redraw();
                        schema.isClustered = false;
                        widget.reloadFeatures(schema.layer, features);

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
         * Get schema style map
         *
         * @param schema
         * @returns {OpenLayers.StyleMap}
         */
        getSchemaStyleMap: function (schema) {
            var widget = this;
            var styles = schema.styles ? schema.styles : {};
            for (var k in widget.styles) {
                styles[k] = new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style[k], styles[k] ? styles[k] : widget.styles[k]));
            }
            return new OpenLayers.StyleMap(styles, {extendDefault: true});
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
            return _.find(options.schemes, {layer: olFeature.layer}) || olFeature.schema;
        },

        /**
         * Create vector feature layer
         *
         * @param {Scheme} schema
         * @returns {OpenLayers.Layer.Vector}
         */
        createSchemaFeatureLayer: function (schema) {
            var widget = this;
            var styles = schema.styles ? schema.styles : {};
            var isClustered = schema.isClustered = schema.hasOwnProperty('clustering');
            var strategies = [];
            var styleContext = {
                context: {
                    webRootPath: Mapbender.configuration.application.urls.asset,
                    feature: function (feature) {
                        return feature;
                    },
                    label: function (feature) {
                        if (feature.attributes.hasOwnProperty("label")) {
                            return feature.attributes.label;
                        }
                        return feature.cluster && feature.cluster.length > 1 ? feature.cluster.length : "";
                    }
                }
            };
            var styleMap = new OpenLayers.StyleMap({
                'default': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["default"], styles['default'] ? $.extend({}, widget.styles.default, styles['default']) : widget.styles.default), styleContext),
                'select': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["select"], styles['select'] ? styles['select'] : widget.styles.select), styleContext), //,
                'selected': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["selected"], styles['selected'] ? styles['selected'] : widget.styles.selected), styleContext) //,
                // 'invisible':
            }, {extendDefault: true});

            styleMap.styles.invisible = new OpenLayers.Style({
                strokeWidth: 1,
                fillColor: "#F7F79A",
                strokeColor: '#6fb536',
                display: 'none'
            });
            styleMap.styles.labelText = new OpenLayers.Style({
                strokeWidth: 0,
                fillColor: '#cccccc',
                fillOpacity: 0,
                strokeColor: '#5e1a2b',
                strokeOpacity: 0,
                pointRadius: 15,
                label: '${label}',
                fontSize: 15
            });
            styleMap.styles.labelTextHover = new OpenLayers.Style({
                strokeWidth: 0,
                fillColor: '#cccccc',
                strokeColor: '#2340d3',
                fillOpacity: 1,
                pointRadius: 15,
                label: '${label}',
                fontSize: 15
            });

            styleMap.styles.highlightForPrint =  new OpenLayers.Style({
                strokeWidth: 3,
                fillColor: "#FF0",
                strokeColor: '#000',
                fillOpacity: 1,
                pointRadius: 14,
                graphicZIndex: 100
            });

            styleMap.styles.unsaved = new OpenLayers.Style({
                strokeWidth: 3,
                fillColor: "#FFD14F",
                strokeColor: '#F5663C',
                fillOpacity: 0.5,
                pointRadius: 14,
                graphicZIndex: 100
            });

            var copyStyleData = getValueOrDefault(schema, 'copy.style', null);

            if (copyStyleData) {
                styleMap.styles.copy = new OpenLayers.Style(copyStyleData);
            }

            if (isClustered) {
                var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
                strategies.push(clusterStrategy);
                schema.clusterStrategy = clusterStrategy;
            }
            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap: styleMap,
                visibility: false,
                rendererOptions: {zIndexing: true},
                strategies: strategies
            });

            if (schema.maxScale) {
                layer.options.maxScale = schema.maxScale;
            }

            if (schema.minScale) {
                layer.options.minScale = schema.minScale;
            }

            layer.name = schema.label;





            widget.layers.push(layer);

            return layer;
        },

        /**
         * Remove OL feature
         *
         * @version 0.2
         * @returns {*}
         * @param  {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
         */
        removeFeature: function (olFeature) {
            var widget = this;
            var schema = widget.findFeatureSchema(olFeature);
            var isNew = olFeature.hasOwnProperty('isNew');
            var layer = olFeature.layer || schema.layer;
            var featureData = olFeature.attributes;

            if (!schema) {
                $.notify("Feature remove failed.", "error");
                return;
            }

            function _removeFeatureFromUI() {
                //var clonedFeature = jQuery.extend(true, {}, olFeature);
                var existingFeatures = schema.isClustered ? _.flatten(_.pluck(layer.features, "cluster")) : layer.features;
                widget.reloadFeatures(layer, _.without(existingFeatures, olFeature));

                /** @deprecated */
                widget._trigger('featureRemoved', null, {
                    schema: schema,
                    feature: featureData
                });
                widget._trigger('featureremove', null, olFeature);
            }

            if (isNew) {
                _removeFeatureFromUI()
            } else {
                Mapbender.confirmDialog({
                    html: Mapbender.digitizer_translate("feature.remove.from.database"),
                    onSuccess: function () {
                        widget.query('delete', {
                            schema: schema.schemaName,
                            feature: featureData
                        }).done(function (fid) {
                            _removeFeatureFromUI();
                            $.notify(Mapbender.digitizer_translate('feature.remove.successfully'), 'info');
                        });
                    }
                });
            }

            return olFeature;
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
        _getFeaturesFromEvent: function (x, y) {
            var features = [], targets = [], layers = [];
            var layer, target, feature, i, len;
            var map = this.map;

            //map.resetLayersZIndex();

            // go through all layers looking for targets
            for (i = map.layers.length - 1; i >= 0; --i) {
                layer = map.layers[i];
                if (layer.div.style.display !== "none") {
                    if (layer === this.activeLayer) {
                        target = document.elementFromPoint(x, y);
                        while (target && target._featureId) {
                            feature = layer.getFeatureById(target._featureId);
                            if (feature) {
                                features.push(feature);
                                target.style.visibility = 'hidden';
                                targets.push(target);
                                target = document.elementFromPoint(x, y);
                            } else {
                                target = false;
                            }
                        }
                    }
                    layers.push(layer);
                    layer.div.style.display = "none";
                }
            }

            // restore feature visibility
            for (i = 0, len = targets.length; i < len; ++i) {
                targets[i].style.display = "";
                targets[i].style.visibility = 'visible';
            }

            // restore layer visibility
            for (i = layers.length - 1; i >= 0; --i) {
                layers[i].div.style.display = "block";
            }

            //map.resetLayersZIndex();
            return features;
        },

        /**
         * Handle feature collection by ajax response.
         *
         * @param {FeatureCollection} featureCollection
         * @param {Scheme} schema
         * @param xhr ajax request object
         * @private
         * @version 0.2
         */
        _onFeatureCollectionLoaded: function (featureCollection, schema, xhr) {

            if (!featureCollection || !featureCollection.hasOwnProperty("features")) {
                Mapbender.error(Mapbender.digitizer_translate("features.loading.error"), featureCollection, xhr);
                return;
            }


            if (featureCollection.features && featureCollection.features.length == schema.maxResults) {
                Mapbender.info(Mapbender.digitizer_translate("api.query.toomuch")+" ("+schema.maxResults+")");

            }

            var widget = this;
            var geoJsonReader = new OpenLayers.Format.GeoJSON();
            var currentExtentOnly = schema.searchType == "currentExtent";
            var layer = schema.layer;
            var map = layer.map;
            var extent = map.getExtent();
            var bbox = extent.toGeometry().getBounds();
            var existingFeatures = schema.isClustered ? _.flatten(_.pluck(layer.features, "cluster")) : layer.features;
            var visibleFeatures = currentExtentOnly ? _.filter(existingFeatures, function (olFeature) {
                return olFeature && (olFeature.hasOwnProperty('isNew') || olFeature.geometry.getBounds().intersectsBounds(bbox));
            }) : existingFeatures;
            var visibleFeatureIds = _.pluck(visibleFeatures, "fid");
            var filteredNewFeatures = _.filter(featureCollection.features, function (feature) {
                return !_.contains(visibleFeatureIds, feature.id);
            });
            var newUniqueFeatures = geoJsonReader.read({
                type: "FeatureCollection",
                features: filteredNewFeatures
            });

            var _features = _.union(newUniqueFeatures, visibleFeatures);

            if (schema.group && schema.group == "all") {
                _features = geoJsonReader.read({
                    type: "FeatureCollection",
                    features: featureCollection.features
                });
            }

            var features = [];
            var polygones = [];
            var lineStrings = [];
            var points = [];

            _.each(_features, function (feature) {
                if (!feature.geometry) {
                    return;
                }
                switch (feature.geometry.CLASS_NAME) {
                    case  "OpenLayers.Geometry.Polygon":
                        polygones.push(feature);
                        break;
                    case  "OpenLayers.Geometry.LineString":
                        lineStrings.push(feature);
                        break;
                    case  "OpenLayers.Geometry.Point":
                        points.push(feature);
                        // if(feature.attributes.label) {
                        //     feature.style = new OpenLayers.Style({
                        //         'label': '${label}'
                        //     });
                        // }
                        break;
                    default:
                        features.push(feature);
                }
            });

            widget.reloadFeatures(layer, _.union(features, polygones, lineStrings, points));
        },

        /**
         * Reload or replace features from the layer and feature table
         * - Fix OpenLayer bug by clustered features.
         *
         * @param {(OpenLayers.Layer | OpenLayers.Layer.Vector)} layer
         * @param _features
         * @version 0.2
         */
        reloadFeatures: function (layer, _features) {
            var widget = this;
            var schema = widget.findSchemaByLayer(layer);
            var tableApi = schema.table.resultTable('getApi');
            var features = _features || layer.features;

            if (features.length && features[0].cluster) {
                features = _.flatten(_.pluck(layer.features, "cluster"));
            }

            var featuresWithoutDrawElements = _.difference(features, _.where(features, {_sketch: true}));

            layer.removeAllFeatures();
            layer.addFeatures(features);

            // Add layer to feature
            _.each(features, function (feature) {
                feature.layer = layer;
                feature.schema = schema;

                if (feature.attributes && feature.attributes.label) {
                    feature.styleId = "labelText";
                    widget._highlightFeature(feature);
                    return;
                }

                if (schema.featureStyles && schema.featureStyles[feature.fid]) {
                    if (!feature.styleId) {
                        var styleData = schema.featureStyles[feature.fid];
                        var styleMap = layer.options.styleMap;
                        var styles = styleMap.styles;
                        var styleId = styleData.id;
                        var style = new OpenLayers.Style(styleData, {uid: styleId});
                        // style.id = styleId;
                        styles[styleId] = style;
                        feature.styleId = styleId;
                        widget._highlightFeature(feature);
                    }
                }

            });

            layer.redraw();

            tableApi.clear();
            tableApi.rows.add(featuresWithoutDrawElements);
            tableApi.draw();

            if (widget.options.__disabled) {
                widget.deactivate(true);
            }

            // var tbody = $(tableApi.body());

            // Post handling
            var nodes = tableApi.rows(function (idx, data, row) {
                var isInvisible = data.renderIntent == 'invisible';
                if (isInvisible) {
                    var $row = $(row);
                    var visibilityButton = $row.find('.button.icon-visibility');
                    visibilityButton.addClass('icon-invisibility');
                    $row.addClass('invisible-feature');
                }
                return true;
            });
        },


        /**
         *
         * @param dataItem
         * @param formItems
         * @param {Scheme} schema
         * @param ref
         * @returns {*|jQuery|HTMLElement}
         * @private
         */
       _openEditDialog: function (dataItem, formItems, schema, ref) {

            var schemaName = this.schemaName;
            var widget = this;
            var uniqueKey = schema.dataStore.uniqueId;
            var textKey = schema.dataStore.text;
            var buttons = [];

            if (widget.currentPopup.currentPopup) {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
            }

            var refreshConnectedDataManager = function() {
                $('.mb-element').filter(function(i,el) { return !!$(el).data()["mapbenderMbDataManager"]}).each(function(i,el) {

                    var widget = $(el).data()["mapbenderMbDataManager"];

                    if (!!widget.options.schemes[schema.connectedDataManager]) {
                        console.log(widget._getData(widget.currentSettings));
                        console.log("Data Manager refreshed");
                    }
                });

            };

            var saveButton = {
                text: Mapbender.digitizer_translate("feature.save.title", false),
                click: function () {
                    widget.saveForeignDataStoreItem(dataItem).then(refreshConnectedDataManager);
                }
            };
            buttons.push(saveButton);

            buttons.push({

                text: Mapbender.digitizer_translate("feature.remove.title", false),
                class: 'critical',
                click: function () {

                    Mapbender.confirmDialog({

                        html: Mapbender.digitizer_translate("feature.remove.from.database"),
                        onSuccess: function () {

                            var uniqueIdKey = schema.dataStore.uniqueId;
                            widget.query('datastore/remove', {
                                schema: dataItem.item.dataStoreLink.name,
                                dataItemId: dataItem[uniqueIdKey],
                                dataStoreLinkFieldName: schema.dataStoreLink.fieldName,
                                linkId: dataItem[dataItem.item.dataStoreLink.fieldName]

                            }).done(function (response) {

                                if (response.processedItem.hasOwnProperty('errors')) {
                                    $(dialog).enableForm();
                                    $.each(response.errors, function (i, error) {
                                        $.notify(error.message, {
                                            title: 'API Error',
                                            autoHide: false,
                                            className: 'error'
                                        });
                                        console.error(error.message);
                                    });
                                    return;
                                }
                                var data = response.dataItems;
                                var tableApi = $(dialog).data('table').resultTable('getApi');
                                var item = $(dialog).data('table').data('item');
                                if (Object.prototype.toString.call(data) === '[object Array]') {
                                    var a = [];
                                    _.each(data, function (e, i) {
                                        if (e.hasOwnProperty('attributes')) {
                                            e.attributes.item = item;
                                            a.push(e.attributes);
                                        }
                                    });

                                    data = a;

                                } else {
                                    if (data.hasOwnProperty('attributes')) {
                                        data = [data.attributes];

                                    }

                                }
                                tableApi.clear();
                                tableApi.rows.add(data);
                                tableApi.draw();
                                widget.currentPopup.currentPopup.popupDialog('close');
                                widget.currentPopup.currentPopup = null;
                                $.notify(Mapbender.digitizer_translate("feature.remove.successfully", false), 'info');

                                refreshConnectedDataManager();
                            })

                        }
                    });
                }
            });

            buttons.push({
                text: Mapbender.digitizer_translate("cancel"),
                click: function () {
                    widget.currentPopup.currentPopup.popupDialog('close');
                    widget.currentPopup.currentPopup = null;
                }
            });

            var dialog = $("<div/>");
            dialog.on("popupdialogopen", function (event, ui) {
                setTimeout(function () {
                    dialog.formData(dataItem);

                }, 1);
            });

            /*   if(!schema.elementsTranslated) {
             translateStructure(widget.currentSettings.formItems);
             schema.elementsTranslated = true;
             } */

            DataUtil.eachItem(widget.currentSettings.formItems, function (item) {
                if (item.type == "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + dataItem.fid + "&field=" + item.name;
                    if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                        item.dbSrc = dataItem.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field == item.name) {
                                    if (fileInfo.formats) {
                                        item.accept = fileInfo.formats;
                                    }
                                }
                            });
                        }
                    }

                }

                if (item.type == 'image') {

                    if (!item.origSrc) {
                        item.origSrc = item.src;
                    }

                    if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                        item.dbSrc = dataItem.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field === item.name) {

                                    if (fileInfo.uri) {
                                        item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                    } else {
                                    }
                                }
                            });
                        }
                    }

                    var src = item.dbSrc ? item.dbSrc : item.origSrc;
                    if (item.relative) {
                        item.src = src.match(/^(http[s]?\:|\/{2})/) ? src : Mapbender.configuration.application.urls.asset + src;
                    } else {
                        item.src = src;
                    }
                }

            });
            /*  if(schema.popup.buttons) {
             buttons = _.union(schema.popup.buttons, buttons);
             } */
            var popupConfig = _.extend({

                title: dataItem.item.title, //Mapbender.digitizer_translate("feature.attributes"),

                width: widget.featureEditDialogWidth,
            }, schema.popup);

            popupConfig.buttons = buttons;

            dialog.generateElements({children: formItems});
            dialog.popupDialog(popupConfig);
            dialog.addClass("data-store-edit-data");
            widget.currentPopup.currentPopup = dialog;
            dialog.parentDialog = widget.currentPopup;
            dialog.data('schema', schema);
            dialog.data('table', ref);

            return dialog;
        },

        /**
         *
         * @param dataItem
         * @returns {boolean}
         */

        saveForeignDataStoreItem: function (dataItem) {

            var widget = this;
            var dialog = widget.currentPopup.currentPopup;
            var uniqueIdKey = dataItem.item.dataStore.uniqueId;
            var isNew = dataItem[uniqueIdKey] === null;
            var formData = dialog.formData();
            var schema = dialog.data('schema');

            if (!isNew) {

                formData[uniqueIdKey] = dataItem[uniqueIdKey];
                dataItem['linkId'] = dataItem[schema.dataStoreLink.fieldName];

            } else {
                delete formData[uniqueIdKey];

                formData[schema.dataStoreLink.fieldName] = dataItem.linkId;

            }
            var errorInputs = $(".has-error", dialog);
            var hasErrors = errorInputs.size() > 0;
            if (hasErrors) {
                return false;

            }

            $(dialog).disableForm();

            return widget.query('datastore/save', {
                schema: dataItem.item.dataStoreLink.name,
                dataItem: formData,
                dataItemId: dataItem[uniqueIdKey],
                linkId: dataItem.linkId,
                dataStoreLinkFieldName: schema.dataStoreLink.fieldName
            }).done(function (response) {
                if (response.processedItem.hasOwnProperty('errors')) {
                    $(dialog).enableForm();
                    $.each(response.errors, function (i, error) {
                        $.notify(error.message, {
                            title: 'API Error',
                            autoHide: false,
                            className: 'error'
                        });
                        console.error(error.message);
                    });
                    return;
                }
                var data = response.dataItems;
                var tableApi = $(dialog).data('table').resultTable('getApi');
                var item = $(dialog).data('table').data('item');
                if (Object.prototype.toString.call(data) === '[object Array]') {
                    var a = [];
                    _.each(data, function (e, i) {
                        if (e.hasOwnProperty('attributes')) {
                            e.attributes.item = item;
                            a.push(e.attributes);
                        }
                    });

                    data = a;

                } else {
                    if (data.hasOwnProperty('attributes')) {
                        data = [data.attributes];

                    }

                }
                tableApi.clear();
                tableApi.rows.add(data);
                tableApi.draw();

                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
                $(dialog).enableForm();
                $.notify(Mapbender.digitizer_translate("feature.save.successfully", false), 'info');
            });

        },

        save: function (dataItem) {
            debugger;
            //dataItem.uniqueId

        },

        /**
         * Digitizer API connection query
         *
         * @param uri suffix
         * @param request query
         * @return xhr jQuery XHR object
         * @version 0.2
         */
        query: function (uri, request) {
            var widget = this;
            return $.ajax({
                url: widget.elementUrl + uri,
                type: 'POST',
                contentType: "application/json; charset=utf-8",
                dataType:    "json",
                data:        JSON.stringify(request)
            }).fail(function(xhr) {
                // this happens on logout: error callback with status code 200 'ok'
                if (xhr.status === 200 && xhr.getResponseHeader("Content-Type").toLowerCase().indexOf("text/html") >= 0) {
                    window.location.reload();
                }
            }).fail(function(xhr) {
                if (xhr.statusText === 'abort') {
                    return;
                }
                var errorMessage = Mapbender.digitizer_translate('api.query.error-message');
                var errorDom = $(xhr.responseText);

                // https://stackoverflow.com/a/298758
                var exceptionTextNodes = $('.sf-reset .text-exception h1', errorDom).contents().filter(function() {
                    return this.nodeType === (Node && Node.TEXT_NODE || 3) && ((this.nodeValue || '').trim());
                });
                if (exceptionTextNodes && exceptionTextNodes.length) {
                    errorMessage = [errorMessage, exceptionTextNodes[0].nodeValue.trim()].join("\n");
                }
                $.notify(errorMessage, {
                    autoHide: false
                });
            });
        },

        activate: function () {
            var widget = this;

            widget.query('getConfiguration').done(function (response) {
                _.each(response.schemes, function(schema,schemaName){
                    widget.options.schemes[schemaName].formItems = response.schemes[schemaName].formItems
                });

                widget.options.__disabled = false;
                widget.currentSettings.activateSchema();
                widget._setContextMenuMap();

            });

        },

        deactivate: function (ommitRemoveContextMenu) {
            var widget = this;
            // clear unsaved features to prevent multiple confirmation popups
            var unsavedFeatures = widget.unsavedFeatures;
            widget.unsavedFeatures = {};
            var always = function () {
                widget.options.__disabled = true;
                if (!widget.currentSettings.displayOnInactive) {
                    widget.currentSettings.deactivateSchema();
                }
                if (ommitRemoveContextMenu) {
                    return;
                }
                widget._removeContextMenuMap();
            };
            always()

        },


        /**
         *
         * @param event
         * @param eventData
         */

        editCancel : function(event, eventData) {
            var widget = this;
            var feature = eventData.feature();
            if (feature.hasOwnProperty('isNew') && eventData.schema.allowDeleteByCancelNewGeometry) {
                this.removeFeature(feature);
            }
            if(eventData.origin === 'cancel-button'){
                this.currentPopup.popupDialog('close');
            }
            if(!feature.hasOwnProperty('isNew') && feature.hasOwnProperty("oldGeom")){


                feature.geometry.x =  feature.oldGeom.x;
                feature.geometry.y =  feature.oldGeom.y;


                var layer = feature.layer || widget.currentSettings.layer;

                if (layer) {
                    layer.redraw();
                    layer.setVisibility(false);

                    layer.setVisibility(true);
                } else {
                    console.warn("Redrawing of Layer not possible");
                }

            }

        },

        /**
         *
         * @param featureTypeName
         */

        refreshConnectedDigitizerFeatures : function(featureTypeName){
            var schema = {};
            $(".mb-element-digitizer").not(".mb-element-data-manager").each(function(index,element){
                var digitzer = $(element).data("mapbenderMbDigitizer");
                var schemes = digitzer.options.schemes;
                _.each(schemes, function(schema, key){
                    if(key === featureTypeName){

                        if(schema.layer){
                            digitzer._getData(schema);
                        }
                        return true;
                    }
                }.bind(this))
            }.bind(this))


        },

        /**
         * Download file by feature and his attribute name
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature OpenLayers
         * @param {String} attributeName
         */
        download: function (feature, attributeName) {
            var widget = this;
            var schema = feature.schema;
            var attributes = feature.attributes;
            var tableName = schema.featureType.table;
            var relativeWebPath = Mapbender.configuration.application.urls.asset;
            window.open(relativeWebPath + widget.options.fileUri + '/' + tableName + '/' + attributeName + '/' + attributes[attributeName]);

        },

        // TODO seperate Feature Info calls for individual properties in order to avoid iterating through meaningless dataSets
        _getRemotePropertyValue: function (feature, schema, property) {
            var widget = this;
            var map = this.getMap();
            if (!feature.geometry) {
                return false;
            }
            var bbox = feature.geometry.getBounds();
            bbox.right = parseFloat(bbox.right + 0.00001);
            bbox.top = parseFloat(bbox.top + 0.00001);
            bbox = bbox.toBBOX();
            var srid = map.getProjection().replace('EPSG:', '');
            var url = this.elementUrl + "getFeatureInfo/";

            var ajaxCall = $.get(url,{
                bbox :bbox,
                schema: schema.schemaName,
                srid: srid
            });

                    // Mock:
                    // ajaxCall = $.Deferred().resolve({dataSets: ['{"type":"FeatureCollection","totalFeatures":"unknown","features":[  {"type":"Feature","id":"","geometry":null,"properties":{    "elevation_base":844}  }],"crs":null}',
                    //     '  {  "type": "FeatureCollection",  "features": [  {  "type": "Feature",  "geometry": null,  "properties": {  "OBJECTID": "78290",  "KG_NUMMER": "75204",  "KG_NAME": "Gschriet",  "INSPIREID": "AT.0002.I.4.KG.75204"  },  "layerName": "1"  }  ]  }  ']});

            return ajaxCall.then(function (response) {
                if (response.error) {
                    Mapbender.error(Mapbender.digitizer_translate('remoteData.error'));
                    return;
                }
                var newProperty = null;
                _.each(response.dataSets, function (dataSet) {
                    try {
                        var json =  JSON.parse(dataSet);
                        newProperty = json.features[0].properties[property] || newProperty; // Normally, the value is only present in one of the dataSets
                    } catch (e) {
                        // Prevent interruption in case of empty features
                    }
                });
                return newProperty;
            }).fail(function (response) {
                Mapbender.error(Mapbender.digitizer_translate("remoteData.error"));

            });


        }

    });

})(jQuery);
