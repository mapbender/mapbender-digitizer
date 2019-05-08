(function () {
    "use strict";


    Mapbender.Digitizer.Scheme = function (rawScheme, widget, index) {
        var schema = this;
        schema.index = index;
        schema.widget = widget;
        $.extend(schema, rawScheme);

        var styleLabels = ['default', 'select', 'unsaved', 'invisible', 'labelText', 'labelTextHover', 'copy'];

        var initializeHooksForControlPrevention = function () {
            _.each(schema.hooks, function (value, name) {
                if (!value) {
                    return false;
                }

                try {
                    schema.evaluatedHooksForControlPrevention[name] = function (feature) {
                        var control = this;
                        var attributes = feature.attributes;
                        return eval(value);
                    }
                } catch (e) {
                    console.warn ("Evaluation of control prevention hooks failed",e);
                }
            });
        };

        var initializeHooksForCopyPrevention = function() {
            _.each(schema.copy.rules, function (value,name) {
                try {
                    schema.evaluatedHooksForCopyPrevention[name] = function (feature) {
                        var f = feature;
                        return eval(value);
                    }
                } catch (e) {
                    console.warn ("Evaluation of copy prevention hooks failed",e);
                }
            });

        };

        var initializeHooksForTableFields = function() {
            _.each(schema.tableFields, function (tableField,name) {
                if (tableField.render) {
                    try {
                        tableField.render = eval(tableField.render);
                    } catch (e) {
                        console.warn("Evaluation of table field render hooks failed", e);
                    }
                }
            });

        };


        var createPopupConfiguration = function () {
            schema.popup = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
        };

        var createSchemaFeatureLayer = function () {

            var widget = schema.widget;
            var strategies = [];

            var createStyleMap = function () {

                var getStyleMapContext = function () {
                    return {
                        webRootPath: Mapbender.configuration.application.urls.asset,

                        feature: function (feature) {
                            return feature;
                        },
                        label: function (feature) {
                            return feature.attributes.label || feature.getClusterSize() || "";
                        }
                    }
                };

                var context = getStyleMapContext();
                var styleMapObject = {};

                styleLabels.forEach(function (label) {
                    var options = schema.getStyleMapOptions(label);
                    options.context = context;
                    var styleOL = OpenLayers.Feature.Vector.style[label] || OpenLayers.Feature.Vector.style['default'];
                    styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, schema.styles[label]), options);
                });

                if (!schema.markUnsavedFeatures) {
                    styleMapObject.unsaved = styleMapObject.default;
                }
                return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});

            };

            var styleMap = createStyleMap();


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

        };


        var createMenu = function () {
            var widget = schema.widget;
            var element = $(widget.element);

            schema.menu = new Mapbender.Digitizer.Menu(schema);
            schema.addSpecificOptionToSelector();

            schema.frame = schema.menu.frame;
            element.append(schema.menu.frame);

        };

        var addSelectControls = function () {
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
                    if (schema.mapHasActiveControlThatBlocksSelectControl()) {
                        return;
                    }
                    this.openDialog(feature);
                    return Object.getPrototypeOf(this).clickFeature.apply(this, arguments);

                }
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
                        schema.menu.resultTable.hoverInResultTable(feature, true);
                    });
                    return Object.getPrototypeOf(this).highlight.apply(this, [feature, true]);
                },
                unhighlight: function (feature) {
                    schema.processFeature(feature, function (feature) {
                        schema.menu.resultTable.hoverInResultTable(feature, false);
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
        };

        var initializeStyleApplication = function () { // TODO is should be refactored without monkeyPatch

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
        };


        initializeHooksForControlPrevention();

        initializeHooksForCopyPrevention();

        initializeHooksForTableFields();

        schema.initTableFields();

        schema.createFormItemsCollection();

        createPopupConfiguration();

        schema.setModifiedState = Mapbender.Digitizer.Scheme.prototype.setModifiedState.bind(this); // In order to achive arrow-function like "this" behaviour

        schema.toolset = schema.createToolset(); // Is overwritten and must therefore be implemented in the prototype

        styleLabels.forEach(function (label) {
            schema.styles[label] = _.isEmpty(schema.styles[label]) ? schema.widget.styles[label] : schema.styles[label];
        });

        createSchemaFeatureLayer();

        createMenu();

        addSelectControls();

        schema.menu.resultTable.initializeResultTableEvents(schema.highlightControl, schema.zoomOrOpenDialog.bind(schema));

        schema.mapContextMenu = new Mapbender.Digitizer.MapContextMenu(schema);
        schema.elementContextMenu = new Mapbender.Digitizer.ElementContextMenu(schema);

        // use layerManager
        if (schema.refreshLayersAfterFeatureSave) {
            Mapbender.layerManager.setMap(schema.layer.map);
        }

        initializeStyleApplication();

        if (schema.clustering) { // Move the clustering prototype just between the scheme and its native prototype
            var clusteringScheme = Mapbender.Digitizer.ClusteringSchemeMixin();
            var originalSchemePrototype = Object.getPrototypeOf(schema);
            Object.setPrototypeOf(schema, clusteringScheme);
            Object.setPrototypeOf(clusteringScheme, originalSchemePrototype);

            schema.initializeClustering();

        }


        var assert = function () {
            console.assert(['polygon', 'line', 'point', "-"].includes(schema.featureType.geomType), "invalid geom Type: " + schema.featureType.geomType + " in schema " + schema.schemaName);
            console.assert(!!schema.tableFields, "Schema " + schema.schemaName + " does not have Tablefields");
        };

        assert();


    };


    Mapbender.Digitizer.Scheme.prototype = {


        schemaName: null,
        layer: null,
        widget: null,
        frame: null,
        mapContextMenu: null,
        elementContextMenu: null,
        menu: null,

        featureType: {
            name: null,
            geomType: null,
            table: null,
            files: null,
            uniqueId: null,
        },

        featureStyles: null,
        featureCloudPopup: null,

        evaluatedHooksForControlPrevention: {},
        evaluatedHooksForCopyPrevention: {},
        lastRequest: null,


        xhr: null,
        view: {
            type: null, // No implementation
            settings: null,
        },

        selectControl: null,
        highlightControl: null,
        clusterStrategy: null,


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
        showExtendSearchSwitch: true,
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
            rules: null,
            data: null,
            overwriteValuesWithDefault: false,
            moveCopy: null,
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
        currentExtentSearch: false,
        inlineSearch: true,
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


        getGeomType: function () {
            var schema = this;
            return schema.featureType.geomType;
        },

        initTableFields: function () {

            var schema = this;
            if (!schema.tableFields) {
                schema.tableFields = {};
                schema.tableFields[schema.featureType.uniqueId] = {label: 'Nr.', width: '20%'};
                if (schema.featureType.name) {
                    schema.tableFields[schema.featureType.name] = {label: 'Name', width: '80%'};
                }
            }
        },


        createFormItemsCollection: function (formItems) {
            var schema = this;
            schema.formItems = new Mapbender.Digitizer.FormItemsCollection(formItems || schema.formItems, schema);

        },


        updateConfigurationAfterSwitching: function (updatedSchemes) {
            var schema = this;
            schema.createFormItemsCollection(updatedSchemes[schema.schemaName].formItems); // Update formItems Of Schema when switiching
        },


        activateSchema: function () {

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
                promise = widget.query('style/list', {schema: schema.schemaName}).then(function (data) {
                    schema.featureStyles = data.featureStyles;
                });
            } else {
                promise = $.Deferred().resolve();
            }

            promise.then(function () {
                return widget.query('getConfiguration');
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

            schema.menu.deactivateControls();


        },


        activateContextMenu: function () {
            var schema = this;
            var widget = schema.widget;

            widget.allowUseMapContextMenu = schema.mapContextMenu.allowUseContextMenu;
            widget.buildMapContextMenu = schema.mapContextMenu.buildContextMenu;

            widget.allowUseElementContextMenu = schema.elementContextMenu.allowUseContextMenu;
            widget.buildElementContextMenu = schema.elementContextMenu.buildContextMenu;

        },

        createToolset: function () {
            var schema = this;

            return schema.toolset && !_.isEmpty(schema.toolset) ? schema.toolset : Mapbender.Digitizer.Utilities.getDefaultToolsetByGeomType(schema.featureType.geomType);
        },


        refreshOtherLayersAfterFeatureSave: function (feature) {
            var schema = this;

            var scheme = schema.getSchemaByFeature(feature);

            if (scheme.refreshLayersAfterFeatureSave) {

                _.each(scheme.refreshLayersAfterFeatureSave, function (layerInstanceId) {
                    var layers = Mapbender.layerManager.getLayersByInstanceId(layerInstanceId);
                    _.each(layers, function (layer) {
                        Mapbender.layerManager.refreshLayer(layer);
                    });
                });
            }

        },

        processFormItems: function (feature, dialog) {
            var schema = this;

            var scheme = schema.getSchemaByFeature(feature);

            var processedFormItems = scheme.formItems.process(feature, dialog, schema);

            return processedFormItems;
        },


        openFeatureEditDialog: function (feature) {
            var schema = this;
            schema.popup.createFeatureEditDialog(feature, schema);
        },


        mapHasActiveControlThatBlocksSelectControl: function () {
            var schema = this;
            var widget = schema.widget;
            var map = widget.map;

            return !!_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true});
        },


        reloadFeatures: function () {
            var schema = this;
            var widget = schema.widget;
            var layer = schema.layer;
            var features = schema.getLayerFeatures();


            layer.removeAllFeatures();
            layer.addFeatures(features);

            schema.menu.resultTable.redrawResultTableFeatures(features);

            if (widget.options.__disabled) {
                widget.deactivate();
            }
        },


        addSpecificOptionToSelector: function () {
            var schema = this;
            var option = $("<option/>");
            option.val(schema.schemaName).html(schema.label);
            option.data("schemaSettings", schema);
            schema.appendSpecificOptionToSelector(option);
        },

        appendSpecificOptionToSelector: function (option) {
            var schema = this;
            var widget = schema.widget;
            var selector = widget.selector;
            selector.append(option);

        },


        setModifiedState: function (feature, control) {

            var schema = this;
            $(schema.frame).find(".save-all-features").addClass("active");

            var row = schema.menu.resultTable.getTableRowByFeature(feature);
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

            if (schema.getUnsavedFeatures().length === 0) {
                $(schema.frame).find(".save-all-features").removeClass("active");
            }

            var row = schema.menu.resultTable.getTableRowByFeature(feature);
            if (!row) {
                return; // in case of non-saved feature
            }
            row.find('.button.save').removeClass("active").attr('disabled', 'disabled');


        },


        // Overwrite
        getStyleMapOptions: function (label) {
            return {};
        },


        openChangeStyleDialog: function (feature) {
            var schema = this;

            var createDefaultSymbolizer = function (feature) {
                return schema.layer.styleMap.styles.default.createSymbolizer(feature);
            };

            var styleOptions = {
                data: schema.featureStyles[feature.fid] || createDefaultSymbolizer(feature),
                commonTab: false
            };

            var styleEditor = new Mapbender.Digitizer.FeatureStyleEditor(feature, schema, styleOptions);
        },

        // TODO test this.
        extendSearchRequest: function (basicRequest) {
            var schema = this;
            var search = schema.search;
            var request = _.clone(basicRequest);

            if (!search.request) {
                return false;
            }

            if (search.request) {
                request.search = search.request;
            }

            if (search.mandatory) {

                var hasError = Object.keys(search.mandatory).some(function(key) {
                    var mandatoryNotInRequest = !search.request[key];
                    var mandatoryDoesNotMatchRegExp = !(search.request[key]).toString().match(new RegExp(search.mandatory[key], "mg"));
                    return mandatoryNotInRequest || mandatoryDoesNotMatchRegExp;
                });

                if (hasError) {
                    schema.removeAllFeatures();
                    schema.lastRequest = null;
                    return false;
                }
            }

            return request;

        },


        getData: function (callback) {
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
            } else if (schema.lastRequest === JSON.stringify(request)) {
                return;
            }

            schema.lastRequest = JSON.stringify(request);

            if (schema.search) {
                request = schema.extendSearchRequest(request);
                if (!request) {
                    return;
                }
            }

            if (schema.search && !isExtentOnly) {
                schema.removeAllFeatures();
            }

            if (schema.xhr) {
                schema.xhr.abort();
            }

            schema.xhr = widget.query('select', request).done(function (featureCollection) {
                schema.onFeatureCollectionLoaded(featureCollection, this);
                if (callback) {
                    callback.apply();
                }
            });

            return schema.xhr;
        },


        getVisibleFeatures: function () {
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


        mergeExistingFeaturesWithLoadedFeatures: function (newFeatures) {
            var schema = this;

            var existingFeatures = schema.getVisibleFeatures();


            var newFeaturesFiltered = _.filter(newFeatures, function (nFeature) {
                return !existingFeatures.some(function (oFeature) {
                    return nFeature.equals(oFeature);
                });
            });

            var features = _.union(newFeaturesFiltered, existingFeatures);
            return features;

        },

        onFeatureCollectionLoaded: function (featureCollection, xhr) {
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

            schema.layer.features = schema.group === "all" ? newFeatures : schema.mergeExistingFeaturesWithLoadedFeatures(newFeatures);

            schema.reloadFeatures();
        },

        // Overwrite
        getLayerFeatures: function () {
            var schema = this;
            return schema.layer.features;
        },

        removeFeatureFromUI: function (feature) {
            var schema = this;
            schema.layer.features = _.without(schema.getLayerFeatures(), feature);
            schema.reloadFeatures();
            schema.refreshOtherLayersAfterFeatureSave(feature);
        },

        removeAllFeatures: function () {
            var schema = this;
            schema.layer.removeAllFeatures();
        },


        removeFeature: function (feature) {
            var schema = this;
            var widget = schema.widget;

            if (feature.isNew) {
                schema.removeFeatureFromUI(feature);
            } else {
                Mapbender.confirmDialog({
                    html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
                    onSuccess: function () {
                        widget.query('delete', {
                            schema: schema.getSchemaByFeature(feature).schemaName,
                            feature: feature.attributes
                        }).done(function (fid) {
                            schema.removeFeatureFromUI(feature);
                            $.notify(Mapbender.DigitizerTranslator.translate('feature.remove.successfully'), 'info');
                        });
                    }
                });
            }

            return feature;
        },


        copyFeature: function (feature) {
            var schema = this;
            var featureSchema = schema.getSchemaByFeature(feature);

            var layer = schema.layer;
            var newFeature = feature.clone();
            var defaultAttributes = featureSchema.copy.data || {};
            var allowCopy = true;

            // Feature must be removed and added for z-indexing
            layer.removeFeatures([feature]);

            layer.addFeatures([feature,newFeature]);

            _.each(schema.evaluatedHooksForCopyPrevention, function (allowCopyForFeature) {
                allowCopy = allowCopy && (allowCopyForFeature(feature));
            });

            if (!allowCopy) {
                $.notify(Mapbender.DigitizerTranslator.translate('feature.clone.on.error'));
                return;
            }

            var newAttributes = _.extend({}, defaultAttributes);

            _.each(feature.attributes, function (v, k) {
                if (v !== '' && v !== null && k !== featureSchema.featureType.uniqueId) {

                    if (schema.copy.overwriteValuesWithDefault) {
                        newAttributes[k] = newAttributes[k] || v; // Keep default value when existing
                    } else {
                        newAttributes[k] = v;
                    }
                }

            });

            newFeature.data = newAttributes;
            schema.setModifiedState(newFeature);
            newFeature.isCopy = true;
            newFeature.layer = feature.layer;

            // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
            if (featureSchema.copy.moveCopy) {
                newFeature.geometry.move(featureSchema.copy.moveCopy.x, featureSchema.copy.moveCopy.y);
            }

            var name = featureSchema.featureType.name;
            newFeature.data[name] = "Copy of " + (feature.attributes[name] || feature.fid);

            delete newFeature.fid;
            newFeature.style = null;

            layer.drawFeature(newFeature);

            schema.openFeatureEditDialog(newFeature);

        },


        getSchemaByFeature: function () {
            var schema = this;
            return schema.getRestrictedVersion();
        },


        // TODO feature / option formData parameters are not pretty -> keep data in feature directly
        saveFeature: function (feature, formData) {
            var schema = this;
            var widget = schema.widget;
            var tableApi = schema.menu.resultTable.getApi();
            var wkt = new OpenLayers.Format.WKT().write(feature);
            var srid = widget.map.getProjectionObject().proj.srsProjNumber;

            var createNewFeatureWithDBFeature = function (feature, response) {

                var features = response.features;

                if (features.length === 0) {
                    console.warn("No Feature returned from DB Operation");
                    schema.removeFeatureFromUI(feature);
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

            };


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

            var promise = widget.query('save', {

                schema: schema.getSchemaByFeature(feature).schemaName,
                feature: request
            }).then(function (response) {

                if (response.hasOwnProperty('errors')) {
                    return;
                }


                schema.unsetModifiedState(feature);


                var newFeature = createNewFeatureWithDBFeature(feature, response);

                if (newFeature == null) {
                    console.warn("Creation of new Feature failed");
                    return;
                }

                newFeature.isNew = false;

                schema.removeFeatureFromUI(feature);

                schema.layer.removeFeatures([feature]);
                schema.layer.addFeatures([newFeature]);

                schema.reloadFeatures();


                schema.menu.resultTable.refreshFeatureRowInDataTable(newFeature);

                $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully"), 'info');


                schema.tryMailManager(newFeature);


                var successHandler = function() {
                    var scheme = schema.getSchemaByFeature(feature);
                    var successHandler = scheme.save && scheme.save.on && scheme.save.on.success;
                    if (successHandler) {
                        eval(successHandler);
                    }
                };

                successHandler();

                schema.refreshOtherLayersAfterFeatureSave(feature);

                schema.refreshConnectedDigitizerFeatures();

                return response;

            });

            return promise;

        },


        refreshConnectedDigitizerFeatures: function () {
            var schema = this;
            var widget = schema.widget;

            if (schema.refreshFeaturesAfterSave) {
                _.each(schema.refreshFeaturesAfterSave, function (schemaName, index) {
                    widget.refreshConnectedDigitizerFeatures(schemaName);
                })
            }
        },

        tryMailManager: function (feature) {
            var schema = this;
            if (schema.mailManager && Mapbender.hasOwnProperty("MailManager")) {
                try {
                    Mapbender.MailManager[schema.mailManager](feature);
                } catch (e) {
                    console.warn('The function' + schema.mailManager + " is not supported by the Mapbender Mail Manager Extension");
                }
            }
        },

        getUnsavedFeatures: function () {
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
                return;
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

            schema.menu.resultTable.getApi().draw();

        },

        toggleFeatureVisibility: function (feature) {
            var schema = this;
            var layer = schema.layer;

            feature.visible = !feature.visible;

            layer.drawFeature(feature);
            schema.menu.resultTable.getApi().draw();


        },


        getDefaultProperties: function () {
            var schema = this;

            var newFeatureDefaultProperties = [];
            $.each(schema.tableFields, function (fieldName) {
                newFeatureDefaultProperties.push(fieldName);
            });
            return newFeatureDefaultProperties;
        },


        exportGeoJson: function (feature) {
            var schema = this;
            var widget = schema.widget;
            widget.query('export', {
                schema: schema.getSchemaByFeature(feature).schemaName,
                feature: feature,
                format: 'GeoJSON'
            }).done(function (response) {

            });
        },


        // TODO seperate Feature Info calls for individual properties in order to avoid iterating through meaningless dataSets
        getRemotePropertyValue: function (feature, property) {
            var schema = this;
            var widget = schema.widget;
            var map = widget.map;

            if (!feature.geometry) {
                return false;
            }

            var bbox = feature.geometry.getBounds();
            bbox.right = parseFloat(bbox.right + 0.00001);
            bbox.top = parseFloat(bbox.top + 0.00001);
            bbox = bbox.toBBOX();
            var srid = map.getProjection().replace('EPSG:', '');

            var ajaxCall = widget.query('getFeatureInfo', {
                bbox :bbox,
                schema: schema.getSchemaByFeature(feature).schemaName,
                srid: srid
            });


            // Mock:
            // ajaxCall = $.Deferred().resolve({dataSets: ['{"type":"FeatureCollection","totalFeatures":"unknown","features":[  {"type":"Feature","id":"","geometry":null,"properties":{    "elevation_base":844}  }],"crs":null}',
            //     '  {  "type": "FeatureCollection",  "features": [  {  "type": "Feature",  "geometry": null,  "properties": {  "OBJECTID": "78290",  "KG_NUMMER": "75204",  "KG_NAME": "Gschriet",  "INSPIREID": "AT.0002.I.4.KG.75204"  },  "layerName": "1"  }  ]  }  ']});

            return ajaxCall.then(function (response) {
                if (response.error) {
                    Mapbender.error(Mapbender.DigitizerTranslator.translate('remoteData.error'));
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
                Mapbender.error(Mapbender.DigitizerTranslator.translate("remoteData.error"));

            });


        },


        getRestrictedVersion: function () {
            var schema = this;

            return { // This is a narrowed version of Scheme when accessed by Feature. Helpful for Debugging
                schemaName: schema.schemaName,
                formItems: schema.formItems,
                allowDelete: schema.allowDelete,
                featureType: schema.featureType,
                index: schema.index,
                popup: schema.popup,
                allowDeleteByCancelNewGeometry: schema.allowDeleteByCancelNewGeometry,
                copy: schema.copy,

            };

        },


    };


})();
