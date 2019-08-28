(function () {
    "use strict";

    Mapbender.Digitizer.Scheme = function (rawScheme, widget, index) {
        var schema = this;
        schema.index = index;
        schema.widget = widget;
        $.extend(schema, rawScheme);

        /**
         *  Backward Compatibility
         */
        if (!rawScheme.currentExtentSearch && rawScheme.searchType) {
            schema.currentExtentSearch = rawScheme.searchType === "current";
        }

        var styleLabels = ['default', 'select', 'unsaved', 'invisible', 'labelText', 'labelTextHover', 'copy'];

        schema.inject();

        var initializeHooksForControlPrevention = function () {
            _.each(schema.hooks, function (value, name) {
                if (!value) {
                    return false;
                }
                console.error("Using Javascript code in the configuration is deprecated");


                try {
                    schema.evaluatedHooksForControlPrevention[name] = function (feature) {
                        var control = this;
                        var attributes = feature.attributes;
                        return eval(value);
                    }
                } catch (e) {
                    console.warn("Evaluation of control prevention hooks failed!", value, e);
                }
            });
        };

        var initializeHooksForCopyPrevention = function () {
            _.each(schema.copy.rules, function (value, name) {
                console.error("Using Javascript code in the configuration is deprecated");

                try {
                    schema.evaluatedHooksForCopyPrevention[name] = function (feature) {
                        var f = feature;
                        return eval(value);
                    }
                } catch (e) {
                    console.warn("Evaluation of copy prevention hooks failed!", value, e);
                }
            });

        };

        var initializeHooksForTableFields = function () {
            _.each(schema.tableFields, function (tableField, name) {
                if (tableField.render) {
                    console.error("Using Javascript code in the configuration is deprecated");
                    try {
                        eval("tableField.render = " + tableField.render);
                    } catch (e) {
                        console.warn("Evaluation of table field render hooks failed!", tableField.render, e);
                    }

                }
            });

        };


        var createPopupConfiguration = function () {
            schema.popup = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
        };



        var createMenu = function () {
            var widget = schema.widget;
            var element = $(widget.element);

            schema.menu = new Mapbender.Digitizer.Menu(schema);

            element.append(schema.menu.frame);

        };

        var createSchemaFeatureLayer = function () {

            var widget = schema.widget;
            var strategies = [];

            var createStyleMap = function () {


                var context = schema.getStyleMapContext();
                var styleMapObject = {};

                styleLabels.forEach(function (label) {
                    var options = schema.getStyleMapOptions(label);
                    options.context = context;
                    var styleOL = OpenLayers.Feature.Vector.style[label] || OpenLayers.Feature.Vector.style['default'];
                    styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, schema.getExtendedStyle(label)), options);
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

        var addSelectControls = function () {
            var layer = schema.layer;
            var widget = schema.widget;


            var selectControl = new OpenLayers.Control.SelectFeature(layer, {
                clickout: true,
                toggle: true,
                multiple: true,

                hover: true,

                openDialog: function (feature) {

                    if (schema.allowEditData || schema.allowOpenEditDialog) {
                        schema.openFeatureEditDialog(feature);
                    }
                },

                clickFeature: function (feature) {
                    if (schema.mapHasActiveControlThatBlocksSelectControl()) {
                        return;
                    }
                    this.openDialog(feature);
                    return Object.getPrototypeOf(this).clickFeature.apply(this, arguments);

                },

                overFeature: function (feature) {
                    this.highlight(feature);


                },
                outFeature: function (feature) {
                    this.unhighlight(feature);
                },

                highlight: function (feature) {
                    feature.isHighlighted = true;

                    console.assert(!!feature, "Feature must be set");
                    if (!schema.layer.features.includes(feature)) {
                        return;
                    }
                    schema.processFeature(feature, function (feature) {
                        schema.menu.resultTable.hoverInResultTable(feature, true);
                    });

                    layer.drawFeature(feature);
                    this.events.triggerEvent("featurehighlighted", {feature: feature});

                },
                unhighlight: function (feature) {

                    feature.isHighlighted = false;

                    if (!schema.layer.features.includes(feature)) {
                        return;
                    }
                    schema.processFeature(feature, function (feature) {
                        schema.menu.resultTable.hoverInResultTable(feature, false);
                    });


                    schema.layer.drawFeature(feature);
                    this.events.triggerEvent("featureunhighlighted", {feature: feature});

                }
            });


            // Workaround to move map by touch vector features
            selectControl.handlers && selectControl.handlers.feature && (selectControl.handlers.feature.stopDown = false);
            schema.selectControl = selectControl;

            widget.map.addControl(schema.selectControl);

        };


        initializeHooksForControlPrevention();

        initializeHooksForCopyPrevention();

        initializeHooksForTableFields();

        schema.initTableFields();

        schema.createFormItemsCollection();

        createPopupConfiguration();

        schema.toolset = schema.createToolset(); // Is overwritten and must therefore be implemented in the prototype

        styleLabels.forEach(function (label) {
            schema.styles[label] = _.isEmpty(schema.styles[label]) ? schema.widget.styles[label] : schema.styles[label];
        });

        if (schema.clustering) { // Move the clustering prototype just between the scheme and its native prototype
            var clusteringScheme = Mapbender.Digitizer.ClusteringSchemeMixin();
            var originalSchemePrototype = Object.getPrototypeOf(schema);
            Object.setPrototypeOf(schema, clusteringScheme);
            Object.setPrototypeOf(clusteringScheme, originalSchemePrototype);
        }

        createSchemaFeatureLayer();

        createMenu();

        addSelectControls();

        schema.menu.resultTable.initializeResultTableEvents(schema.selectControl, schema.doDefaultClickAction.bind(schema));

        schema.mapContextMenu = new Mapbender.Digitizer.MapContextMenu(schema);
        schema.elementContextMenu = new Mapbender.Digitizer.ElementContextMenu(schema);

        // use layerManager
        if (schema.refreshLayersAfterFeatureSave) {
            Mapbender.layerManager.setMap(schema.layer.map);
        }

        schema.initializeClustering && schema.initializeClustering();


        var assert = function () {
            console.assert(['polygon', 'line', 'point', "-"].includes(schema.featureType.geomType), "invalid geom Type: " + schema.featureType.geomType + " in schema " + schema.schemaName);
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

        evaluatedHooksForControlPrevention: {},
        evaluatedHooksForCopyPrevention: {},
        lastRequest: null,


        selectXHR: null,
        view: {
            type: null, // No implementation
            settings: null,
        },

        selectControl: null,
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
        allowSaveAll: false,
        markUnsavedFeatures: true,
        showLabel: false,
        allowOpenEditDialog: false,
        openDialogOnResultTableClick: false,
        zoomOnResultTableClick: true,

        displayOnSelect: true, // BEV only, no implementation

        label: null,
        allowDigitize: false,
        allowDelete: false,
        allowSave: true,
        allowSaveInResultTable: false,
        allowEditData: false,
        allowCustomStyle: false,
        allowChangeVisibility: false,
        allowDeleteByCancelNewGeometry: false,
        allowCancelButton: false,
        allowLocate: false,
        maxResults: 500,
        showExtendSearchSwitch: true,
        zoomScaleDenominator: 500,
        useContextMenu: true,
        displayPermanent: false,
        toolset: {},
        popup: {
            title: null,
            width: '350px',
            type: null,
        },
        styles: {
            default: {},
            select: {}
        },

        copy: {
            enable: false,
            rules: null,
            data: null,
            overwriteValuesWithDefault: false,
            moveCopy: null,
        },

        formItems: null,

        showVisibilityNavigation: true,
        allowPrintMetadata: false,
        printable: false,
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
        openFormAfterModification: true,
        pageLength: 10,
        currentExtentSearch: false,
        inlineSearch: true,
        hooks: {
            onModificationStart: null,
            onStart: null
        },
        refreshLayersAfterFeatureSave: [], // Layer list names/ids to be refreshed after feature save complete
        tableFields: null,
        clustering: null,

        featureVisibility: true,


        /**
         *  Can be overriden in specific digitizer instances
         */
        inject: function() {

        },

        getGeomType: function () {
            var schema = this;
            return schema.featureType.geomType;
        },

        getDefaultTableFields: function () {
            var schema = this;
            var tableFields = {};
            tableFields[schema.featureType.uniqueId] = {label: 'Nr.', width: '20%'};
            if (schema.featureType.name) {
                tableFields[schema.featureType.name] = {label: 'Name', width: '80%'};
            }
            return tableFields;

        },

        getStyleLabel: function(feature) {
            var schema = this;
            var label = schema.getSchemaByFeature(feature).featureType.name;
            return feature.attributes[label] || '';
        },

        getStyleMapContext: function () {
            var schema = this;
            return {
                webRootPath: Mapbender.Digitizer.Utilities.getAssetsPath(),

                feature: function (feature) {
                    return feature;
                },

                label: schema.getStyleLabel.bind(schema)
            }
        },

        getExtendedStyle: function (label) {
            var schema = this;
            return schema.styles[label];
        },

        initTableFields: function () {
            var schema = this;

            schema.tableFields = schema.tableFields || schema.getDefaultTableFields();

            _.each(schema.tableFields, function (tableField) {

                if (tableField.type === "image") {
                    tableField.render = function (imgName, renderType, feature, x) {
                        return $("<img style='width: 20px'/>").attr('src', Mapbender.Digitizer.Utilities.getAssetsPath(tableField.path + imgName))[0].outerHTML;
                    }
                }
            });
        },


        createFormItemsCollection: function (formItems) {
            var schema = this;
            schema.formItems = new Mapbender.Digitizer.FormItemsCollection(formItems || schema.formItems, schema);

        },


        updateConfigurationAfterSwitching: function (updatedSchemes) {
            var schema = this;
            schema.createFormItemsCollection(updatedSchemes[schema.schemaName].formItems); // Update formItems Of Schema when switiching
        },


        activateSchema: function (activateWidget) {

            var schema = this;

            var widget = schema.widget;
            var frame = schema.menu.frame;
            var layer = schema.layer;

            schema.lastRequest = null;

            widget.getCurrentSchema = function () {
                return schema;
            };

            var promise;

            if (schema.allowCustomStyle) {
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
                if (schema.widget.isFullyActive) {
                    schema.selectControl.activate();
                }
                schema.getData({
                    reloadNew: true
                });

            });

        },

        deactivateSchema: function (deactivateWidget) {
            var schema = this;
            var widget = schema.widget;
            var frame = schema.menu.frame;
            var layer = schema.layer;

            frame.hide();

            if ((deactivateWidget && !schema.widget.displayOnInactive) || (!deactivateWidget && !schema.displayPermanent)) {
                layer.setVisibility(false);
            }

            schema.selectControl.deactivate();

            if (widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

            schema.menu.deactivateControls();


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
            var layer = schema.layer;
            var features = schema.getLayerFeatures();

            layer.removeAllFeatures();
            layer.addFeatures(features);

            schema.menu.resultTable.redrawResultTableFeatures(features);

        },


        setModifiedState: function (feature, control) {

            var schema = this;
            $(schema.menu.frame).find(".save-all-features").addClass("active");

            var row = schema.menu.resultTable.getTableRowByFeature(feature);
            if (!row) {
                return; // In case of non-saved feature
            }
            feature.isChanged = true;

            row.find('.button.save').removeAttr("disabled");


            if (schema.getSchemaByFeature(feature).deactivateControlAfterModification) {
                control && control.deactivate();
            }

        },


        unsetModifiedState: function (feature) {

            var schema = this;

            feature.isChanged = false;
            feature.isNew = false;
            feature.isCopy = false;

            if (schema.getUnsavedFeatures().length === 0) {
                $(schema.menu.frame).find(".save-all-features").removeClass("active");
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

        // Overwrite
        extendFeatureStyleOptions: function(styleOptions) {
        },


        openChangeStyleDialog: function (feature) {
            var schema = this;

            var createDefaultSymbolizer = function (feature) {
                return schema.layer.styleMap.styles.default.createSymbolizer(feature);
            };

            var styleOptions = {
                data: schema.getFeatureStyle(feature.fid) || createDefaultSymbolizer(feature),
            };

            schema.extendFeatureStyleOptions(feature,styleOptions);

            var styleEditor = new Mapbender.Digitizer.FeatureStyleEditor(feature, schema, styleOptions);
        },


        /** override **/
        doReload: function() {
          return false;
        },


        repopulateWithReloadedFeatures: function (forcedReload, zoom) {
            var schema = this;
            var doReload = (schema.doReload() || schema.group === "all") && (!zoom);
            return doReload || forcedReload;
        },

        createRequest: function() {
            var schema = this;
            var widget = schema.widget;

            var map = widget.map;
            var projection = map.getProjectionObject();
            return {
                srid: projection.proj.srsProjNumber,
                maxResults: schema.maxResults,
                schema: schema.schemaName,
            }

        },

        getData: function (options) {
            var schema = this;
            var widget = schema.widget;

            var map = widget.map;
            var extent = map.getExtent();

            var callback = options && options.callback;

            var reloadNew = schema.repopulateWithReloadedFeatures(options && options.reloadNew, options && options.zoom);

            var request = schema.createRequest();

            if (schema.currentExtentSearch) {
                request.intersectGeometry = extent.toGeometry().toString();
            }

            if (!schema.currentExtentSearch && schema.lastRequest === JSON.stringify(request)) {
                return $.Deferred().reject();
            }


            schema.lastRequest = JSON.stringify(request);


            if (schema.selectXHR && schema.selectXHR.abort) {
                schema.selectXHR.abort();
            }


            schema.selectXHR = widget.query('select', request).then(function (featureCollection) {
                var xhr = this;
                schema.onFeatureCollectionLoaded(featureCollection, reloadNew, xhr);
                if (typeof callback === "function") {
                    callback.apply();
                }
                schema.selectXHR = null;
            });

            return schema.selectXHR;
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


        onFeatureCollectionLoaded: function (featureCollection, newFeaturesOnly, xhr) {
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

            if (newFeaturesOnly) {
                schema.removeAllFeatures();
                schema.layer.features = newFeatures;
            } else {
                schema.layer.features = schema.mergeExistingFeaturesWithLoadedFeatures(newFeatures);
            }


            schema.layer.features.forEach(function (feature) {
                schema.introduceFeature(feature);
            });

            schema.reloadFeatures();

            schema.setVisibilityForAllFeaturesInLayer();
        },

        setStyleProperties: function (feature) {
            var schema = this;

            var isGetter = function (obj, prop) {
                var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                return !!descriptor && !!descriptor['get'];
            };

            var usesSpecificStyle = function (feature) {
                return feature.visible && !feature.isHighlighted && !feature.isCopy && !feature.isChanged && !feature.isNew;
            };

            if (!isGetter(feature, 'style')) {

                Object.defineProperty(feature, 'style', {
                    get: function () {

                        var feature = this;
                        var style = usesSpecificStyle(feature) ? schema.getFeatureStyle(feature.fid) : null;

                        return style;
                    },
                    set: function (value) {
                        var feature = this;
                        feature._style = value; // is never used
                    }
                });
            }

            if (!isGetter(feature, 'renderIntent')) {


                Object.defineProperty(feature, 'renderIntent', {
                    get: function () {
                        var feature = this;
                        var renderIntent = "default";

                        if (feature.isChanged || feature.isNew) {
                            renderIntent = 'unsaved';
                        }

                        if (feature.isCopy) {
                            renderIntent = 'copy';
                        }

                        if (!feature.visible) {
                            renderIntent = 'invisible';
                        }

                        if (feature.isHighlighted) {
                            renderIntent = "select";
                        }
                        return renderIntent;
                    },
                    set: function (value) {
                        var feature = this;

                        feature._renderIntent = value; // is never used
                    }
                });
            }
        },

        getFeatureStyle: function (id) {
            var schema = this;
            return (schema.featureStyles && schema.featureStyles[id]) || null;
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
            if (feature.isNew || feature.isCopy) {
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
            schema.introduceFeature(newFeature);

            var defaultAttributes = featureSchema.copy.data || {};
            var allowCopy = true;

            // Feature must be removed and added for z-indexing
            layer.removeFeatures([feature]);

            layer.addFeatures([feature, newFeature]);

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
            newFeature.data[name] = newFeature.attributes[name] = "Copy of " + (feature.attributes[name] || feature.fid);

            delete newFeature.fid;
            delete newFeature[schema.featureType.uniqueId];

            layer.drawFeature(newFeature);

            schema.openFeatureEditDialog(newFeature);

        },


        getSchemaByFeature: function () {
            var schema = this;
            return schema.getRestrictedVersion();
        },

        introduceFeature: function (feature) {
            var schema = this;
            schema.setStyleProperties(feature);
            feature.mbOrigin = 'digitizer';
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

                feature.disabled = false; // feature is actually removed anyways

                if (response.errors) {

                    response.errors.forEach(function (error) {
                        console.error(error.message);
                        $.notify(error.message, {
                            title: 'API Error',
                            autoHide: false,
                            className: 'error'
                        });
                    });

                    return response;
                }


                schema.unsetModifiedState(feature);


                var newFeature = createNewFeatureWithDBFeature(feature, response);

                if (feature.saveStyleDataCallback) {
                    feature.saveStyleDataCallback(newFeature);
                    feature.saveStyleDataCallback = null;
                }

                if (newFeature == null) {
                    console.warn("Creation of new Feature failed");
                    return;
                }

                newFeature.isNew = false;

                schema.introduceFeature(newFeature);

                schema.removeFeatureFromUI(feature);
                schema.layer.addFeatures([newFeature]);

                schema.reloadFeatures();


                schema.menu.resultTable.refreshFeatureRowInDataTable(newFeature);

                $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully"), 'info');


                schema.tryMailManager(newFeature);


                var successHandler = function () {
                    var scheme = schema.getSchemaByFeature(feature);
                    var successHandler = scheme.save && scheme.save.on && scheme.save.on.success;
                    if (successHandler) {
                        console.error("Using Javascript code in the configuration is deprecated");
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
                return feature.isNew || feature.isChanged || feature.isCopy;
            });
        },


        // Overwrite
        processFeature: function (feature, callback) {
            callback(feature);
        },


        zoomToFeature: function (feature) {
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


        doDefaultClickAction: function (feature) {
            var schema = this;

            if (schema.zoomOnResultTableClick){
                schema.zoomToFeature(feature);
            }
            if (schema.openDialogOnResultTableClick) {
                schema.openFeatureEditDialog(feature);
            }

        },


        setVisibilityForAllFeaturesInLayer: function () {
            var schema = this;
            var layer = schema.layer;

            layer.features.forEach(function (feature) {

                feature.toggleVisibility(schema.featureVisibility);
                layer.drawFeature(feature);
            });

            schema.menu.resultTable.getApi().draw();

        },

        toggleFeatureVisibility: function (feature) {
            var schema = this;
            var layer = schema.layer;

            feature.toggleVisibility(!feature.visible);

            layer.drawFeature(feature);
            schema.menu.resultTable.getApi().draw();


        },

        /** Override **/
        updateAfterMove: function() {

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

        getRestrictedVersion: function () {
            var schema = this;

            return { // This is a narrowed version of Scheme when accessed by Feature. Helpful for Debugging
                schemaName: schema.schemaName,
                formItems: schema.formItems,
                allowDelete: schema.allowDelete,
                featureType: schema.featureType,
                index: schema.index,
                popup: schema.popup,
                allowPrintMetadata: schema.allowPrintMetadata,
                allowDeleteByCancelNewGeometry: schema.allowDeleteByCancelNewGeometry,
                copy: schema.copy,
                openFormAfterEdit: schema.openFormAfterEdit,
                revertChangedGeometryOnCancel: schema.revertChangedGeometryOnCancel


            };

        },


    };


})();
