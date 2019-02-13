var Scheme = function (rawScheme, widget) {
    /** @type {Scheme} */
    var schema = this;

    schema = $.extend(schema, rawScheme);

    if (schema.popup) {
        schema.popup.buttons = schema.popup.buttons || [];
        schema.createPopupConfiguration();
    }

    schema._initializeHooks();

    schema.triggerModifiedState = Scheme.prototype.triggerModifiedState.bind(this); // In order to achive arrow-function like "this" behaviour

    schema.widget = widget;

    schema.toolset = widget.toolsets[schema.featureType.geomType];

    schema.createSchemaFeatureLayer();

    schema._createFrame();

    schema._addSelectControl();

    schema.initializeResultTableEvents();


    // remove removeSelected Control if !allowDelete
    if (!schema.allowDelete) {
        $.each(schema.toolset, function (k, tool) {
            if (tool.type === "removeSelected") {
                schema.toolset.splice(k, 1);
            }
        });
    }

    // TODO this has to be carefully checked for prototype propertys, since it fills the `undefined` properties, so it may not work at all
    _.defaults(schema, schema.widget._getNonBlackListedOptions());


};


Scheme.prototype = {


    schemaName: '',
    featureTypeName: '',
    table: null,
    label: '',
    layer: null,
    widget: null,
    frame: null,
    maxResults: 500,
    displayPermanent: false,
    dataStore: null,
    dataStoreLink: {},
    showExtendSearchSwitch: false,
    featureType: {
        geomType: null,
        table: null,
        files: null
    },
    zoomScaleDenominator: 500,
    useContextMenu: true,
    toolset: {},
    popup: {},
    tableFields: {},
    style: {},
    formItems: [],
    events: null,
    selectControl: null,
    featureStyles: null,
    search: null,
    eventListeners: null,

    allowDigitize: true,
    allowDelete: true,
    allowSave: true,
    allowEditData: true,
    allowCustomerStyle: true,
    allowChangeVisibility: true,
    allowDeleteByCancelNewGeometry: false,
    allowCancelButton: true,
    allowLocate: true,
    showVisibilityNavigation: true,
    allowPrintMetadata: false,
    printable: false,
    dataItems: null,
    isClustered: false,
    clusterStrategy: null,
    styles: {},
    maxScale: null,
    minScale: null,
    group: null,
    displayOnInactive: false,
    refreshFeaturesAfterSave: [],
    elementsTranslated: false,
    olFeatureCloudPopup: null,

    editDialog: null,
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
    hooks: {
        onModificationStart: null,
        onStart: null,
    },
    evaluatedHooks: {},

    lastRequest: null,
    xhr: null,
    view: null,

    // Layer list names/ids to be refreshed after feature save complete
    refreshLayersAfterFeatureSave: [],

    clustering: [{
        scale: 5000000,
        distance: 30
    }],
    digitizingToolset: null,

    _initializeHooks: function () {
        var schema = this;
        _.each(schema.hooks, function (value, name) {
            if (!value) {
                return false;
            }

            try {
                schema.evaluatedHooks[name] = eval(value);
            } catch (e) {
                $.notify(e);
            }
        });
    },


    _refreshMapAfterFeatureSave: function() {
        var schema = this;
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
    },


    _getTableTranslations: function () {
        var schema = this;
        var tableTranslation = schema.tableTranslation;

        if (tableTranslation) {
            tableTranslation = Mapbender.DigitizerTranslator.translateObject(tableTranslation);
        } else {
            tableTranslation = {
                sSearch: Mapbender.DigitizerTranslator.translate("search.title") + ':',
                sEmptyTable: Mapbender.DigitizerTranslator.translate("search.table.empty"),
                sZeroRecords: Mapbender.DigitizerTranslator.translate("search.table.zerorecords"),
                sInfo: Mapbender.DigitizerTranslator.translate("search.table.info.status"),
                sInfoEmpty: Mapbender.DigitizerTranslator.translate("search.table.info.empty"),
                sInfoFiltered: Mapbender.DigitizerTranslator.translate("search.table.info.filtered")
            };
        }

        return tableTranslation;
    },

    getTableWidget: function () {
        var schema = this;
        var table = schema.table;
        return table.data('visUiJsResultTable');
    },




    /**
     * Open edit feature dialog
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
     * @private
     */
    _openFeatureEditDialog: function (olFeature) {

        var schema = this;
        var widget = schema.widget;
        var layer = olFeature.layer;
        var map = layer.map;
        var popupConfiguration = schema.popup;

        var isOpenLayerCloudPopup = popupConfiguration.type && popupConfiguration.type === 'openlayers-cloud';

        if (widget.currentPopup) {
            widget.currentPopup.popupDialog('close');
            if (isOpenLayerCloudPopup && schema.olFeatureCloudPopup) {
                map.removePopup(schema.olFeatureCloudPopup);
                schema.olFeatureCloudPopup.destroy();
                schema.olFeatureCloudPopup = null;
            }
        }


        (new DataManagerUtils(widget)).processCurrentFormItemsWithDataManager(olFeature);

        var dialog = $("<div/>");

        if (!schema.elementsTranslated) {
            Mapbender.DigitizerTranslator.translateStructure(schema.formItems);
            schema.elementsTranslated = true;
        }

        schema.editDialog = dialog;
        widget.currentPopup = dialog;


        dialog.data('feature', olFeature);
        //dialog.data('digitizerWidget', widget); // TODO uncommented because purpose unknown

        dialog.generateElementsWithFormItems = function () {
            var formItems = schema.formItems;

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
        }();

        dialog.popupDialog(popupConfiguration);

        dialog.bind('edit-cancel', schema.editCancel.bind(schema));

        dialog.bind('popupdialogclose', function (event) {
            dialog.trigger('edit-cancel', {
                'origin': 'close-button',
                'feature': dialog.data('feature')
            });
        });


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

                QueryEngine.query('dataStore/get', requestData).done(function (data) {
                    if (Object.prototype.toString.call(data) === '[object Array]') {

                        var dataItems = [];
                        _.each(data, function (el, i) {
                            el.attributes.item = item;
                            dataItems.push(el.attributes)

                        });

                    } else {
                        data.item = item;
                        //data = [data];
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
                bbox.right = parseFloat(bbox.right + 0.00001);
                bbox.top = parseFloat(bbox.top + 0.00001);
                bbox = bbox.toBBOX();
                var srid = map.getProjection().replace('EPSG:', '');
                var url = widget.elementUrl + "getFeatureInfo/";

                $.ajax({
                    url: url, data: {
                        bbox: bbox,
                        schema: schema.schemaName,
                        srid: srid
                    }
                }).success(function (response) {
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
     *
     * @param event
     * @param eventData
     */

    editCancel: function (event, eventData) {
        var schema = this;
        var widget = schema.widget;
        var feature = eventData.feature;

        if (feature.hasOwnProperty('isNew') && schema.allowDeleteByCancelNewGeometry) {
            schema.removeFeature(feature);
        }
        if (eventData.origin === 'cancel-button') {
            widget.currentPopup.popupDialog('close');
        }
    },

    hoverInResultTable: function (feature, highlight) {

        var features = feature.cluster || [feature];
        var tableWidget = this.getTableWidget();
        var domRow;

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
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     * @param {boolean} highlight
     * @private
     */

    _highlightSchemaFeature: function (feature, highlight) {


        var isSketchFeature = !feature.cluster && feature._sketch && _.size(feature.data) === 0;


        if (feature.renderIntent && feature.renderIntent === 'invisible') {
            return;
        }

        if (isSketchFeature) {
            return;
        }

        feature.redraw(highlight);
        this.hoverInResultTable(feature, highlight);


    },


    _augmentPopupConfigurationButtons: function () {
        var schema = this;
        var widget = schema.widget;
        var popupConfiguration = schema.popup;

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
    },
    /**
     * @private
     */


    createPopupConfiguration: function () {

        var schema = this;
        var popupConfiguration = schema.popup;

        var buttons = popupConfiguration.buttons;

        this._augmentPopupConfigurationButtons();

        if (schema.printable) {
            var printButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.print'),
                click: function () {
                    var printWidget = $('.mb-element-printclient').data('mapbenderMbPrintClient');
                    if (printWidget) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        printWidget.printDigitizerFeature(schema.featureTypeName || schema.schemaName, feature.fid);
                    } else {
                        $.notify('Druck Element ist nicht verfügbar!');
                    }
                }
            };
            buttons.push(printButton);
        }
        if (schema.copy.enable) {
            buttons.push({
                text: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                click: function (e) {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.copyFeature(olFeature); // TODO possibly a bug?
                }
            });
        }
        if (schema.allowCustomerStyle) {
            var styleButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                click: function (e) {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.openChangeStyleDialog(feature);
                }
            };
            buttons.push(styleButton);
        }
        if (schema.allowEditData && schema.allowSave) {
            var saveButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.save.title'),
                click: function () {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.saveFeature(feature);
                }
            };
            buttons.push(saveButton);
        }
        if (schema.allowDelete) {
            buttons.push({
                text: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                'class': 'critical',
                click: function () {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.removeFeature(feature);
                    schema.widget.currentPopup.popupDialog('close');
                }
            });
        }
        if (schema.allowCancelButton) {
            buttons.push({
                text: Mapbender.DigitizerTranslator.translate('cancel'),
                click: function () {
                    schema.widget.currentPopup.popupDialog('close');
                }.bind(this)
            });
        }

    },





    _mapHasActiveControlThatBlocksSelectControl: function () {
        var schema = this;
        var widget = schema.widget;
        var map = widget.map;

        return !!_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true});
    },

    _getSelectionManager: function () {
        var schema = this;
        return schema.table.resultTable("getSelection");
    },

    /**
     *
     * @private
     */

    _addSelectControl: function () {
        /** @type {Scheme} */
        var schema = this;
        var layer = schema.layer;
        var widget = schema.widget;

        var selectControl = new OpenLayers.Control.SelectFeature(layer, {
            hover: true,

            clickFeature: function (feature) {
                var features = feature.cluster || [feature];


                if (schema._mapHasActiveControlThatBlocksSelectControl()) {
                    return;
                }

                feature.selected = !feature.selected;

                var selectionManager = schema._getSelectionManager();

                if (feature.selected) {
                    selectionManager.add(feature);
                } else {
                    selectionManager.remove(feature);
                }

                schema._highlightSchemaFeature(feature, true);

                if (schema.allowEditData) {
                    schema._openFeatureEditDialog(features[0]);
                }
            },
            overFeature: function (feature) {
                schema._highlightSchemaFeature(feature, true);
            },
            outFeature: function (feature) {
                schema._highlightSchemaFeature(feature, false);
            }
        });

        // Workaround to move map by touch vector features
        selectControl.handlers && selectControl.handlers.feature && (selectControl.handlers.feature.stopDown = false);
        schema.selectControl = selectControl;
        selectControl.deactivate();
        widget.map.addControl(selectControl);
    },

    /**
     * Set feature style
     *
     * @param feature
     * @private
     */
    _setFeatureStyle: function (feature) {
        var schema = this;
        var layer = schema.layer;

        if (feature.attributes && feature.attributes.label) {
            feature.styleId = "labelText";
        }

        if (schema.featureStyles && schema.featureStyles[feature.fid]) {
            if (!feature.styleId) {
                var styleData = schema.featureStyles[feature.fid],
                    styleMap = layer.options.styleMap,
                    styles = styleMap.styles,
                    styleId = styleData.id,
                    style = new OpenLayers.Style(styleData, {uid: styleId});

                styles[styleId] = style;
                feature.styleId = styleId;
            }
        }
    },

    _redrawResultTableFeatures: function (features) {
        var schema = this;
        var tableApi = schema.table.resultTable('getApi');

        tableApi.clear();
        var featuresWithoutDrawElements = _.difference(features, _.where(features, {_sketch: true}));
        tableApi.rows.add(featuresWithoutDrawElements);
        tableApi.draw();

        tableApi.rows(function (idx, feature, row) {
            var invisible = feature.renderIntent === 'invisible';
            schema.toggleFeatureVisibility(feature,!invisible);
            return true;
        });

    },
    /**
     * Reload or replace features from the layer and feature table
     * - Fix OpenLayer bug by clustered features.
     *
     * @param _features
     * @version 0.2
     */
    reloadFeatures: function (_features) {
        var schema = this;
        var widget = schema.widget;
        var layer = schema.layer;
        var features = _features || layer.features;

        if (features.length && features[0].cluster) {
            features = _.flatten(_.pluck(layer.features, "cluster"));
        }


        layer.removeAllFeatures();
        layer.addFeatures(features);

        _.each(features, function (feature) {
            feature.layer = layer;
            schema._setFeatureStyle(feature);

        });

        layer.redraw();

        schema._redrawResultTableFeatures(features);

        if (widget.options.__disabled) {
            widget.deactivate();
        }
    },


    activateSchema: function () {

        /** @type {Scheme} */
        var schema = this;
        var widget = schema.widget;
        var frame = schema.frame;
        var layer = schema.layer;

        if (widget.options.__disabled) {
            return;
        }

        widget.activeLayer = schema.layer;
        widget.currentSchema = schema;

        QueryEngine.query('style/list', {schema: schema.schemaName}).done(function (data) {
            schema.featureStyles = data.featureStyles;
            schema.reloadFeatures();
            layer.setVisibility(true);
            frame.show();
            schema.selectControl.activate();
        });

    },

    deactivateSchema: function () {
        /** @type {Scheme} */
        var schema = this;
        var widget = schema.widget;
        var frame = schema.frame;
        var layer = schema.layer;

        frame.hide();

        if (!schema.displayPermanent) {
            layer.setVisibility(false);
        }

        schema.selectControl.deactivate();

        // https://trac.wheregroup.com/cp/issues/4548
        if (widget.currentPopup) {
            widget.currentPopup.popupDialog('close');
        }
        schema.digitizingToolset.deactivateCurrentControl();

    },

    _createFrame : function () {
        /** @type {Scheme} */
        var schema = this;
        var widget = schema.widget;
        var element = $(widget.element);

        var sidebar = new Sidebar(schema);

        schema.frame = sidebar.frame;
        element.append(sidebar.frame);

    },


    _getTableRowByFeature: function(feature) {
        var schema = this;

        var table = schema.table;
        var tableWidget = table.data('visUiJsResultTable');

        var row = tableWidget.getDomRowByData(feature);

        return row;
    },

    triggerModifiedState: function (feature, control, on) {
        var schema = this;

        var row = schema._getTableRowByFeature(feature);

        if (on) {
            row.find('.button.save').removeClass("disabled").addClass('active');
        } else {
            row.find('.button.save').removeClass("active").addClass('disabled');
        }

        if (on) {
            $(schema.frame).find(".save-all-features").addClass("active");
        }

        control && control.deactivate();

    },


    /**
     * "Fake" form data for a feature that hasn't gone through attribute
     * editing, for saving. This is used when we save a feature that has only
     * been moved / dragged. The popup dialog with the form is not initialized
     * in these cases.
     * Assigned values are copied from the feature's data, if it was already
     * stored in the db, empty otherwise.
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     * @returns {{}}
     */
    initialFormData: function (feature) {
        /** @type {Scheme} */
        var schema = this;
        var formData = {};

        var extractFormData = function (definition) {
            _.forEach(definition, function (item) {
                if (_.isArray(item)) {
                    // recurse into lists
                    extractFormData(item);
                } else if (item.name) {
                    var currentValue = (feature.data || {})[item.name];
                    // keep empty string, but replace undefined => null
                    if (typeof (currentValue) === 'undefined') {
                        currentValue = null;
                    }
                    formData[item.name] = currentValue;
                } else if (item.children) {
                    // recurse into child property (should be a list)
                    extractFormData(item.children);
                }
            });
        };

        extractFormData(schema.formItems);
        return formData;
    },


    _createFeatureLayerStyleMap: function () {
        var schema = this;
        var widget = schema.widget;
        var styles = schema.styles || {};

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

        var labels = ['default','select', 'selected', 'unsaved', 'invisible', 'labelText', 'labelTextHover', 'copy'];

        var styleMapObject = {};
        if (schema.schemaName === 'all') {

             _.each(widget.options.schemes, function (scheme, schemaName) {
                 if (schemaName === 'all'){
                     return;
                 }
                 labels.forEach(function (rawLabel) {
                     var label = rawLabel+"-"+scheme.featureType.geomType;
                     var styleOL = OpenLayers.Feature.Vector.style[rawLabel] || OpenLayers.Feature.Vector.style['default'];

                     styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, scheme.styles[rawLabel] || widget.styles[rawLabel]), styleContext);
                 });
            });

        } else {

            labels.forEach(function (label) {
                var styleOL = OpenLayers.Feature.Vector.style[label] || OpenLayers.Feature.Vector.style['default'];
                styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, styles[label] || widget.styles[label]), styleContext);
            });
        }

        var styleMap = new OpenLayers.StyleMap(styleMapObject,{extendDefault: true});

        return styleMap;

    },

    /**
     * Create vector feature layer
     *
     * @returns {OpenLayers.Layer.Vector}
     */
    createSchemaFeatureLayer: function () {

        var schema = this;
        var widget = schema.widget;
        var isClustered = schema.isClustered = schema.hasOwnProperty('clustering');
        var strategies = [];

        var styleMap = schema._createFeatureLayerStyleMap();


        if (isClustered) {
            var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
            strategies.push(clusterStrategy);
            schema.clusterStrategy = clusterStrategy;
        }

        var layer = new OpenLayers.Layer.Vector(schema.label, {
            styleMap: styleMap,
            name: schema.label,
            visibility: false,
            rendererOptions: {zIndexing: true},
            strategies: strategies
        });

        if (schema.schemaName === "all") {

            var drawFeature = OpenLayers.Layer.Vector.prototype.drawFeature;

            var getSchemeNameByFeature = function(className) {

               switch(className) {
                   case 'OpenLayers.Geometry.Polygon' :
                       return 'polygon';
                   case 'OpenLayers.Geometry.LineString' :
                       return 'line';
                   case 'OpenLayers.Geometry.Point' :
                       return 'point';
               }

               console.warn("feature has no geometry with associated scheme",feature);
               return 'null';
            };

            layer.drawFeature = function (feature, styleId) {
                styleId = (styleId || 'default') + "-" + getSchemeNameByFeature(feature.geometry.CLASS_NAME);
                return drawFeature.apply(this, [feature, styleId]);
            };
        }



        if (schema.maxScale) {
            layer.options.maxScale = schema.maxScale;
        }

        if (schema.minScale) {
            layer.options.minScale = schema.minScale;
        }

        schema.layer = layer;
        widget.map.addLayer(layer);
    },


    /**
     * Open change style dialog
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
     * @returns {*}
     */
    openChangeStyleDialog: function (olFeature) {
        var schema = this;
        var layer = olFeature.layer;
        var styleMap = layer.options.styleMap;
        var styles = styleMap.styles;
        var defaultStyleData = olFeature.style || _.extend({}, styles.default.defaultStyle);

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

        var styleEditor = new FeatureStyleEditor(styleOptions);
        styleEditor.setFeature(olFeature);




    },

    /**
     * Analyse changed bounding box geometrie and load features as FeatureCollection.
     *
     * @returns {*}
     * @private
     */

    _getData: function () {

        var schema = this;
        var widget = schema.widget;

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

        // switch (schema.searchType) {
        //     case  "currentExtent":
        //         if (schema.hasOwnProperty("lastBbox")) {
        //             var bbox = extent.toGeometry().getBounds();
        //             var lastBbox = schema.lastBbox;
        //
        //             var topDiff = bbox.top - lastBbox.top;
        //             var leftDiff = bbox.left - lastBbox.left;
        //             var rightDiff = bbox.right - lastBbox.right;
        //             var bottomDiff = bbox.bottom - lastBbox.bottom;
        //
        //             // var sidesChanged = {
        //             //     left: leftDiff < 0,
        //             //     bottom: bottomDiff < 0,
        //             //     right: rightDiff > 0,
        //             //     top: topDiff > 0
        //             // };
        //         }
        // }

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
                    schema.reloadFeatures([]);
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
            schema.reloadFeatures([]);
        }

        // Abort previous request
        if (schema.xhr) {
            schema.xhr.abort();
        }

        schema.xhr = QueryEngine.query('select', request).done(function (featureCollection) {
            schema._onFeatureCollectionLoaded(featureCollection, this);
        });

        return schema.xhr;
    },

    // _initialFormData: function (feature) {
    //     return initialFormData(feature);
    // },

    /**
     * Handle feature collection by ajax response.
     *
     * @param {FeatureCollection} featureCollection
     * @param xhr ajax request object
     * @private
     * @version 0.2
     */
    _onFeatureCollectionLoaded: function (featureCollection, xhr) {
        var schema = this;

        if (!featureCollection || !featureCollection.hasOwnProperty("features")) {
            Mapbender.error(Mapbender.DigitizerTranslator.translate("features.loading.error"), featureCollection, xhr);
            return;
        }

        if (featureCollection.features && featureCollection.features.length == schema.maxResults) {
            Mapbender.info("It is requested more than the maximal available number of results.\n ( > " + schema.maxResults + " results. )");
        }
        var geoJsonReader = new OpenLayers.Format.GeoJSON();
        var currentExtentOnly = schema.searchType === "currentExtent";
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

        if (schema.group && schema.group === "all") {
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

        schema.reloadFeatures(_.union(features, polygones, lineStrings, points));
    },


    /**
     * Remove OL feature
     *
     * @version 0.2
     * @returns {*}
     * @param  {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
     */
    removeFeature: function (olFeature) {
        var schema = this;
        var widget = schema.widget;

        var isNew = olFeature.hasOwnProperty('isNew');
        var layer = olFeature.layer;
        var featureData = olFeature.attributes;


        function _removeFeatureFromUI() {
            //var clonedFeature = jQuery.extend(true, {}, olFeature);
            var existingFeatures = schema.isClustered ? _.flatten(_.pluck(layer.features, "cluster")) : layer.features;
            schema.reloadFeatures(_.without(existingFeatures, olFeature));

            schema._refreshMapAfterFeatureSave();
        }

        if (isNew) {
            _removeFeatureFromUI()
        } else {
            Mapbender.confirmDialog({
                html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
                onSuccess: function () {
                    QueryEngine.query('delete', {
                        schema: schema.schemaName,
                        feature: featureData
                    }).done(function (fid) {
                        _removeFeatureFromUI();
                        $.notify(Mapbender.DigitizerTranslator.translate('feature.remove.successfully'), 'info');
                    });
                }
            });
        }

        return olFeature;
    },


    /**
     * Copy feature
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     */
    copyFeature: function (feature) {
        var schema = this;
        var widget = schema.widget;
        /**@type {Scheme} */
        var layer = schema.layer;
        var newFeature = feature.clone();
        var config = schema.copy;
        var defaultAttributes = config.data || {};
        var allowCopy = true;

        _.each(schema.copy.rules, function (ruleCode) {
            var f = feature;
            eval('allowCopy = ' + ruleCode + ';');
            if (!allowCopy) {
                return false;
            }
        });

        if (!allowCopy) {
            $.notify(Mapbender.DigitizerTranslator.translate('feature.clone.on.error'));
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
        delete newFeature.fid;

        return schema.saveFeature(newFeature).done(function (response) {
            if (response.errors) {
                Mapbender.error(Mapbender.DigitizerTranslator.translate("feature.copy.error"));
                return;
            }

            var request = this;
            var feature = request.feature;

            feature.redraw('copy');

            var successHandler = config.on && config.on.success;

            if (successHandler) {
                var r = function (feature) {
                    return eval(successHandler + ";");
                }(feature);
            } else {
                schema._openFeatureEditDialog(feature);
            }
        });
    },

    /**
     * On save button click
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature OpenLayers feature
     * @private
     * @return {(jQuery.jqXHR | void)} ajax XHR
     */
    saveFeature: function (feature) {

        if (feature.disabled) { // Feature is temporarily disabled
            return;
        }

        console.log("saveFeature");

        var schema = this;
        var widget = schema.widget;
        var dialog = schema.editDialog;
        var table = schema.table;
        var tableWidget = table.data('visUiJsResultTable');
        var tableApi = table.resultTable('getApi');
        var formData = dialog && dialog.formData() || schema.initialFormData(feature);
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

        if (hasErrors) {
            console.warn("Feature has error and can not be saved",feature);
        }

        if (!hasErrors) {
            feature.disabled = true;
            dialog && dialog.disableForm();

            return QueryEngine.query('save', {

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
                var layer = schema.layer;

                //delete widget.unsavedFeatures[feature.id];

                if (!hasFeatureAfterSave) {
                    schema.reloadFeatures(_.without(layer.features, feature));
                    dialog && dialog.popupDialog('close');
                    return;
                }

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

                _.each(['fid', 'disabled', 'state', 'data', 'layer', /* 'schema', */ 'isNew', 'renderIntent', 'styleId'], function (key) {
                    newFeature[key] = feature[key];
                });

                schema.reloadFeatures(_.union(_.without(layer.features, feature), [newFeature]));
                feature = newFeature;

                tableApi.row(tableWidget.getDomRowByData(feature)).invalidate();
                tableApi.draw();

                feature.isNew = false;
                feature.isChanged = false;

                dialog && dialog.enableForm();
                feature.disabled = false;


                schema.triggerModifiedState(feature, false);

                dialog && dialog.popupDialog('close');

                $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully"), 'info');



                var config = widget.currentSchema;
                if (config.hasOwnProperty("mailManager") && Mapbender.hasOwnProperty("MailManager")) {
                    try {
                        Mapbender.MailManager[config.mailManager](feature);
                    } catch (e) {
                        console.warn('The function' + config.mailManager + " is not supported by the Mapbender Mail Manager Extension");
                    }
                }

                var successHandler = schema.save && schema.save.on && schema.save.on.success;
                if (successHandler) {
                    eval(successHandler);
                }
                schema._refreshMapAfterFeatureSave();

                if (schema._getUnsavedFeatures().length === 0) {
                    $(schema.frame).find(".save-all-features").removeClass("active");
                }

                if (schema.refreshFeaturesAfterSave) {
                    _.each(schema.refreshFeaturesAfterSave, function (el, index) {
                        widget.refreshConnectedDigitizerFeatures(el);
                    })
                }
            });
        }
    },

    _getUnsavedFeatures: function () {
        var schema = this;
        return schema.layer.features.filter(function(feature) { return feature.isNew || feature.isChanged });
    },


    createContextMenuSubMenu: function (olFeature) {
        var schema = this;
        var subItems = {
            zoomTo: {
                name: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
                action: function (key, options, parameters) {
                    schema.zoomToJsonFeature(parameters.olFeature);
                }
            }
        };

        if (schema.allowChangeVisibility) {
            subItems['style'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.visibility.change'),
                action: function (key, options, parameters) {
                    schema.openChangeStyleDialog(olFeature);
                }
            };
        }

        if (schema.allowCustomerStyle) {
            subItems['style'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                action: function (key, options, parameters) {
                    schema.openChangeStyleDialog(olFeature);
                }
            };
        }

        if (schema.allowEditData) {
            subItems['edit'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.edit'),
                action: function (key, options, parameters) {
                    schema._openFeatureEditDialog(parameters.olFeature);
                }
            }
        }

        if (schema.allowDelete) {
            subItems['remove'] = {
                name: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                action: function (key, options, parameters) {
                    schema.removeFeature(parameters.olFeature);
                }
            }
        }

        return {
            name: "Feature #" + olFeature.fid,
            olFeature: olFeature,
            items: subItems
        };
    },


    /**
     * Zoom to JSON feature
     *
     * @param {(OpenLayers.Feature.Vector)} feature
     */
    zoomToJsonFeature: function (feature) {
        var schema = this;
        var widget = schema.widget;

        if (!feature) {
            return
        }

        var olMap = widget.getMap();
        var geometry = feature.geometry;

        olMap.zoomToExtent(geometry.getBounds());
        if (schema.hasOwnProperty('zoomScaleDenominator')) {
            olMap.zoomToScale(schema.zoomScaleDenominator, true);
        }
    },


    _zoomOrOpenDialog: function(feature) {
        var schema = this;

        var isOpenLayerCloudPopup = schema.popup && schema.popup.type && schema.popup.type === 'openlayers-cloud';

        if (isOpenLayerCloudPopup) {
            schema._openFeatureEditDialog(feature);
        } else {
            schema.zoomToJsonFeature(feature);
        }
    },

    initializeResultTableEvents: function() {
        var schema = this;
        var widget = schema.widget;

        var table = schema.table;
        var tableApi = table.resultTable('getApi');

        table.off('mouseenter', 'mouseleave', 'click');

        table.delegate("tbody > tr", 'mouseenter', function () {
            var tr = this;
            var row = tableApi.row(tr);
            schema._highlightFeature(row.data(), true);
        });

        table.delegate("tbody > tr", 'mouseleave', function () {
            var tr = this;
            var row = tableApi.row(tr);
            schema._highlightFeature(row.data(), false);
        });

        table.delegate("tbody > tr", 'click', function () {
            var tr = this;
            var row = tableApi.row(tr);
            var feature = row.data();

            feature.selected = $('.selection input', tr).is(':checked');
            schema._highlightFeature(feature);

            schema._zoomOrOpenDialog(feature);

        });


    },




    /**
     * Highlight feature on the map
     *
     * @param {(OpenLayers.Feature.Vector)} feature
     * @param {boolean} highlight
     * @private
     */
    _highlightFeature: function (feature, highlight) {


        if (!feature || !feature.layer) {
            return;
        }
        var layer = feature.layer;

        if (feature.renderIntent && feature.renderIntent === 'invisible') {
            return;
        }

        var isFeatureVisible = _.contains(layer.features, feature);
        var features = [];

        if (isFeatureVisible) {
            features.push(feature);
        } else {
            _.each(layer.features, function (_feature) {
                if (_feature.cluster && _.contains(_feature.cluster, feature)) {
                    features.push(_feature);
                    return false;
                }
            });
        }
        _.each(features, function (feature) {
            feature.redraw(highlight);
        });

    },

    _toggleVisibility: function(on) {
        var schema = this;
        schema.layer.features.forEach(function(feature) {
            schema.toggleFeatureVisibility(feature,on);

        });

    },

    toggleFeatureVisibility: function(feature,on) {
        var schema = this;

        feature.redraw(on ? false : 'invisible');
        feature.renderIntent = on ? "default" : "invisible";

        var row = schema._getTableRowByFeature(feature);

        var ui = row.find('.button.visibility');

        if (on) {
            ui.removeClass("icon-invisibility");
            ui.closest('tr').removeClass('invisible-feature');
        } else {
            ui.addClass("icon-invisibility");
            ui.closest('tr').addClass('invisible-feature');
        }
    }

};