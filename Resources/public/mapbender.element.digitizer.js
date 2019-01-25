(function ($) {
    "use strict";

    /**
     * Regular Expression to get checked if string should be translated
     *
     * @type {RegExp}
     */
    var translationReg = /^trans:\w+\.(\w|-|\.{1}\w+)+\w+$/;

    /**
     * Translate digitizer keywords
     * @param title
     * @param withoutSuffix
     * @returns {*}
     */
    function translate(title, withoutSuffix) {
        return Mapbender.trans(withoutSuffix ? title : "mb.digitizer." + title);
    }

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
                items[k] = translate(item.split(':')[1], true);
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
     * "Fake" form data for a feature that hasn't gone through attribute
     * editing, for saving. This is used when we save a feature that has only
     * been moved / dragged. The popup dialog with the form is not initialized
     * in these cases.
     * Assigned values are copied from the feature's data, if it was already
     * stored in the db, empty otherwise.
     *
     * @param feature
     * @returns {{}}
     */
    function initialFormData(feature) {
        var formData = {};
        var extractFormData;
        extractFormData = function (definition) {
            _.forEach(definition, function (item) {
                if (_.isArray(item)) {
                    // recurse into lists
                    extractFormData(item);
                } else if (item.name) {
                    var currentValue = (feature.data || {})[item.name];
                    // keep empty string, but replace undefined => null
                    if (typeof(currentValue) === 'undefined') {
                        currentValue = null;
                    }
                    formData[item.name] = currentValue;
                } else if (item.children) {
                    // recurse into child property (should be a list)
                    extractFormData(item.children);
                }
            });
        };
        extractFormData(feature.schema.formItems);
        return formData;
    }

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
                    items[k] = translate(items[k].split(':')[1], true);
                }
            }
        }
    }

    /**
     * Escape HTML chars
     * @param text
     * @returns {string}
     */
    function escapeHtml(text) {
        'use strict';
        return text.replace(/[\"&'\/<>]/g, function (a) {
            return {
                '"': '&quot;',
                '&': '&amp;',
                "'": '&#39;',
                '/': '&#47;',
                '<': '&lt;',
                '>': '&gt;'
            }[a];
        });
    }

    function findFeatureByPropertyValue(layer, propName, propValue) {
        for (var i = 0; i < layer.features.length; i++) {
            if (layer.features[i][propName] === propValue) {
                return layer.features[i];
            }
        }
        return null;
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
         * @returns {*}
         */
        openChangeStyleDialog: function (olFeature) {
            var widget = this;
            var layer = olFeature.layer;
            var styleMap = layer.options.styleMap;
            var styles = styleMap.styles;
            var defaultStyleData = olFeature.style ? olFeature.style : _.extend({}, styles["default"].defaultStyle);

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
        _saveStyle: function (schemaName, styleData, olFeature) {
            return this.query('style/save', {
                style: styleData,
                featureId: olFeature.fid,
                schema: schemaName
            });
        },

        _createToolsetTranslations: function(schema) {

            var toolSetTranslations = {
                drawPoint: "Punkt setzen",
                drawLine: "Linie zeichnen",
                drawPolygon: "Polygon zeichnen",
                drawRectangle: "Rechteck zeichen",
                drawCircle: "Kreis zeichen",
                drawEllipse: "Ellipse zeichen",
                drawDonut: "Polygon mit Enklave zeichnen",
                selectAndEditGeometry: "Objekt Position/Größe beabeiten",
                moveGeometry: "Objekt bewegen",
                selectGeometry: "Objekt selektieren",
                removeSelected: "Selektierte objekte löschen",
                removeAll: "Alle Objekte löschen"
            };

            // Merge subjects with available translations
            if (schema.featureType && schema.featureType.geomType) {
                var geomType = schema.featureType.geomType;
                var translationPrefix = 'mb.digitizer.toolset.' + geomType + '.';

                _.each(Mapbender.i18n, function (v, k) {
                    if (k.indexOf(translationPrefix) === 0) {
                        var shortKeyName = k.split(translationPrefix)[1];
                        toolSetTranslations[shortKeyName] = v;
                    }
                });
            }

            return toolSetTranslations;
        },

        _generateSearchForm: function(schema,frame) {
            // If searching defined, then try to generate a form
            if (schema.search) {
                var searchForm;
                if (schema.search.form) {

                    var foreachItemTree = function (items, callback) {
                        _.each(items, function (item) {
                            callback(item);
                            if (item.children && $.isArray(item.children)) {
                                foreachItemTree(item.children, callback);
                            }
                        })
                    };
                    var elementUrl = widget.elementUrl;
                    // $.fn.select2.defaults.set('amdBase', 'select2/');
                    // $.fn.select2.defaults.set('amdLanguageBase', 'select2/dist/js/i18n/');

                    foreachItemTree(schema.search.form, function (item) {

                        if (item.type && item.type === 'select') {
                            if (item.ajax) {

                                // Hack to get display results as an HTML
                                item.escapeMarkup = function (m) {
                                    return m;
                                };
                                // Replace auto-complete results with required key word
                                item.templateResult = function (d, selectDom, c) {
                                    var html = d && d.text ? d.text : '';
                                    if (d && d.id && d.text) {
                                        // Highlight results
                                        html = d.text.replace(new RegExp(ajax.lastTerm, "gmi"), '<span style="background-color: #fffb67;">\$&</span>');
                                    }
                                    return html;
                                };
                                var ajax = item.ajax;
                                ajax.dataType = 'json';
                                ajax.url = elementUrl + 'form/select';
                                ajax.data = function (params) {
                                    if (params && params.term) {
                                        // Save last given term to get highlighted in templateResult
                                        ajax.lastTerm = params.term;
                                    }
                                    return {
                                        schema: schema.schemaName,
                                        item: item,
                                        form: searchForm.formData(),
                                        params: params
                                    };
                                };

                            }
                        }
                    });
                    frame.generateElements({
                        type: 'form',
                        cssClass: 'search',
                        children: schema.search.form
                    });
                }

                searchForm = $('form.search', frame);

                var onSubmitSearch = function (e) {
                    schema.search.request = searchForm.formData();
                    var xhr = widget._getData();
                    if (xhr) {
                        xhr.done(function () {
                            var olMap = widget.getMap();
                            olMap.zoomToExtent(layer.getDataExtent());

                            if (schema.search.hasOwnProperty('zoomScale')) {
                                olMap.zoomToScale(schema.search.zoomScale, true);
                            }
                        });
                    }
                    return false;
                };

                searchForm
                    .on('submit', onSubmitSearch)
                    .find(' :input')
                    .on('change', onSubmitSearch);
            }

            if (!schema.showExtendSearchSwitch) {
                $(".onlyExtent", frame).css('display', 'none');
            }
        },


        _addSelectControl: function(layer,schema) {
            var widget = this;
            var map = widget.map;
            var table = schema.table;

            var selectControl = new OpenLayers.Control.SelectFeature(layer, {
                hover: true,

                clickFeature: function (feature) {
                    var features = feature.cluster ? feature.cluster : [feature];

                    if (_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true})) {
                        return;
                    }

                    feature.selected = !feature.selected;

                    var selectionManager = table.resultTable("getSelection");

                    if (feature.selected) {
                        selectionManager.add(feature);
                    } else {
                        selectionManager.remove(feature);
                    }

                    widget._highlightSchemaFeature(schema, feature, true);

                    if (schema.allowEditData) {
                        widget._openFeatureEditDialog(features[0]);
                    }
                },
                overFeature: function (feature) {
                    widget._highlightSchemaFeature(schema, feature, true);
                },
                outFeature: function (feature) {
                    widget._highlightSchemaFeature(schema, feature, false);
                }
            });

            // Workaround to move map by touch vector features
            if (typeof(selectControl.handlers) != "undefined") { // OL 2.7
                selectControl.handlers.feature.stopDown = false;
            }
            // else if (typeof(selectFeatureControl.handler) != "undefined") { // OL < 2.7
            //     selectControl.handler.stopDown = false;
            //     selectControl.handler.stopUp = false;
            // }

            schema.selectControl = selectControl;
            selectControl.deactivate();
            map.addControl(selectControl);
        },

        _createMapContextMenu: function() {
            var widget = this;
            var map = widget.map;

            function createSubMenu(olFeature) {
                var layer = olFeature.layer;
                var schema = widget.findSchemaByLayer(layer);
                var subItems = {
                    zoomTo: {
                        name: translate('feature.zoomTo'),
                        action: function (key, options, parameters) {
                            widget.zoomToJsonFeature(parameters.olFeature);
                        }
                    }
                };

                if (schema.allowChangeVisibility) {
                    subItems['style'] = {
                        name: translate('feature.visibility.change'),
                        action: function (key, options, parameters) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    };
                }

                if (schema.allowCustomerStyle) {
                    subItems['style'] = {
                        name: translate('feature.style.change'),
                        action: function (key, options, parameters) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    };
                }

                if (schema.allowEditData) {
                    subItems['edit'] = {
                        name: translate('feature.edit'),
                        action: function (key, options, parameters) {
                            widget._openFeatureEditDialog(parameters.olFeature);
                        }
                    }
                }

                if (schema.allowDelete) {
                    subItems['remove'] = {
                        name: translate('feature.remove.title'),
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
                        //features = widget._getFeaturesFromEvent(e.clientX, e.clientY);

                        _.each(features, function (feature) {
                            if (!feature.layer) {
                                feature.layer = olFeature.layer; // TODO looks like bug
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

        _createElementContextMenu: function() {
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

                    items['changeStyle'] = {name: translate('feature.style.change')};
                    items['zoom'] = {name: translate('feature.zoomTo')};
                    if (schema.allowDelete) {
                        items['removeFeature'] = {name: translate('feature.remove.title')};
                    }

                    if (schema.allowEditData) {
                        items['edit'] = {name: translate('feature.edit')};
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

                                case 'changeStyle':
                                    widget.openChangeStyleDialog(olFeature);
                                    break;
                            }
                        },
                        items: items
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
                    sSearch: translate("search.title") + ':',
                    sEmptyTable: translate("search.table.empty"),
                    sZeroRecords: translate("search.table.zerorecords"),
                    sInfo: translate("search.table.info.status"),
                    sInfoEmpty: translate("search.table.info.empty"),
                    sInfoFiltered: translate("search.table.info.filtered")
                };
                //translateObject(options.tableTranslation);
            }
        },

        _buildSelectOptionsForAllSchemes: function() {
            var widget = this;
            var map = widget.map;
            var options = widget.options;
            var element = $(widget.element);
            var selector = widget.selector;


            // build select options
            $.each(options.schemes, function (schemaName) {
                var schema = this;
                var option = $("<option/>");
                var layer = schema.layer = widget.createSchemaFeatureLayer(schema);
                var buttons = [];
                //schema.clusterStrategy = layer.strategies[0];

                // Merge settings with default values from options
                _.defaults(schema, _.omit(options, ['schemes', 'target', 'create', 'jsSrc', 'disabled']));

                if (schema.allowLocate) {
                    buttons.push({
                        title: 'Hineinzoomen',
                        className: 'fa fa-crosshairs',
                        onClick: function (olFeature, ui) {
                            widget.zoomToJsonFeature(olFeature);
                        }
                    });
                }

                if (schema.allowSave || true) {
                    buttons.push({
                        title: translate('feature.savesave'),
                        className: 'save',
                        onClick: function (olFeature, ui) {
                            widget.saveFeature(olFeature);
                        }
                    });
                }

                if (schema.allowEditData) {
                    buttons.push({
                        title: translate('feature.edit'),
                        className: 'edit',
                        onClick: function (olFeature, ui) {
                            widget._openFeatureEditDialog(olFeature);
                        }
                    });
                }
                if (schema.copy.enable) {
                    buttons.push({
                        title: translate('feature.clone.title'),
                        className: 'clone',
                        cssClass: ' fa fa-files-o',
                        onClick: function (olFeature, ui) {
                            widget.copyFeature(olFeature);
                        }
                    });
                }
                if (schema.allowCustomerStyle) {
                    buttons.push({
                        title: translate('feature.style.change'),
                        className: 'style',
                        onClick: function (olFeature, ui) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    });
                }

                if (schema.allowChangeVisibility) {
                    buttons.push({
                        title: 'Objekt anzeigen/ausblenden', //translate('feature.visibility.change'),
                        className: 'visibility',
                        onClick: function (olFeature, ui, b, c) {
                            var layer = olFeature.layer;
                            if (!olFeature.renderIntent || olFeature.renderIntent != 'invisible') {
                                layer.drawFeature(olFeature, 'invisible');
                                ui.addClass("icon-invisibility");
                                ui.closest('tr').addClass('invisible-feature');
                            } else {
                                if (olFeature.styleId) {
                                    layer.drawFeature(olFeature, olFeature.styleId);
                                } else {
                                    layer.drawFeature(olFeature, 'default');
                                }
                                ui.removeClass("icon-invisibility");
                                ui.closest('tr').removeClass('invisible-feature');
                            }
                        }
                    });
                }

                if (schema.allowPrintMetadata) {
                    buttons.push({
                        title: 'Sachdaten drucken',
                        className: 'printmetadata-inactive',
                        onClick: function (olFeature, ui, b, c) {
                            if (!olFeature.printMetadata || olFeature.printMetadata == false) {
                                olFeature.printMetadata = true;
                                ui.addClass("icon-printmetadata-active");
                                ui.removeClass("icon-printmetadata-inactive");
                            } else {
                                olFeature.printMetadata = false;
                                ui.removeClass("icon-printmetadata-active");
                                ui.addClass("icon-printmetadata-inactive");
                            }
                        }
                    });
                }

                if (schema.allowDelete) {
                    buttons.push({
                        title: translate("feature.remove.title"),
                        className: 'remove',
                        cssClass: 'critical',
                        onClick: function (olFeature, ui) {
                            widget.removeFeature(olFeature);
                        }
                    });
                }
                // if(true) {
                //     buttons.push({
                //         title:     translate("feature.remove.title"),
                //         className: 'remove',
                //         cssClass:  'critical',
                //         onClick:   function(olFeature, ui) {
                //             widget.removeFeature(olFeature);
                //         }
                //     });
                // }

                option.val(schemaName).html(schema.label);
                map.addLayer(layer);

                var frame = schema.frame = $("<div/>").addClass('frame').data("schemaSettings", schema);
                var columns = [];
                var newFeatureDefaultProperties = {};

                if (!schema.hasOwnProperty("tableFields")) {

                    schema.tableFields = {
                        id: {
                            label: '',
                            data: function (row, type, val, meta) {
                                var table = $('<table/>');
                                _.each(row.data, function (value, key) {
                                    var tableRow = $('<tr/>');
                                    var keyCell = $('<td style="font-weight: bold; padding-right: 5px"/>');
                                    var valueCell = $('<td/>');

                                    keyCell.text(key + ':');
                                    valueCell.text(value);
                                    tableRow.append(keyCell).append(valueCell);
                                    table.append(tableRow);

                                });
                                return table.prop('outerHTML');
                            }
                        }
                    };

                }

                $.each(schema.tableFields, function (fieldName, fieldSettings) {
                    newFeatureDefaultProperties[fieldName] = "";
                    fieldSettings.title = fieldSettings.label;
                    if (!fieldSettings.data) {
                        fieldSettings.data = function (row, type, val, meta) {
                            var data = row.data[fieldName];
                            if (typeof (data) == 'string') {
                                data = escapeHtml(data);
                            }
                            return data;
                        };
                    }

                    if (fieldSettings.render) {
                        eval('fieldSettings.render = ' + fieldSettings.render);
                    }
                    columns.push(fieldSettings);
                });

                var resultTableSettings = {
                    lengthChange: false,
                    pageLength: schema.pageLength,
                    searching: schema.inlineSearch,
                    info: true,
                    processing: false,
                    ordering: true,
                    paging: true,
                    selectable: false,
                    autoWidth: false,
                    columns: columns,
                    buttons: buttons

                };

                if (_.size(buttons)) {
                    resultTableSettings.buttons = buttons;
                }

                if (options.tableTranslation) {
                    resultTableSettings.oLanguage = options.tableTranslation;
                }

                if (schema.view && schema.view.settings) {
                    _.extend(resultTableSettings, schema.view.settings);
                }

                var table = schema.table = $("<div/>").resultTable(resultTableSettings);
                var searchableColumnTitles = _.pluck(_.reject(resultTableSettings.columns, function (column) {
                    if (!column.sTitle) {
                        return true;
                    }

                    if (column.hasOwnProperty('searchable') && column.searchable == false) {
                        return true;
                    }
                }), 'sTitle');

                table.find(".dataTables_filter input[type='search']").attr('placeholder', searchableColumnTitles.join(', '));

                schema.schemaName = schemaName;

                var toolset = widget.toolsets[schema.featureType.geomType];
                if (schema.hasOwnProperty("toolset")) {
                    toolset = schema.toolset;
                }
                // remove removeSelected Control if !allowDelete
                if (!schema.allowDelete) {
                    $.each(toolset, function (k, tool) {
                        if (tool.type == "removeSelected") {
                            toolset.splice(k, 1);
                        }
                    });
                }



                frame.append($('<div/>').digitizingToolSet({
                    children: toolset,
                    layer: layer,
                    translations: widget._createToolsetTranslations(schema),

                    // http://dev.openlayers.org/docs/files/OpenLayers/Control-js.html#OpenLayers.Control.events
                    controlEvents: {

                        /**
                         * This function allows the easy use of the olEvent onStart( called on drag start) with the yml configurration
                         * e.G. to prevent the move or add additional data on move
                         * */
                        onStart: function (feature, px) {

                            var control = this;
                            var schema = feature.schema;
                            var attributes = feature.attributes;
                            var preventDefault = false;
                            feature.oldGeom = {x:feature.geometry.x,y:feature.geometry.y};
                            if (!schema.hooks || !schema.hooks.onStart) {
                                return;
                            }

                            try {
                                preventDefault = eval(schema.hooks.onStart);
                            } catch (e) {

                                $.notify(e);
                                return;
                            }


                            if (preventDefault) {
                                $.notify(translate('move.denied'));
                                control.cancel();

                            }
                        },

                        /**
                         * This function allows the easy use of the olEvent onModificationStart with the yml configurration
                         * e.G. to prevent the modification or add additional data on modification
                         * */
                        onModificationStart: function event(feature) {

                            var control = this;
                            var schema = feature.schema;
                            var attributes = feature.attributes;
                            var preventDefault = false;

                            if (!schema.hooks || !schema.hooks.onModificationStart) {
                                return;
                            }

                            try {
                                preventDefault = eval(schema.hooks.onModificationStart);
                            } catch (e) {

                                $.notify(e);
                                return;
                            }

                            if (preventDefault) {
                                control.deactivate();
                                control.activate();

                                $.notify(translate('move.denied'));

                            }

                        },

                        featureadded: function (event) {
                            var olFeature = event.feature;
                            var layer = event.object.layer;
                            var schema = widget.findSchemaByLayer(layer);
                            var digitizerToolSetElement = $(".digitizing-tool-set", frame);
                            var properties = $.extend({}, newFeatureDefaultProperties); // clone from newFeatureDefaultProperties
                            //
                            //if(schema.isClustered){
                            //    $.notify('Create new feature is by clusterring not posible');
                            //    return false;
                            //}

                            olFeature.isNew = true;
                            olFeature.attributes = olFeature.data = properties;
                            olFeature.layer = layer;
                            olFeature.schema = schema;

                            //widget.reloadFeatures(layer);
                            layer.redraw();

                            digitizerToolSetElement.digitizingToolSet("deactivateCurrentController");

                            widget.unsavedFeatures[olFeature.id] = olFeature;

                            if (schema.openFormAfterEdit) {
                                widget._openFeatureEditDialog(olFeature);
                            }

                            //return true;
                        },

                        onModification: function (event) {
                            var feature = findFeatureByPropertyValue(event.layer, 'id', event.id);
                            widget.unsavedFeatures[event.id] = feature;
                        }, // http://dev.openlayers.org/docs/files/OpenLayers/Control/DragFeature-js.html

                        onComplete: function (event) {
                            var feature = findFeatureByPropertyValue(event.layer, 'id', event.id);
                            widget.unsavedFeatures[event.id] = feature;
                            if(!widget.currentPopup || !widget.currentPopup.data('visUiJsPopupDialog')._isOpen){

                                if(schema.popup.remoteData){
                                    var bbox = feature.geometry.getBounds();
                                    bbox.right = parseFloat(bbox.right+0.00001);
                                    bbox.top = parseFloat(bbox.top+0.00001);
                                    bbox= bbox.toBBOX();
                                    var srid = map.getProjection().replace('EPSG:','');
                                    var url = widget.elementUrl + "getFeatureInfo/";

                                    $.ajax({url: url, data: {
                                            bbox :bbox,
                                            schema: schema.schemaName,
                                            srid: srid
                                        }}).done(function (response) {
                                        _.each(response.dataSets, function (dataSet) {
                                            var newData = JSON.parse(dataSet).features[0].properties;


                                            Object.keys(feature.data)
                                            $.extend(feature.data, newData);


                                        });
                                        widget._openFeatureEditDialog(feature);

                                    }).fail(function(){
                                        $.notfiy("No remote data could be fetched");
                                        widget._openFeatureEditDialog(feature);
                                    });

                                } else {
                                    widget._openFeatureEditDialog(feature);
                                }
                            }
                        }
                    }
                }));

                frame.generateElements({
                    children: [{
                        type: 'checkbox',
                        cssClass: 'onlyExtent',
                        title: translate('toolset.current-extent'),
                        checked: schema.searchType === "currentExtent",
                        change: function (e) {
                            schema.searchType = $(e.originalEvent.target).prop("checked") ? "currentExtent" : "all";
                            widget._getData();
                        }
                    }]
                });

                var toolSetView = $(".digitizing-tool-set", frame);

                widget._generateSearchForm(schema,frame);

                if (!schema.allowDigitize) {

                    toolSetView.css('display', 'none');
                    toolSetView = $("<div class='digitizing-tool-sets'/>");
                    toolSetView.insertBefore(frame.find('.onlyExtent'));

                }

                if (schema.showVisibilityNavigation) {
                    toolSetView.generateElements({
                        type: 'fieldSet',
                        cssClass: 'right',
                        children: [{
                            type: 'button',
                            cssClass: 'fa fa-eye-slash',
                            title: 'Alle ausblenden',
                            click: function (e) {
                                var tableApi = table.resultTable('getApi');
                                tableApi.rows(function (idx, feature, row) {
                                    var $row = $(row);
                                    var visibilityButton = $row.find('.button.icon-visibility');
                                    visibilityButton.addClass('icon-invisibility');
                                    $row.addClass('invisible-feature');
                                    feature.layer.drawFeature(feature, 'invisible');
                                });
                            }
                        }, {
                            type: 'button',
                            title: 'Alle einblenden',
                            cssClass: 'fa fa-eye',
                            click: function (e) {
                                var tableApi = table.resultTable('getApi');
                                tableApi.rows(function (idx, feature, row) {
                                    var $row = $(row);
                                    var visibilityButton = $row.find('.button.icon-visibility');
                                    visibilityButton.removeClass('icon-invisibility');
                                    $row.removeClass('invisible-feature');
                                    var styleId = feature.styleId ? feature.styleId : 'default';
                                    feature.layer.drawFeature(feature, styleId);
                                });
                            }
                        }]
                    });
                }

                frame.append('<div style="clear:both;"/>');

                frame.append(table);

                //frames.push(schema); // TODO not necessary
                frame.css('display', 'none');

                frame.data("schemaSettings", schema);

                element.append(frame);
                option.data("schemaSettings", schema);
                selector.append(option);

                widget._addSelectControl(layer,schema);
            });
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


            /**
             * Set map context menu
             */
            widget._createMapContextMenu();

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
                    widget.deactivateFrame(widget.currentSettings);
                }

                widget.activateFrame(schema);

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

                widget._getData();
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
                    digitizerToolSetElement.digitizingToolSet("deactivateCurrentController");
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
         * @param {OpenLayers.Feature} feature
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
                $.notify(translate('feature.clone.on.error'));
                return;
            }

            var newAttributes = {};
            _.extend(newAttributes, defaultAttributes);
            _.each(feature.attributes, function (v, k) {
                if (v === '' || v === null) {
                    return;
                }
                newAttributes[k] = v;
            });

            newFeature.data = newFeature.properties = newFeature.attributes = newAttributes;
            newFeature.schema = schema;
            delete newFeature.fid;

            return widget.saveFeature(newFeature).done(function (response) {
                if (response.errors) {
                    Mapbender.error(translate("feature.copy.error"));
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
         * @param {OpenLayers.Feature} feature OpenLayers feature
         * @private
         * @return {jQuery.jqXHR} ajax XHR
         */
        saveFeature: function (feature) {
            if (feature.disabled) {
                return;
            }

            var widget = this;
            var schema = feature.schema;
            var dialog = feature.editDialog;
            var table = schema.table;
            var tableWidget = table.data('visUiJsResultTable');
            var tableApi = table.resultTable('getApi');
            var formData = dialog && dialog.formData() || initialFormData(feature);
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

                    $.notify(translate("feature.save.successfully"), 'info');

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
            }
        },

        /**
         *
         * @param olFeature
         * @private
         */

        _createPopupConfiguration : function(olFeature) {

            var widget = this;
            var buttons = [];
            var schema = olFeature.schema;

            if (schema.printable) {
                var printButton = {
                    text: translate('feature.print'),
                    click: function () {
                        var printWidget = $('.mb-element-printclient').data('mapbenderMbPrintClient');
                        if (printWidget) {
                            var dialog = $(this).closest('.ui-dialog-content');
                            var feature = dialog.data('feature');
                            printWidget.printDigitizerFeature(feature.schema.featureTypeName || feature.schema.schemaName, feature.fid);
                        } else {
                            $.notify('Druck Element ist nicht verfügbar!');
                        }
                    }
                };
                buttons.push(printButton);
            }
            if (schema.copy.enable) {
                buttons.push({
                    text: translate('feature.clone.title'),
                    click: function (e) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        widget.copyFeature(olFeature); // TODO possibly a bug?
                    }
                });
            }
            if (schema.allowCustomerStyle) {
                var styleButton = {
                    text: translate('feature.style.change'),
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
                    text: translate('feature.save.title'),
                    click: function () {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        widget.saveFeature(feature);
                    }
                };
                buttons.push(saveButton);
            }
            if (schema.allowDelete) {
                buttons.push({
                    text: translate('feature.remove.title'),
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
                    text: translate('cancel'),
                    click: function () {
                        this.currentPopup.popupDialog('close');
                    }.bind(this)
                });
            }
            var popupConfiguration = {
                title: translate('feature.attributes'),
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
         * @private
         */

        _processCurrentFormItemsWithDataManager : function(olFeature) {
            var widget = this;

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

            DataUtil.eachItem(widget.currentSettings.formItems, function (item) {

                if (item.type === "resultTable" && item.editable && !item.isProcessed) {
                    var onCreateClick;
                    var onEditClick;

                    if (!item.hasOwnProperty('dataManagerLink')) {
                        onCreateClick = function (e) {
                            e.preventDefault();
                            var item = $(this).next().data("item");
                            var popup = item.popupItems;
                            var table = $(this).siblings(".mapbender-element-result-table")
                            var uniqueIdKey = item.dataStore.uniqueId;

                            var feature = table.data('olFeature');
                            var data = {};

                            item.allowRemove = false;
                            data['linkId'] = feature.attributes[item.dataStoreLink.uniqueId];
                            data.item = item;
                            data[uniqueIdKey] = null;
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
                            rowData.externalId = feature.attributes[item.dataStoreLink.uniqueId];

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
                        cssClass: "fa fa-plus",
                        click: onCreateClick
                    };

                    item.children = [button, cloneItem];

                    var buttons = [];

                    buttons.push({
                        title: translate('feature.edit'),
                        className: 'edit',
                        onClick: onEditClick
                    });

                    cloneItem.buttons = buttons;

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
                            title: translate('feature.edit'),
                            cssClass: 'edit',
                            click: onEditClick
                        },
                        {
                            type: "button",
                            title: "",
                            cssClass: "fa fa-plus",
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
         * @param olFeature open layer feature
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

            var popupConfiguration = this._createPopupConfiguration(olFeature);

            this._processCurrentFormItemsWithDataManager(olFeature);

            var dialog = $("<div/>");
            olFeature.editDialog = dialog;

            if (!schema.elementsTranslated) {
                translateStructure(widget.currentSettings.formItems);
                schema.elementsTranslated = true;
            }



            dialog.data('feature', olFeature);
            dialog.data('digitizerWidget', widget);

            var formItems = widget.currentSettings.formItems;

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

            dialog.generateElements({children: formItems});
            dialog.popupDialog(popupConfiguration);
            schema.editDialog = dialog;
            widget.currentPopup = dialog;
            dialog.bind('edit-cancel', this.editCancel.bind(this));
            dialog.bind('popupdialogclose', function (event) {
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

            setTimeout(function () {

                if (popupConfiguration.remoteData && olFeature.isNew) {


                    var bbox = dialog.data("feature").geometry.getBounds();
                    bbox.right = parseFloat(bbox.right+0.00001);
                    bbox.top = parseFloat(bbox.top+0.00001);
                    bbox= bbox.toBBOX();
                    var srid = map.getProjection().replace('EPSG:','');
                    var url = widget.elementUrl + "getFeatureInfo/";

                    $.ajax({url: url, data: {
                            bbox :bbox,
                            schema: schema.schemaName,
                            srid: srid
                        }}).success(function (response) {
                        _.each(response.dataSets, function (dataSet) {
                            var newData = JSON.parse(dataSet).features[0].properties
                            $.extend(olFeature.data, newData);


                        });
                        dialog.formData(olFeature.data);

                    });


                } else {
                    dialog.formData(olFeature.data);
                }


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

        _initialFormData: function (feature) {
            return initialFormData(feature);
        },


        /**
         * Highlight schema feature on the map and table view
         *
         * @param {object} schema
         * @param {OpenLayers.Feature} feature
         * @param {boolean} highlight
         * @private
         */
        _highlightSchemaFeature: function (schema, feature, highlight) {
            var widget = this;
            var table = schema.table;
            var tableWidget = table.data('visUiJsResultTable');
            var isSketchFeature = !feature.cluster && feature._sketch && _.size(feature.data) == 0;
            var features = feature.cluster ? feature.cluster : [feature];
            var layer = feature.layer;
            var domRow;

            if (feature.renderIntent && feature.renderIntent == 'invisible') {
                return;
            }

            if (isSketchFeature) {
                return;
            }

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

            for (var k in features) {
                var feature = features[k];
                domRow = tableWidget.getDomRowByData(feature);
                if (domRow && domRow.size()) {
                    tableWidget.showByRow(domRow);

                    if (highlight) {
                        domRow.addClass('hover');
                    } else {
                        domRow.removeClass('hover');
                    }
                    // $('.selection input', domRow).prop("checked", feature.selected);

                    break;
                }
            }
        },


        /**
         * Highlight feature on the map
         *
         * @param {OpenLayers.Feature} feature
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
         * @param {OpenLayers.Feature} feature
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
         * @param {OpenLayers.Feature} feature
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
         * @param olFeature
         * @returns {*}
         */
        findFeatureSchema: function (olFeature) {
            var widget = this;
            var options = widget.options;
            return _.find(options.schemes, {layer: olFeature.layer});
        },

        /**
         * Create vector feature layer
         *
         * @param schema
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
            return layer;
        },

        /**
         * Remove OL feature
         *
         * @version 0.2
         * @returns {*}
         * @param  {OpenLayers.Feature} olFeature
         */
        removeFeature: function (olFeature) {
            var widget = this;
            var schema = widget.findFeatureSchema(olFeature);
            var isNew = olFeature.hasOwnProperty('isNew');
            var layer = olFeature.layer;
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
                    html: translate("feature.remove.from.database"),
                    onSuccess: function () {
                        widget.query('delete', {
                            schema: schema.schemaName,
                            feature: featureData
                        }).done(function (fid) {
                            _removeFeatureFromUI();
                            $.notify(translate('feature.remove.successfully'), 'info');
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
         * @param featureCollection FeatureCollection
         * @param schema
         * @param xhr ajax request object
         * @private
         * @version 0.2
         */
        _onFeatureCollectionLoaded: function (featureCollection, schema, xhr) {

            if (!featureCollection || !featureCollection.hasOwnProperty("features")) {
                Mapbender.error(translate("features.loading.error"), featureCollection, xhr);
                return;
            }

            if (featureCollection.features && featureCollection.features.length == schema.maxResults) {
                Mapbender.info("It is requested more than the maximal available number of results.\n ( > " + schema.maxResults + " results. )");
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
         * @param layer
         * @version 0.2
         */
        reloadFeatures: function (layer, _features) {
            var widget = this;
            var schema = widget.findSchemaByLayer(layer);
            var tableApi = schema.table.resultTable('getApi');
            var features = _features ? _features : layer.features;

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
                widget.deactivate();
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

        _openEditDialog: function (dataItem, formItems, schema, ref) {
            var widget = this;

            var schemaName = this.schemaName;
            var widget = this;
            var uniqueKey = schema.dataStore.uniqueId;
            var textKey = schema.dataStore.text;
            var buttons = [];

            if (widget.currentPopup.currentPopup) {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
            }

            var saveButton = {
                text: translate("feature.save", false),
                click: function () {
                    widget.saveForeignDataStoreItem(dataItem);
                }
            };
            buttons.push(saveButton);

            buttons.push({

                text: translate("feature.remove.title", false),
                class: 'critical',
                click: function () {

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
                        $.notify(translate("feature.remove.successfully", false), 'info');

                    })
                }
            });

            buttons.push({
                text: translate("cancel"),
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
                                if (fileInfo.field && fileInfo.field == item.name) {

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

                title: translate("feature.attributes"),

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

        saveForeignDataStoreItem: function (dataItem) {

            var widget = this;
            var dialog = widget.currentPopup.currentPopup;
            var uniqueIdKey = dataItem.item.dataStore.uniqueId;
            var isNew = dataItem[uniqueIdKey] === null;
            var formData = dialog.formData();
            var schema = dialog.data('schema');
            debugger;
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

            widget.query('datastore/save', {
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
                $.notify(translate("feature.save.successfully", false), 'info');
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
                var errorMessage = translate('api.query.error-message');
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
                widget.activateFrame(widget.currentSettings);

            })

        },

        deactivate: function () {
            var widget = this;
            // clear unsaved features to prevent multiple confirmation popups
            var unsavedFeatures = widget.unsavedFeatures;
            widget.unsavedFeatures = {};
            var always = function () {
                widget.options.__disabled = true;
                if (!widget.currentSettings.displayOnInactive) {
                    widget.deactivateFrame(widget.currentSettings);
                }
            };
            always()
            /*if (widget.options.confirmSaveOnDeactivate) {
                widget._confirmSave(unsavedFeatures, always);
            } else {
                always();
            } */
        },
        _confirmSave: function (unsavedFeatures, callback) {
            var widget = this;
            var numUnsaved = _.size(unsavedFeatures);
            if (numUnsaved) {
                var html = "<p>Sie haben " + ((numUnsaved > 1) ? "" + numUnsaved + " &Auml;nderungen" : "eine &Auml;nderung") + " vorgenommen und noch nicht gespeichert.</p>" + "<p>Wollen sie diese jetzt speichern oder verwerfen?</p>";

                var confirmOptions = {
                    okText: "Jetzt Speichern",
                    cancelText: "Verwerfen",
                    html: html,
                    title: "Ungespeicherte Änderungen",
                    onSuccess: function () {
                        _.forEach(unsavedFeatures, function (feature) {
                            widget.saveFeature(feature);
                        });
                        callback();
                    },
                    onCancel: function () {
                        var layersToReset = {};
                        _.forEach(unsavedFeatures, function (feature) {
                            if (feature.isNew) {
                                widget.removeFeature(feature);
                            } else if (feature.layer) {
                                layersToReset[feature.layer.id] = feature.layer;
                            }
                        });
                        if (_.size(layersToReset)) {
                            _.forEach(layersToReset, function (layer) {
                                // _getData will skip existing features, so we need
                                // to clean up first before ...
                                layer.removeAllFeatures();
                            });
                            // ... we reload (from server) and reinitialize all features
                            widget._getData();
                        }
                        callback();
                    }
                };
                Mapbender.confirmDialog(confirmOptions);
            } else {
                callback();
            }
        },

        activateFrame: function (schema) {
            var widget = this;
            var frame = schema.frame;
            var layer = schema.layer;

            if (widget.options.__disabled) {
                return;
            }

            widget.activeLayer = schema.layer;
            widget.schemaName = schema.schemaName;
            widget.currentSettings = schema;

            widget.query('style/list', {schema: schema.schemaName}).done(function (r) {
                schema.featureStyles = r.featureStyles;
                widget.reloadFeatures(layer);
                layer.setVisibility(true);
                frame.css('display', 'block');
                schema.selectControl.activate();
            });

        },

        deactivateFrame: function (schema) {
            var widget = this;
            var frame = schema.frame;
            //var tableApi = schema.table.resultTable('getApi');
            var layer = schema.layer;

            frame.css('display', 'none');

            if (!schema.displayPermanent) {
                layer.setVisibility(false);
            }

            schema.selectControl.deactivate();

            // https://trac.wheregroup.com/cp/issues/4548
            if (widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

        },

        editCancel : function(event, eventData) {
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


                feature.layer.redraw();
                feature.layer.setVisibility(false)

                feature.layer.setVisibility(true)

            }

        },

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
         * @param {OpenLayers.Feature} feature OpenLayers
         * @param {String} attributeName
         */
        download: function (feature, attributeName) {
            var widget = this;
            var schema = feature.schema;
            var attributes = feature.attributes;
            var tableName = schema.featureType.table;
            var relativeWebPath = Mapbender.configuration.application.urls.asset;
            window.open(relativeWebPath + widget.options.fileUri + '/' + tableName + '/' + attributeName + '/' + attributes[attributeName]);

        }
    });

})(jQuery);
