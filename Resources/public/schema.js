(function () {
    "use strict";

    Mapbender.Digitizer.Scheme = function (rawScheme, widget) {
        var schema = this;
        schema.widget = widget;

        $.extend(schema, rawScheme);

        /**
         *  Backward Compatibility
         */

        if (!rawScheme.currentExtentSearch && rawScheme.searchType) {
            schema.currentExtentSearch = rawScheme.searchType === "currentExtent";
        }
        this.setup();
    };
Mapbender.Digitizer.Scheme.prototype = {
    getRenderIntents: function() {
        return ['default', 'select', 'unsaved', 'invisible', 'labelText', 'labelTextHover', 'copy'];
    },
    createStyleMap: function() {
            var schema = this;

                var styleMapObject = {};

                this.getRenderIntents().forEach(function (label) {
                    var options = schema.getStyleMapOptions(label);
                    var styleOL = OpenLayers.Feature.Vector.style[label] || OpenLayers.Feature.Vector.style['default'];
                    var styleOptions = Object.assign({}, styleOL, schema.styles[label]);
                    if (schema.clusteringLabel) {
                        styleOptions.label = '${label}';
                    }

                    styleMapObject[label] = new OpenLayers.Style(styleOptions, options);
                });

                if (!schema.markUnsavedFeatures) {
                    styleMapObject.unsaved = styleMapObject.default;
                }
                return new OpenLayers.StyleMap(styleMapObject, {extendDefault: true});
    },
    createLayer: function() {
        var schema = this;
            var styleMap = this.createStyleMap();

            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap: styleMap,
                name: schema.label,
                visibility: false,
                rendererOptions: {zIndexing: true}
            });

            if (schema.maxScale) {
                layer.options.maxScale = schema.maxScale;
            }
            if (schema.minScale) {
                layer.options.minScale = schema.minScale;
            }
            return layer;
    },
    createSelectControl: function(layer) {
        var schema = this;
            var widget = this.widget;

            var selectControl = new OpenLayers.Control.SelectFeature(layer, {
                clickout: true,
                toggle: true,
                multiple: true,

                hover: true,

                clickFeature: function(feature) {
                    var activeModifyControls = widget.map.getControlsByClass('OpenLayers.Control.ModifyFeature').filter(function(control) {
                        return control.active;
                    });
                    if (activeModifyControls.length) {
                        return;
                    }

                    widget.onMapFeatureClick(schema, feature);
                    return OpenLayers.Control.SelectFeature.prototype.clickFeature.apply(this, arguments);
                },
                eventListeners: {
                    'featurehighlighted': function(evt) {
                        var feature = evt.feature;
                        feature.isHighlighted = true;
                        if (!schema.disableFeatureHighlightInResultTable && feature.__tr__) {
                            $(feature.__tr__).addClass('hover');
                            schema.menu.pageToRow(feature.__tr__);
                        }
                        if (feature.layer) {
                            feature.layer.drawFeature(feature);
                        }
                    },
                    'featureunhighlighted': function(evt) {
                        var feature = evt.feature;
                        feature.isHighlighted = false;
                        if (feature.__tr__) {
                            $(feature.__tr__).removeClass('hover');
                        }
                        if (feature.layer) {
                            feature.layer.drawFeature(feature);
                        }
                    }
                }
            });


            // Workaround to move map by touch vector features
            selectControl.handlers.feature.stopDown = false;
            return selectControl;
    },
    setup: function() {
        var schema = this;

        schema.initTableFields();

        schema.toolset = schema.createToolset(); // Is overwritten and must therefore be implemented in the prototype

        this.getRenderIntents().forEach(function (label) {
            schema.styles[label] = _.isEmpty(schema.styles[label]) ? schema.widget.styles[label] : schema.styles[label];
        });

        if (schema.clustering) { // Move the clustering prototype just between the scheme and its native prototype
            var clusteringScheme = Mapbender.Digitizer.ClusteringSchemeMixin();
            var originalSchemePrototype = Object.getPrototypeOf(schema);
            Object.setPrototypeOf(schema, clusteringScheme);
            Object.setPrototypeOf(clusteringScheme, originalSchemePrototype);
        }

        this.layer = this.createLayer();
        this.widget.map.addLayer(this.layer);
        this.menu = new Mapbender.Digitizer.Menu(schema);
        this.widget.element.append(schema.menu.frame);

        this.selectControl = this.createSelectControl(this.layer);
        this.widget.map.addControl(this.selectControl);

        schema.menu.initializeTableEvents(schema);

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

    },


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

        evaluatedHooksForControlPrevention: {},
        evaluatedHooksForCopyPrevention: {},
        lastRequest: null,


        selectXHR: null,

        selectControl: null,
        clusterStrategy: null,


        //* Newly added properties
        disableFeatureHighlightInResultTable: false,
        revertChangedGeometryOnCancel: false,
        deactivateControlAfterModification: true,
        allowSaveAll: false,
        markUnsavedFeatures: true,
        showLabel: false,
        allowOpenEditDialog: false,
        openDialogOnResultTableClick: false,
        zoomOnResultTableClick: true,
        allowRefresh: true,
        disableAggregation: false,
        notifyOnFeatureOverflow: false,
        allowViewData: true,


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
        showExtendSearchSwitch: true,
        zoomScaleDenominator: 500,
        useContextMenu: true,
        displayPermanent: false,
        toolset: {},
        popup: {
            title: null,
            width: '350px',
            type: null
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
            moveCopy: null
        },

        formItems: null,

        showVisibilityNavigation: true,
        allowPrintMetadata: false,
        printable: false,
        maxScale: null,
        minScale: null,
        // group: null,
        // oneInstanceEdit: true,
        //zoomDependentVisibility: [{max: 10000}],
        refreshFeaturesAfterSave: null,
        tableTranslation: null,
        save: {}, // pop a confirmation dialog when deactivating, to ask the user to save or discard current in-memory changes
        openFormAfterEdit: true,
        openFormAfterModification: false,
        pageLength: 10,
        currentExtentSearch: false,
        inlineSearch: true,
        refreshLayersAfterFeatureSave: [], // Layer list names/ids to be refreshed after feature save complete
        tableFields: null,
        clustering: null,

        featureVisibility: true,
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

        getStyleLabel: function (feature) {
            var feature_;
            if (feature.cluster) {
                if (feature.cluster.length > 1) {
                    return '' + feature.cluster.length;
                }
                feature_ = feature.cluster[0];
            } else {
                feature_ = feature;
            }
            var schema = this.getSchemaByFeature(feature_);
            return feature_.attributes[schema.featureType.name] || '';
        },

        initTableFields: function () {
            var schema = this;

            schema.tableFields = schema.tableFields || schema.getDefaultTableFields();

            _.each(schema.tableFields, function (tableField,index) {

                if (tableField.type === "image") {
                    tableField.render = function (imgName, renderType, feature, x) {
                        return $("<img style='width: 20px'/>").attr('src', Mapbender.Digitizer.Utilities.getAssetsPath(tableField.path + imgName))[0].outerHTML;
                    }
                }

                if (tableField.type == "datetime") {
                    tableField.data = function(feature) {
                        var d = new Date(feature.data[index]);
                        var formatted = moment(d).format(tableField.format);
                        return formatted;
                    }
                }
            });
        },
        createToolset: function () {
            var schema = this;

            return schema.toolset && !_.isEmpty(schema.toolset) ? schema.toolset : [];
        },

        openFeatureEditDialog: function (feature) {
            var feature_ = feature.cluster && feature.cluster[0] || feature;
            var schema = this.getSchemaByFeature(feature_);
            if (schema.allowEditData || schema.allowViewData) {
                Mapbender.Digitizer.FeatureEditDialog.open(feature_, schema);
            }
        },


        reloadFeatures: function () {
            this.layer.redraw();
            var tableFeatures = this.layer.features.filter(function(feature) {
                return feature && !feature.cluster && !feature.isNew;
            });
            this.menu.replaceTableRows(tableFeatures);
        },

        setModifiedState: function (feature, state, control) {
            feature.isChanged = state;
            if (feature.isNew || feature.isCopy) {
                return; // In case of non-saved feature
            }
            $(this.menu.frame).find(".save-all-features").toggleClass('active', !!this.getUnsavedFeatures().length);

            if (feature.__tr__) {
                this.menu.updateRow($(feature.__tr__), feature);
            }

            if (control && state && this.getSchemaByFeature(feature).deactivateControlAfterModification) {
                control.deactivate();
            }

        },
        getStyleMapOptions: function (renderIntent) {
            var options = {
                context: {
                    webRootPath: Mapbender.Digitizer.Utilities.getAssetsPath(),
                    feature: function (feature) {
                        return feature;
                    },
                    label: this.getStyleLabel.bind(this)
                }
            };
            if (this.isAllScheme) {
                options.rules = _.map(this.widget.getBasicSchemes(), function(scheme) {
                    var styleRules = scheme.styles[renderIntent] || scheme.widget.styles[renderIntent];
                    return styleRules && new OpenLayers.Rule({
                        symbolizer: styleRules,
                        evaluate: function (feature) {
                            return feature.attributes.schemaName === scheme.schemaName;
                        }
                    });
                }).filter(function(rule) { return !!rule; });
            }

            return options;
        },

        // Overwrite
        extendFeatureStyleOptions: function (styleOptions) {
        },


        openChangeStyleDialog: function (feature) {
            var schema = this.getSchemaByFeature(feature);
            var styleOptions = {
                data: Object.assign({}, schema.styles.default, feature.__custom_style__ || {})
            };

            schema.extendFeatureStyleOptions(feature, styleOptions);

            var styleEditor = new Mapbender.Digitizer.FeatureStyleEditor(feature, schema, styleOptions);
        },


        createRequest: function () {
            var schema = this;
            var widget = schema.widget;

            var map = widget.map;
            var extent = map.getExtent();
            var projection = map.getProjectionObject();
            var intersectWKT = schema.currentExtentSearch && extent.toGeometry().toString() || null;

            return {
                srid: projection.proj.srsProjNumber,
                maxResults: schema.maxResults,
                schema: schema.schemaName,
                intersectGeometry: intersectWKT,    // Old / custom data-source quirk
                intersect: intersectWKT,            // Current standard data-source
                search: null
            }

        },

        onFeatureCollectionLoaded: function (features, options) {
            var schema = this;
            for (var i = 0; i < features.length; ++i) {
                this.introduceFeature(features[i]);
            }
            this.layer.removeAllFeatures();
            this.layer.addFeatures(features);

            schema.reloadFeatures();
            schema.setVisibilityForAllFeaturesInLayer();

            if (schema.clusterStrategy && options && options.zoom) {
                schema.updateClusterStrategy();
            }
            if (options && options.zoomToExtentAfterSearch) {
                this.widget.map.zoomToExtent(schema.layer.getDataExtent());
            }
        },

        setStyleProperties: function (feature) {
            var schema = this;

            var isGetter = function (obj, prop) {
                var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                return !!descriptor && !!descriptor['get'];
            };

            if (!isGetter(feature, 'style')) {
                Object.defineProperty(feature, 'style', {
                    get: function () {
                        if (this.renderIntent !== 'default') {
                            return null;
                        } else {
                            var style = schema.getFeatureStyle(this) || null;
                            if (style && style.label === '${label}') {
                                style.label = schema.getStyleLabel(this);
                            }
                            return style;
                        }
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

        getFeatureStyle: function(feature) {
            return feature.__custom_style__ || (feature.fid && this.widget.customStyles[feature.fid]) || null;
        },

        removeAllFeatures: function () {
            var schema = this;
            schema.layer.removeAllFeatures();
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
                $.notify(Mapbender.trans('mb.digitizer.feature.clone.on.error'));
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
            schema.setModifiedState(newFeature, true);
            newFeature.isNew = true;
            newFeature.isCopy = true;
            newFeature.layer = feature.layer;
            if (feature.__custom_style__) {
                newFeature.__custom_style__ = feature.__custom_style__;
            }

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
            return schema;
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
            var wkt = new OpenLayers.Format.WKT().write(feature);
            var srid = widget.map.getProjectionObject().proj.srsProjNumber;

            //if (schema.menu.toolSet.activeControl instanceof OpenLayers.Control.ModifyFeature) {
            schema.menu.toolSet.activeControl && schema.menu.toolSet.activeControl.deactivate();
            //}

            if (feature.disabled) { // Feature is temporarily disabled
                return;
            }

            feature.disabled = true;

            formData = formData || Mapbender.Digitizer.Utilities.createHeadlessFormData(feature, schema.getSchemaByFeature(feature).formItems);

            var request = {
                id: feature.isNew ? null : feature.fid,
                properties: formData,
                geometry: wkt,
                srid: srid,
                type: "Feature"
            };

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

                schema.setModifiedState(feature, false);
                var geometry = OpenLayers.Geometry.fromWKT(response[0].geometry);
                var newFeature = new OpenLayers.Feature.Vector(geometry, response[0].properties);
                newFeature.fid = response[0].id || feature.fid;
                newFeature.layer = feature.layer;

                if (!feature.fid && feature.__custom_style__) {
                    schema.widget.saveStyle(newFeature, feature.__custom_style__);
                }

                newFeature.isNew = false;
                var currentSchema = widget.getCurrentSchema();
                currentSchema.introduceFeature(newFeature);

                if (!feature.attributes.schemaName) {
                    feature.attributes.schemaName = schema.getSchemaByFeature(feature).schemaName;
                }
                widget.dropFeature(feature);
                currentSchema.layer.addFeatures([newFeature]);

                $.notify(Mapbender.trans('mb.digitizer.feature.save.successfully'), 'info');

                currentSchema.reloadFeatures();

                widget.element.trigger("featureSaved", {schema: schema, feature: feature});

                return response;

            });

            return promise;

        },
        getUnsavedFeatures: function () {
            var features = [];
            for (var i = 0; i < this.layer.features.length; ++i) {
                var feature = this.layer.features[i];
                if (!feature.geometry) {
                    console.warn("Removing invalid feature", feature);
                    this.layer.removeFeature(feature);
                } else if (feature.isNew || feature.isChanged || feature.isCopy) {
                    features.push(feature);
                }
            }
            return features;
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

            if (schema.zoomOnResultTableClick) {
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
                feature.visible = schema.featureVisibility;
            });
            layer.redraw();
            schema.menu.redrawTable();
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
        }
    };


})();
