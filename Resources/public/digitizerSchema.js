(function () {
    "use strict";

    window.Scheme = function (rawScheme, widget) {
        /** @type {Scheme} */
        var schema = this;

        $.extend(schema, rawScheme);

        schema.widget = widget;

        schema._initializeHooks();

        schema.initTableFields();

        schema.createFormItemsCollection();

        schema.createPopupConfiguration();

        schema.setModifiedState = Scheme.prototype.setModifiedState.bind(this); // In order to achive arrow-function like "this" behaviour

        schema.toolset = schema.createToolset();

        schema.getStyleLabels().forEach(function (label) {
            schema.styles[label] = _.isEmpty(schema.styles[label]) ? schema.widget.styles[label] : schema.styles[label];
        });

        schema.createSchemaFeatureLayer();

        schema._createFrame();

        schema.addSelectControls();

        schema.resultTable.initializeResultTableEvents(schema.highlightControl, schema.zoomOrOpenDialog.bind(schema));

        // schema.layer.getClusteredFeatures = function () {
        //     return _.flatten(_.pluck(this.features, "cluster"));
        // };

        schema.mapContextMenu = new MapContextMenu(schema);
        schema.elementContextMenu = new ElementContextMenu(schema);


        // remove removeSelected Control if !allowDelete
        if (!schema.allowDelete) {
            $.each(schema.toolset, function (k, tool) {
                if (tool.type === "removeSelected") {
                    schema.toolset.splice(k, 1);
                }
            });
        }

        // use layerManager
        if (schema.refreshLayersAfterFeatureSave) {
            Mapbender.layerManager.setMap(schema.layer.map);
        }

        schema.initializeStyleApplication();

        if (schema.clustering) {
            var clusteringScheme = ClusteringSchemeMixin();
            var originalSchemePrototype = Object.getPrototypeOf(schema);
            Object.setPrototypeOf(schema, clusteringScheme);
            Object.setPrototypeOf(clusteringScheme, originalSchemePrototype);

            schema.initializeClustering();

        }

        console.assert(!!schema.tableFields,"Schema "+schema.schemaName+" does not have Tablefields");


    };


    Scheme.prototype = {


        schemaName: null,
        resultTable: null,
        layer: null,
        widget: null,
        frame: null,
        mapContextMenu: null,
        elementContextMenu: null,

        featureType: {
            name: null,
            geomType: null,
            table: null,
            files: null,
            uniqueId: null,
        },

        featureStyles: null,
        olFeatureCloudPopup: null,

        evaluatedHooks: {},
        lastRequest: null,


        xhr: null,
        view: {
            type: null, // No implementation
            settings: null,
        },

        selectControl: null,
        highlightControl: null,
        clusterStrategy: null,
        digitizingToolset: null,


        //** Data Manager only
        dataStore: null,
        dataStoreLink: {
            fieldName: null
        },
        dataItems: null,

        //* Server Only
        events: {
            onAfterSave: null,
        },


        //* Newly added properties
        revertChangedGeometryOnCancel: false,
        deactivateControlAfterModification: true,
        allowSaveAll: true,
        markUnsavedFeatures: true,


        displayOnSelect: true, // BEV only, no implementation

        label: null,
        allowDigitize: true,
        allowDelete: true,
        allowSave: true,
        allowEditData: true,
        allowCustomerStyle: true,
        allowChangeVisibility: true,
        allowDeleteByCancelNewGeometry: false,
        allowCancelButton: true,
        allowLocate: true,
        maxResults: 500,
        showExtendSearchSwitch: false,
        zoomScaleDenominator: 500,
        useContextMenu: true,
        displayPermanent: false,
        displayOnInactive: false,
        toolset: {},
        popup: {},
        styles: {
            default: {},
            select: {}
        },

        copy: {
            enable: true,
            rules: [],
            data: {},
        },

        formItems: null,
        search: null,
        showVisibilityNavigation: true,
        allowPrintMetadata: false,
        printable: true,
        maxScale: null,
        minScale: null,
        group: null,
        // oneInstanceEdit: true,
        //zoomDependentVisibility: [{max: 10000}],
        refreshFeaturesAfterSave: null,
        mailManager: null,
        tableTranslation: null,
        save: {}, // pop a confirmation dialog when deactivating, to ask the user to save or discard current in-memory changes
        openFormAfterEdit: true,
        maxResults: 5001,
        pageLength: 10,
        currentExtentSearch: true,
        inlineSearch: false,
        hooks: {
            onModificationStart: null,
            onStart: null
        },
        refreshLayersAfterFeatureSave: [], // Layer list names/ids to be refreshed after feature save complete
        clustering: [{
            scale: 5000000,
            distance: 30
        }],
        tableFields: null,


        createFormItemsCollection: function(formItems) {
            var schema = this;
            schema.formItems = new FormItemsCollection(formItems || schema.formItems, schema);

        },

        createPopupConfiguration: function() {
            var schema = this;
            schema.popup = new PopupConfiguration(schema.popup, schema);
        },

        updateConfigurationAfterSwitching: function(updatedSchemes) {
            var schema = this;
            schema.createFormItemsCollection(updatedSchemes[schema.schemaName].formItems); // Update formItems Of Schema when switiching
        },

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

        activateSchema: function () {

            /** @type {Scheme} */
            var schema = this;


            var widget = schema.widget;
            var frame = schema.frame;
            var layer = schema.layer;

            if (widget.options.__disabled) {
                return;
            }

            schema.activateContextMenu();

            widget.getData = schema.getData.bind(schema);

            if (!schema.displayOnInactive) {
                widget.deactivateSchema = schema.deactivateSchema.bind(schema);
            }

            var promise;

            if (schema.allowCustomerStyle) {
                promise = QueryEngine.query('style/list', widget.id, {schema: schema.schemaName}).then(function(data) {
                    schema.featureStyles = data.featureStyles;
                });
            } else {
                promise = $.Deferred().resolve();
            }

            promise.then(function () {
                return QueryEngine.query('getConfiguration', widget.id);
            }).done(function (response) {


                 schema.updateConfigurationAfterSwitching(response.schemes);


                layer.setVisibility(true);
                frame.show();
                schema.highlightControl.activate();
                schema.selectControl.activate();
                schema.getData();

            });

        },

        deactivateSchema: function () {
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

            schema.digitizingToolset.deactivateControls();


        },


        activateContextMenu: function () {
            var schema = this;
            var widget = schema.widget;

            widget.allowUseMapContextMenu = schema.mapContextMenu.allowUseContextMenu;
            widget.buildMapContextMenu = schema.mapContextMenu.buildContextMenu;

            widget.allowUseElementContextMenu = schema.elementContextMenu.allowUseContextMenu;
            widget.buildElementContextMenu = schema.elementContextMenu.buildContextMenu;

        },

        getStyleLabels: function () {
            return ['default', 'select', 'unsaved', 'invisible', 'labelText', 'labelTextHover', 'copy'];
        },

        initTableFields: function() {
           // Nothing to do
        },


        initializeStyleApplication: function () {
            var schema = this;

            schema.layer.drawFeature = function (feature, style) {
                if (style === undefined || style === 'default') {


                    style = schema.featureStyles && schema.featureStyles[feature.fid] || "default";

                    if (feature.isChanged || feature.isNew) {
                        style = 'unsaved';
                    }

                    if (feature.isCopy) {
                        style = 'copy';
                    }

                    if (!feature.visible) {
                        style = 'invisible';
                    }
                }
                return OpenLayers.Layer.Vector.prototype.drawFeature.apply(this, [feature, style]);
            };
        },

        createToolset: function () {
            var schema = this;
            var widget = schema.widget;
            return schema.toolset && !_.isEmpty(schema.toolset) ? schema.toolset : widget.getDefaultToolsetByGeomType(schema.featureType.geomType);
        },


        _refreshOtherLayersAfterFeatureSave: function () {
            var schema = this;

            if (schema.refreshLayersAfterFeatureSave) {

                _.each(schema.refreshLayersAfterFeatureSave, function (layerInstanceId) {
                    var layers = Mapbender.layerManager.getLayersByInstanceId(layerInstanceId);
                    _.each(layers, function (layer) {
                        Mapbender.layerManager.refreshLayer(layer);
                    });
                });
            }

        },

        _createResultTableDataFunction: function (columnId) {

            return function (row, type, val, meta) {
                var data = row.data[columnId];
                if (typeof (data) == 'string') {
                    data = data.escapeHtml();
                }
                return data;
            };
        },


        getDefaultFormItems: function (feature) {

            var defaultFormItems = [];
            _.each(feature.data, function (value, key) {
                defaultFormItems.push({
                    type: 'input',
                    name: key,
                    title: key
                });
            });

            return defaultFormItems;
        },

        /**
         * @Overwrite
         */
        processFormItems: function (feature, dialog) {
            var schema = this.getSchemaByFeature(feature);
            var formItems = schema.formItems || schema.getDefaultFormItems(feature); // TODO Can this ever be called?

            var processedFormItems = formItems.process(feature, dialog);

            return processedFormItems;
        },


        openFeatureEditDialog: function (feature) {
            var schema = this;
            schema.popup.createFeatureEditDialog(feature);
        },


        _mapHasActiveControlThatBlocksSelectControl: function () {
            var schema = this;
            var widget = schema.widget;
            var map = widget.map;

            return !!_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true});
        },



        addSelectControls: function () {
            var schema = this;
            var layer = schema.layer;
            var widget = schema.widget;


            var selectControl = new OpenLayers.Control.SelectFeature(layer, {
                clickout: true,
                toggle: true,
                multiple: true,

                openDialog: function (feature) {

                    if (schema.allowEditData) {
                        schema.openFeatureEditDialog(feature);
                    }
                },

                clickFeature: function (feature) {
                    if (schema._mapHasActiveControlThatBlocksSelectControl()) {
                        return;
                    }
                    this.openDialog(feature);
                    return Object.getPrototypeOf(this).clickFeature.apply(this, arguments);

                },

                handlers: {
                    click: new OpenLayers.Handler.Click(this, {
                        'click': function () {
                            console.log("do bnthing");
                        },
                        'rightclick': function () {
                            console.log("right lick");
                        },
                        'dblrightclick': this.onRightClick
                    }, {
                        'single': true,
                        'double': true
                    })
                }

                // TODO Selection of Elements does not seem to be necessary

                // onSelect: function (feature) {
                //
                //
                //     var selectionManager = schema._getSelectionManager();
                //     selectionManager.add(feature);
                //
                //     feature.renderIntent = "selected";
                //     layer.drawFeature(feature, 'selected');
                //
                //     this.openDialog(feature);
                // },
                // onUnselect: function (feature) {
                //     var selectionManager = schema._getSelectionManager();
                //     selectionManager.remove(feature);
                //
                //     feature.renderIntent = "default";
                //     layer.drawFeature(feature, "default");
                //
                //     this.openDialog(feature);
                //
                // }
            });

            var highlightControl = new OpenLayers.Control.SelectFeature(layer, {
                hover: true,
                highlightOnly: true,

                overFeature: function (feature) {
                    this.highlight(feature);

                },
                outFeature: function (feature) {
                    this.unhighlight(feature);
                },

                highlight: function (feature) {
                    console.assert(!!feature, "Feature must be set");
                    schema.processFeature(feature, function (feature) {
                        schema.resultTable.hoverInResultTable(feature, true);
                    });
                    return Object.getPrototypeOf(this).highlight.apply(this, [feature, true]);
                },
                unhighlight: function (feature) {
                    schema.processFeature(feature, function (feature) {
                        schema.resultTable.hoverInResultTable(feature, false);
                    });
                    return Object.getPrototypeOf(this).unhighlight.apply(this, [feature, false]);
                }
            });

            // Workaround to move map by touch vector features
            selectControl.handlers && selectControl.handlers.feature && (selectControl.handlers.feature.stopDown = false);
            schema.selectControl = selectControl;
            schema.highlightControl = highlightControl;

            widget.map.addControl(schema.highlightControl);
            widget.map.addControl(schema.selectControl);
        },


        reloadFeatures: function () {
            var schema = this;
            var widget = schema.widget;
            var layer = schema.layer;
            var features = schema.getLayerFeatures();


            layer.removeAllFeatures();
            layer.addFeatures(features);

            schema.resultTable.redrawResultTableFeatures(features);

            if (widget.options.__disabled) {
                widget.deactivate();
            }
        },


        _createFrame: function () {
            var schema = this;
            var widget = schema.widget;
            var element = $(widget.element);

            var sidebar = new Sidebar(schema);

            schema.frame = sidebar.frame;
            element.append(sidebar.frame);

        },


        setModifiedState: function (feature, control) {

            var schema = this;
            $(schema.frame).find(".save-all-features").addClass("active");

            var row = schema.resultTable.getTableRowByFeature(feature);
            if (!row) {
                feature.isNew = true;
                return; // In case of non-saved feature
            }
            feature.isChanged = true;

            row.find('.button.save').removeAttr("disabled");


            if (schema.deactivateControlAfterModification) {
                control && control.deactivate();
            }

        },


        unsetModifiedState: function (feature) {

            var schema = this;

            feature.isChanged = false;
            feature.isNew = false;
            feature.isCopy = false;

            if (schema._getUnsavedFeatures().length === 0) {
                $(schema.frame).find(".save-all-features").removeClass("active");
            }

            var row = schema.resultTable.getTableRowByFeature(feature);
            if (!row) {
                return; // in case of non-saved feature
            }
            row.find('.button.save').removeClass("active").attr('disabled','disabled');


        },


        _createStyleMap: function () {
            var schema = this;
            var context = schema.getStyleMapContext();
            var styleMapObject = {};
            var labels = schema.getStyleLabels();

            labels.forEach(function (label) {
                var options = schema.getStyleMapOptions(label);
                options.context = context;
                var styleOL = OpenLayers.Feature.Vector.style[label] || OpenLayers.Feature.Vector.style['default'];
                styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, schema.styles[label]), options);
            });

            if (!schema.markUnsavedFeatures) {
                styleMapObject.unsaved = styleMapObject.default;
            }
            return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});

        },

        // Overwrite
        getStyleMapOptions: function (label) {
            return {};
        },

        getStyleMapContext: function () {
            return {
                webRootPath: Mapbender.configuration.application.urls.asset,
                feature: function (feature) {
                    return feature;
                },
                label: function (feature) {
                    return feature.attributes.label || feature.getClusterSize() || "";
                }
            }
        },

        createSchemaFeatureLayer: function () {

            var schema = this;
            var widget = schema.widget;
            var strategies = [];

            var styleMap = schema._createStyleMap();


            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap: styleMap,
                name: schema.label,
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
            schema.layer = layer;

            widget.map.addLayer(schema.layer);

        },


        createDefaultSymbolizer: function (feature) {
            var schema = this;
            return schema.layer.styleMap.styles['default'].createSymbolizer(feature);
        },

        openChangeStyleDialog: function (feature) {
            var schema = this;

            var style = schema.createDefaultSymbolizer(feature);

            var styleOptions = {
                data: schema.featureStyles[feature.fid] || style,
                commonTab: false
            };

            var styleEditor = new FeatureStyleEditor(feature, schema, styleOptions);
        },


        getData: function () {
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
            var isExtentOnly = !!schema.currentExtentSearch;

            if (isExtentOnly) {
                request = $.extend(true, {intersectGeometry: extent.toGeometry().toString()}, request);
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
                        // Remove all features
                        schema.removeAllFeatures();
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
                schema.removeAllFeatures();
            }

            // Abort previous request
            if (schema.xhr) {
                schema.xhr.abort();
            }

            schema.xhr = QueryEngine.query('select', widget.id,  request).done(function (featureCollection) {
                schema._onFeatureCollectionLoaded(featureCollection, this);
            });

            return schema.xhr;
        },


        _getVisibleFeatures: function () {
            var schema = this;
            var layer = schema.layer;
            var map = layer.map;
            var extent = map.getExtent();
            var bbox = extent.toGeometry().getBounds();
            var currentExtentOnly = schema.currentExtentSearch;


            var visibleFeatures = currentExtentOnly ? _.filter(schema.getLayerFeatures(), function (feature) {
                return feature && (feature.isNew || feature.geometry.getBounds().intersectsBounds(bbox));
            }) : layer.features;

            return visibleFeatures;
        },


        _mergeExistingFeaturesWithLoadedFeatures: function (newFeatures) {
            var schema = this;

            var existingFeatures = schema._getVisibleFeatures();


            var newFeaturesFiltered = _.filter(newFeatures, function (nFeature) {
                return !existingFeatures.some(function (oFeature) {
                    return nFeature.equals(oFeature);
                });
            });

            var features = _.union(newFeaturesFiltered, existingFeatures);
            return features;

        },

        _onFeatureCollectionLoaded: function (featureCollection, xhr) {
            var schema = this;

            if (!featureCollection || !featureCollection.hasOwnProperty("features")) {
                Mapbender.error(Mapbender.DigitizerTranslator.translate("features.loading.error"), featureCollection, xhr);
                return;
            }

            if (featureCollection.features && featureCollection.features.length === parseInt(schema.maxResults)) {
                Mapbender.info("It is requested more than the maximal available number of results.\n ( > " + schema.maxResults + " results. )");
            }
            var geoJsonReader = new OpenLayers.Format.GeoJSON();
            var newFeatures = geoJsonReader.read({
                type: "FeatureCollection",
                features: featureCollection.features
            });

            schema.layer.features = schema.group === "all" ? newFeatures : schema._mergeExistingFeaturesWithLoadedFeatures(newFeatures);

            schema.reloadFeatures();
        },

        // Overwrite
        getLayerFeatures: function () {
            var schema = this;
            return schema.layer.features;
        },

        _removeFeatureFromUI: function (olFeature) {
            var schema = this;
            schema.layer.features = _.without(schema.getLayerFeatures(), olFeature);
            schema.reloadFeatures();
            schema._refreshOtherLayersAfterFeatureSave();
        },

        removeAllFeatures: function () {
            var schema = this;
            schema.layer.removeAllFeatures();
        },


        removeFeature: function (feature) {
            var schema = this;
            var widget = schema.widget;

            if (feature.isNew) {
                schema._removeFeatureFromUI(feature);
            } else {
                Mapbender.confirmDialog({
                    html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
                    onSuccess: function () {
                        QueryEngine.query('delete', widget.id, {
                            schema: schema.getSchemaByFeature(feature).schemaName,
                            feature: feature.attributes
                        }).done(function (fid) {
                            schema._removeFeatureFromUI(feature);
                            $.notify(Mapbender.DigitizerTranslator.translate('feature.remove.successfully'), 'info');
                        });
                    }
                });
            }

            return feature;
        },


        copyFeature: function (feature) {
            var schema = this;
            var layer = schema.layer;
            var newFeature = feature.clone();
            var config = schema.copy;
            var defaultAttributes = config.data || {};
            var allowCopy = true;

            layer.addFeatures([newFeature]);

            _.each(schema.copy.rules, function (ruleCode) {
                var f = feature;
                if (!allowCopy) {
                    return false;
                }
                eval('allowCopy = ' + ruleCode + ';');
            });

            if (!allowCopy) {
                $.notify(Mapbender.DigitizerTranslator.translate('feature.clone.on.error'));
                return;
            }

            var newAttributes = _.extend({}, defaultAttributes);

            _.each(feature.attributes, function (v, k) {
                if (v !== '' && v !== null && k !== schema.featureType.uniqueId) {
                    newAttributes[k] = v;
                }

            });

            newFeature.data = newAttributes;
            schema.setModifiedState(newFeature);
            newFeature.isCopy = true;
            newFeature.layer = feature.layer;

            // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
            newFeature.geometry.move(200, 200);
            newFeature.data.name = "Copy of " + (feature.attributes.name || feature.fid);

            delete newFeature.fid;
            newFeature.style = null;

            layer.drawFeature(newFeature);

            schema.openFeatureEditDialog(newFeature);

        },


        getSchemaByFeature: function () {
            var schema = this;
            return schema;
        },


        _createNewFeatureWithDBFeature: function (feature, response) {
            var schema = this;

            var features = response.features;

            if (features.length === 0) {
                console.warn("No Feature returned from DB Operation");
                schema._removeFeatureFromUI(feature);
                return null;
            } else if (features.length > 1) {
                console.warn("More than 1 Feature returned from DB Operation");
            }


            if (feature.saveStyleDataCallback) {
                feature.saveStyleDataCallback(feature);
                feature.saveStyleDataCallback = null;
            }

            var geoJsonReader = new OpenLayers.Format.GeoJSON();

            var newFeatures = geoJsonReader.read(response);
            var newFeature = _.first(newFeatures);


            newFeature.fid = newFeature.fid || feature.fid;

            newFeature.layer = feature.layer;

            return newFeature;

        },

        // TODO feature / option formData parameters are not pretty -> keep data in feature directly
        saveFeature: function (feature, formData) {
            var schema = this;
            var widget = schema.widget;
            var tableApi = schema.resultTable.getApi();
            var wkt = new OpenLayers.Format.WKT().write(feature);
            var srid = widget.map.getProjectionObject().proj.srsProjNumber;


            if (feature.disabled) { // Feature is temporarily disabled
                return;
            }

            feature.disabled = true;

            formData = formData || schema.getSchemaByFeature(feature).formItems.createHeadlessFormData(feature);

            var request = {
                id: feature.isNew ? null : feature.fid,
                properties: formData,
                geometry: wkt,
                srid: srid,
                type: "Feature"
            };

            // TODO check this
            tableApi.draw({"paging": "page"});

            var promise = QueryEngine.query('save', widget.id,  {

                schema: schema.getSchemaByFeature(feature).schemaName,
                feature: request
            }).done(function (response) {

                if (response.hasOwnProperty('errors')) {
                    return;
                }


                schema.unsetModifiedState(feature);


                var newFeature = schema._createNewFeatureWithDBFeature(feature, response);

                newFeature.isNew = false;

                if (newFeature == null) {
                    console.warn("Creation of new Feature failed");
                    return;
                }

                schema._removeFeatureFromUI(feature);

                schema.layer.removeFeatures([feature]);
                schema.layer.addFeatures([newFeature]);

                schema.reloadFeatures();


                schema.resultTable.refreshFeatureRowInDataTable(newFeature);

                $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully"), 'info');


                schema._tryMailManager(newFeature);


                var successHandler = schema.save && schema.save.on && schema.save.on.success;
                if (successHandler) {
                    eval(successHandler);
                }

                schema._refreshOtherLayersAfterFeatureSave();

                schema._refreshConnectedDigitizerFeatures();


            });

            return promise;

        },


        _refreshConnectedDigitizerFeatures: function () {
            var schema = this;
            var widget = schema.widget;

            if (schema.refreshFeaturesAfterSave) {
                _.each(schema.refreshFeaturesAfterSave, function (el, index) {
                    widget.refreshConnectedDigitizerFeatures(el);
                })
            }
        },

        _tryMailManager: function (feature) {
            var schema = this;
            if (schema.mailManager && Mapbender.hasOwnProperty("MailManager")) {
                try {
                    Mapbender.MailManager[schema.mailManager](feature);
                } catch (e) {
                    console.warn('The function' + schema.mailManager + " is not supported by the Mapbender Mail Manager Extension");
                }
            }
        },

        _getUnsavedFeatures: function () {
            var schema = this;
            return schema.layer.features.filter(function (feature) {
                return feature.isNew || feature.isChanged
            });
        },


        // Overwrite
        processFeature: function (feature, callback) {
            callback(feature);
        },


        zoomToJsonFeature: function (feature) {
            var schema = this;
            var widget = schema.widget;

            if (!feature) {
                return
            }

            var olMap = widget.map;
            var geometry = feature.geometry;

            olMap.zoomToExtent(geometry.getBounds());
            if (schema.zoomScaleDenominator) {
                olMap.zoomToScale(schema.zoomScaleDenominator, true);
            }
        },


        zoomOrOpenDialog: function (feature) {
            var schema = this;

            if (schema.popup.isOpenLayersCloudPopup()) {
                schema.openFeatureEditDialog(feature);
            } else {
                schema.zoomToJsonFeature(feature);
            }
        },


        setVisibilityForAllFeaturesInLayer: function (visible) {
            var schema = this;
            var layer = schema.layer;

            layer.features.forEach(function (feature) {

                feature.visible = visible;
                layer.drawFeature(feature);
            });

            schema.resultTable.getApi().draw();

        },

        toggleFeatureVisibility: function (feature) {
            var schema = this;
            var layer = schema.layer;

            feature.visible = !feature.visible;

            layer.drawFeature(feature);
            schema.resultTable.getApi().draw();


        },


        _getDefaultProperties: function () {
            var schema = this;

            var newFeatureDefaultProperties = [];
            $.each(schema.tableFields, function (fieldName) {
                newFeatureDefaultProperties.push(fieldName);
            });
            return newFeatureDefaultProperties;
        },


        _getRemoteData: function (feature) {
            var schema = this;
            var widget = schema.widget;
            var map = widget.map;
            var bbox = feature.geometry.getBounds();
            bbox.right = parseFloat(bbox.right + 0.00001);
            bbox.top = parseFloat(bbox.top + 0.00001);
            bbox = bbox.toBBOX();
            var srid = map.getProjection().replace('EPSG:', '');
            var url = widget.elementUrl + "getFeatureInfo/";

            return $.get(url, {
                bbox: bbox,
                schema: schema.schemaName,
                srid: srid
            }).done(function (response) {
                schema._processRemoteData(response, feature);
            }).fail(function (response) {
                if (!feature.isNew) {
                    schema.openFeatureEditDialog(feature);
                }
                Mapbender.error(Mapbender.trans("mb.digitizer.remoteData.error"));

            });


        },

        _processRemoteData: function (response, feature) {
            var schema = this;
            if (response.error) {
                Mapbender.error(Mapbender.trans('mb.digitizer.remoteData.error'));
            }

            _.each(response.dataSets, function (dataSet) {
                var newData = JSON.parse(dataSet).features[0].properties;
                Object.keys(feature.data);
                $.extend(feature.data, newData);
            });

            if (!feature.isNew) {
                schema.openFeatureEditDialog(feature);
            } else {
                schema.widget.currentPopup.formData(feature.data);
            }


        },


        exportGeoJson: function (feature) {
            var schema = this;
            var widget = schema.widget;
            QueryEngine.query('export', widget.id,  {
                schema: schema.getSchemaByFeature(feature).schemaName,
                feature: feature,
                format: 'GeoJSON'
            }).done(function (response) {

            });
        },


    };


})();
