var Scheme = function (rawScheme, widget) {
    /** @type {Scheme} */
    var schema = this;

    schema = $.extend(schema, rawScheme);

    schema.formItems = Mapbender.DigitizerTranslator.translateStructure(schema.formItems);

    schema._initializeHooks();

    schema.setModifiedState = Scheme.prototype.setModifiedState.bind(this); // In order to achive arrow-function like "this" behaviour

    schema.widget = widget;

    schema.toolset = schema.createToolset();

    schema.createSchemaFeatureLayer();

    schema._createFrame();

    schema._addSelectControl();

    schema.initializeResultTableEvents();

    schema.layer.getClusteredFeatures = function () {
        return _.flatten(_.pluck(this.features, "cluster"));
    };

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
    mapContextMenu: null,
    elementContextMenu: null,




    allowSaveAll: true,
    markUnsavedFeatures: true,
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
    style: {},
    formItems: null,
    events: null,
    selectControl: null,
    featureStyles: null,
    search: null,
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
    refreshFeaturesAfterSave: false,
    olFeatureCloudPopup: null,
    mailManager: null,
    tableTranslation: null,
    copy: {
        enable: true,
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

    tableFields: {
        gid: { // TODO make sure this fields name is either always gid or find a more generic solution
            label: 'Nr.',
            width: "20%",
        },
        name: {
            label: 'Name',
            width: "80%",
        },

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


    activateContextMenu: function () {
        var schema = this;
        var widget = schema.widget;

        widget.allowUseMapContextMenu = schema.mapContextMenu.allowUseContextMenu;
        widget.buildMapContextMenu = schema.mapContextMenu.buildContextMenu;

        widget.allowUseElementContextMenu = schema.elementContextMenu.allowUseContextMenu;
        widget.buildElementContextMenu = schema.elementContextMenu.buildContextMenu;

    },

    createToolset: function() {
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

    getTableWidget: function () {
        var schema = this;
        var $table = schema.table;
        return $table.data('visUiJsResultTable');
    },


    getDefaultFormItems: function () {

        var formItems = [];
        _.each(feature.data, function (value, key) {
            formItems.push({
                type: 'input',
                name: key,
                title: key
            })
        });

        return formItems;
    },

    /**
     * @Overwrite
     */
    getFormItems: function (feature) {
        var schema = this;
        var formItems = (schema.formItems && schema.formItems.length > 0) ? schema.formItems : schema.getDefaultFormItems(feature);
        return formItems;
    },


    /**
     * Open edit feature dialog
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
     * @private
     */

    _openFeatureEditDialog: function (olFeature) {
        var schema = this;
        var dialog = new FeatureEditDialog(olFeature,schema.popup,schema);

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
            schema.toggleFeatureVisibility(feature, !invisible);
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
            features = layer.getClusteredFeatures();
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

        var table = schema.table;
        var tableApi = table.resultTable('getApi');
        var nodes = tableApi.rows(function (idx, data, row) {
            var isInvisible = data.renderIntent === 'invisible';
            if (isInvisible) {
                var $row = $(row);
                var visibilityButton = $row.find('.button.icon-visibility');
                visibilityButton.addClass('icon-invisibility');
                $row.addClass('invisible-feature');
            }
            return true;
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

        widget.activeLayer = schema.layer;
        widget.currentSchema = schema;

        schema.activateContextMenu();

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

    _createFrame: function () {
        /** @type {Scheme} */
        var schema = this;
        var widget = schema.widget;
        var element = $(widget.element);

        var sidebar = new Sidebar(schema);

        schema.frame = sidebar.frame;
        element.append(sidebar.frame);

    },


    _getTableRowByFeature: function (feature) {
        var schema = this;
        var table = schema.table;
        var tableWidget = table.data('visUiJsResultTable');
        var row = tableWidget.getDomRowByData(feature);
        return row;
    },

    setModifiedState: function (feature, control) {
        var schema = this;

        var row = schema._getTableRowByFeature(feature);
        if (!row) {
            feature.isNew = true;
            return; // In case of non-saved feature
        }
        feature.isChanged = true;

        row.find('.button.save').removeClass("disabled").addClass('active');

        $(schema.frame).find(".save-all-features").addClass("active");

        control && control.deactivate();

    },


    unsetModifiedState: function (feature) {
        var schema = this;

        var row = schema._getTableRowByFeature(feature);

        row.find('.button.save').removeClass("active").addClass('disabled');

        if (schema._getUnsavedFeatures().length === 0) {
            $(schema.frame).find(".save-all-features").removeClass("active");
        }

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
        console.warn("Fake form data for feature", feature);
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


    _createStyleMap: function (labels, styleContext) {
        var schema = this;
        var widget = schema.widget;
        var styleMapObject = {};

        labels.forEach(function (label) {
            var styleOL = OpenLayers.Feature.Vector.style[label] || OpenLayers.Feature.Vector.style['default'];
            styleMapObject[label] = new OpenLayers.Style($.extend({}, styleOL, schema.styles[label] || widget.styles[label]), styleContext);
        });

        if (!schema.markUnsavedFeatures) {
            styleMapObject.unsaved = styleMapObject.default;
        }
        return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});

    },


    _createFeatureLayerStyleMap: function () {

        // TODO find out what this is for
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

        // TODO maybe place this somewhere in a more public scope
        var labels = ['default', 'select', 'selected', 'unsaved', 'invisible', 'labelText', 'labelTextHover', 'copy'];

        var styleMap = this._createStyleMap(labels, styleContext);

        return styleMap;

    },

    // DO Nothing: This methdod is overwritten
    redesignLayerFunctions: function () {

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

        if (schema.maxScale) {
            layer.options.maxScale = schema.maxScale;
        }
        if (schema.minScale) {
            layer.options.minScale = schema.minScale;
        }
        schema.layer = layer;

        this.redesignLayerFunctions();

        widget.map.addLayer(schema.layer);

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

    // TODO refactor this
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
        var existingFeatures = schema.isClustered ? layer.getClusteredFeatures() : layer.features;
        var visibleFeatures = currentExtentOnly ? _.filter(existingFeatures, function (olFeature) {
            return olFeature && (olFeature.isNew || olFeature.geometry.getBounds().intersectsBounds(bbox));
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


        // TODO find out what this is for
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


    _removeFeatureFromUI: function (olFeature) {
        var schema = this;
        var layer = schema.layer;

        var existingFeatures = schema.isClustered ? layer.getClusteredFeatures() : layer.features;
        schema.reloadFeatures(_.without(existingFeatures, olFeature));

        schema._refreshOtherLayersAfterFeatureSave();
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

        var featureData = olFeature.attributes;


        if (olFeature.isNew) {
            schema._removeFeatureFromUI(olFeature);
        } else {
            Mapbender.confirmDialog({
                html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
                onSuccess: function () {
                    QueryEngine.query('delete', {
                        schema: schema.getSchemaName(olFeature),
                        feature: featureData
                    }).done(function (fid) {
                        schema._removeFeatureFromUI(olFeature);
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
        var newFeature = feature.clone();
        var config = schema.copy;
        var defaultAttributes = config.data || {};

        _.each(schema.copy.rules, function (ruleCode) {
            var f = feature;
            eval('allowCopy = ' + ruleCode + ';');
            if (!allowCopy) {
                return false;
            }
        });

        var newAttributes = _.extend({}, defaultAttributes);

        _.each(feature.attributes, function (v, k) {
            if (v !== '' && v !== null) {
                newAttributes[k] = v;
            }

        });

        newFeature.data = newAttributes;
        newFeature.isNew = true;
        newFeature.layer = feature.layer;

        delete newFeature.fid;

        newFeature.redraw('copy');

        schema._openFeatureEditDialog(newFeature);

    },


    getSchemaName: function () {
        var schema = this;
        return schema.schemaName;
    },

    getSchemaByFeature: function () {
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
        newFeature.renderIntent = feature.renderIntent;
        newFeature.styleId = feature.styleId;

        return newFeature;

    },

    /**
     * On save button click
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature OpenLayers feature
     * @param formData
     * @private
     * @return {(jQuery.jqXHR | void)} ajax XHR
     */
    saveFeature: function (feature, formData) {
        var schema = this;
        var widget = schema.widget;
        var table = schema.table;
        var tableApi = table.resultTable('getApi');
        var wkt = new OpenLayers.Format.WKT().write(feature);
        var srid = widget.map.getProjectionObject().proj.srsProjNumber;


        if (feature.disabled) { // Feature is temporarily disabled
            return;
        }

        feature.disabled = true;

        formData = formData || schema.initialFormData(feature);

        var request = {
            id: feature.isNew ? null : feature.fid,
            properties: formData,
            geometry: wkt,
            srid: srid,
            type: "Feature"
        };

        // TODO check this
        tableApi.draw({"paging": "page"});

        var promise = QueryEngine.query('save', {

            schema: schema.getSchemaName(feature),
            feature: request
        }).done(function (response) {

            if (response.hasOwnProperty('errors')) {
                return;
            }

            if (!feature.isNew) {
                schema.unsetModifiedState(feature);
            }

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


            schema._refreshFeatureRowInDataTable(newFeature);

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

    _refreshFeatureRowInDataTable: function (feature) {
        var schema = this;
        var table = schema.table;
        var tableWidget = table.data('visUiJsResultTable');
        var tableApi = table.resultTable('getApi');

        tableApi.row(tableWidget.getDomRowByData(feature)).invalidate();
        tableApi.draw();
    },

    _refreshConnectedDigitizerFeatures: function () {
        var schema = this;

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

        var olMap = widget.map;
        var geometry = feature.geometry;

        olMap.zoomToExtent(geometry.getBounds());
        if (schema.hasOwnProperty('zoomScaleDenominator')) {
            olMap.zoomToScale(schema.zoomScaleDenominator, true);
        }
    },


    _zoomOrOpenDialog: function (feature) {
        var schema = this;

        var isOpenLayerCloudPopup = schema.popup && schema.popup.type && schema.popup.type === 'openlayers-cloud';

        if (isOpenLayerCloudPopup) {
            schema._openFeatureEditDialog(feature);
        } else {
            schema.zoomToJsonFeature(feature);
        }
    },

    initializeResultTableEvents: function () {
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

    _toggleVisibility: function (on) {
        var schema = this;
        schema.layer.features.forEach(function (feature) {
            schema.toggleFeatureVisibility(feature, on);

        });

    },

    toggleFeatureVisibility: function (feature, on) {
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
                schema._openFeatureEditDialog(feature);
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
            schema._openFeatureEditDialog(feature);
        } else {
            schema.widget.currentPopup.formData(feature.data);
        }


    },

    /**
     * Open feature edit dialog
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     */
    exportGeoJson: function (feature) {
        var schema = this;
        QueryEngine.query('export', {
            schema: schema.getSchemaName(feature),
            feature: feature,
            format: 'GeoJSON'
        }).done(function (response) {

        });
    }

};