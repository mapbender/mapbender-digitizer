(function () {
    "use strict";

    /**
     *
     * @param {Object} options
     * @param widget
     * @constructor
     */

    Mapbender.Digitizer.Scheme = function (options, widget) {
        var schema = this;

        schema.widget = widget;

        schema.featureType = options.featureType || {
            uniqueId: null,
            geomField: null,
            styleField: null,
            srid: 4326
        };

        schema.schemaName = options.schemaName;

        schema.label = options.label;
        schema.view = options.view = { settings: { }};
        schema.popup = options.popup || {title: schema.schemaName, width: '500px'};
        schema.tableFields = options.tableFields;
        schema.formItems = options.formItems || {};
        schema.allowEditData = options.allowEditData || (typeof options.allowEditData === 'undefined');  //default true
        schema.allowSave = options.allowSave || false;
        schema.allowOpenEditDialog = options.allowOpenEditDialog || false;
        schema.allowDelete = options.allowDelete || (typeof options.allowDelete === 'undefined');  //default true;
        schema.inlineSearch = options.inlineSearch || true;
        schema.pageLength = options.pageLength || 10;
        schema.inlineSearch = options.inlineSearch || false;
        schema.tableTranslation = options.tableTranslation || undefined;

        // alias different config keys "allowEditData", "allowOpenEditDialog" to upstream-compatible "allowEdit"
        schema.allowEdit = schema.allowEditData || options.allowOpenEditDialog || options.allowEdit || false;

        schema.toolset = options.toolset;

        schema.openFormAfterEdit = options.openFormAfterEdit || (typeof options.openFormAfterEdit === 'undefined');  // default true

        schema.openFormAfterModification = options.openFormAfterModification || false;

        schema.allowCustomStyle = options.allowCustomStyle || false;

        schema.allowDigitize = options.allowDigitize || (typeof options.allowEditData === 'undefined');  // default true

        schema.allowSaveInResultTable = options.allowSaveInResultTable || false;

        schema.copy = options.copy || {
            enable: false,
            overwriteValuesWithDefault: false,
            moveCopy: {x: 10, y: 10},
            style: null
        };

        schema.useContextMenu = options.useContextMenu || false;

        // Deactivated schema.printable = options.printable || false;

        schema.allowChangeVisibility = options.allowChangeVisibility || false;

        schema.allowDeleteByCancelNewGeometry = options.allowDeleteByCancelNewGeometry || false;

        schema.allowLocate = options.allowLocate || false;

        // Deactivated schema.maxResults = options.maxResults || 5000;
        // only in custom bundles - allowPrintMetadata
        // mailManager
        schema.minScale = options.minScale || undefined;

        schema.maxScale = options.maxScale || undefined;

        //    group // not necessary
        //    save // deprecated - no code in config
        // hooks // deprecated - no code in config

        schema.showVisibilityNavigation = options.showVisibilityNavigation || false;

        /** TO BE Implemented **/
        schema.zoomScaleDenominator = options.zoomScaleDenominator || 500;

        schema.showExtendSearchSwitch = options.showExtendSearchSwitch || false;

        schema.currentExtentSearch = options.currentExtentSearch || false;

        schema.displayPermanent = options.displayPermanent || false;

        schema.refreshFeaturesAfterSave = options.refreshFeaturesAfterSave || false;

        schema.refreshLayersAfterFeatureSave = options.refreshLayersAfterFeatureSave || false;

        /** New properties **/
        schema.revertChangedGeometryOnCancel = options.revertChangedGeometryOnCancel || false;

        schema.deactivateControlAfterModification = options.deactivateControlAfterModification || false;

        schema.allowSaveAll = options.allowSaveAll || false;

        schema.markUnsavedFeatures = options.markUnsavedFeatures || false;

        /** implement this **/
        schema.showLabel = options.showLabel || false;

        schema.allowOpenEditDialog = options.allowOpenEditDialog || false;

        schema.openDialogOnResultTableClick = options.openDialogOnResultTableClick || false;

        schema.zoomOnResultTableClick = options.zoomOnResultTableClick || true;

        schema.menu = schema.createMenu(schema);
    };

    Mapbender.Digitizer.FeatureRenderer = function FeatureRenderer(olMap, schema) {
        this.schema = schema;
        this.olMap = olMap;
        var otherStyles = {};
        if (schema.copy && schema.copy.style) {
            otherStyles.copy = schema.copy.style;
        }
        this.basicStyles = Object.assign({}, schema.getDefaultStyles(), schema.styles || {}, otherStyles);

        this.styles = this.initializeStyles_(this.basicStyles); // NOTE: accessed only in event handlers currently inlined here

        this.layer = this.createSchemaFeatureLayer_(schema);
        this.olMap.addLayer(this.layer);

        this.addSelectControl_();

        var renderer = this;
        this.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;
            renderer.initializeFeature(schema, feature);
            renderer.registerFeatureEvents(schema, feature);
        });
        this.layer.getSource().on(['controlFactory.FeatureMoved', 'controlFactory.FeatureModified'], function (event) {
            var feature = event.feature || event.features.item(0);
            renderer.onFeatureModified(renderer.schema, feature);
        });

        this.layer.getSource().on('controlFactory.FeatureAdded', function (event) {
            renderer.onFeatureAdded(renderer.schema, event.feature);
        });

        this.layer.getSource().on('controlFactory.FeatureCopied', function (event) {
            renderer.onFeatureCopied(renderer.schema, event.feature);
        });

        $(olMap).on('Digitizer.FeatureUpdatedOnServer', function (event) {
            renderer.onFeatureUpdatedOnServer(renderer.schema);
        });
    }
    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        initializeFeature: function(schema, feature) {
            feature.set("mbOrigin", "digitizer");
            feature.setStyle = feature.setStyleWithLabel;
            feature.setStyle(this.styles.default);
            if (schema.allowCustomStyle) {
                schema.customStyleFeature_(feature);
            }

            feature.set("oldGeometry", feature.getGeometry().clone());
        },
        registerFeatureEvents: function(schema, feature) {
            feature.on('Digitizer.HoverFeature', function (event) {
                if (!feature.get("hidden")) {
                    feature.set("selected", true);
                }
            });

            feature.on('Digitizer.UnhoverFeature', function (event) {
                feature.set("selected", false);
            });

            feature.on('Digitizer.UnmodifyFeature', function (event) {
                feature.set("modificationState", undefined);
            });

            var renderer = this;
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function (event) {
                if (event.key == "selected" || event.key == "modificationState" || event.key == "hidden") {
                    renderer.updateFeatureStyle(schema, feature);
                }
            });

            feature.on('Digitizer.toggleVisibility', function (event) {
                feature.set("hidden", event.hide);

            });
        },
        updateFeatureStyle: function(schema, feature) {
            var style;
            if (feature.get("hidden")) {
                style = this.styles.invisible;
            } else if (feature.get("selected")) {
                style = this.styles.select;
            } else if (feature.get("modificationState") && schema.markUnsavedFeatures) {
                switch (feature.get("modificationState")) {
                    case "isChanged" :
                    case "isNew" :
                        style = this.styles.unsaved;
                        break;
                    case "isCopy" :
                        style = this.styles.copy;

                }
            } else {
                style = this.getFeatureStyle_(feature);
            }

            // See selectableModify interaction (ol4 extensions)
            // @todo: selectableModify should deal with pausing style updates itself
            if (!feature.get("featureStyleDisabled")) {
                feature.setStyle(style);
            }
        }
    });

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        onFeatureModified: function(schema, feature) {
            feature.set("modificationState", "isChanged");

            feature.dispatchEvent({type: 'Digitizer.ModifyFeature'});

            if (schema.openFormAfterModification) {
                var dialog = schema.openFeatureEditDialog(feature);

                dialog.$popup.bind('popupdialogcancel', function () {
                    if (schema.revertChangedGeometryOnCancel) {
                        feature.setGeometry(feature.get("oldGeometry").clone());
                        feature.dispatchEvent({type: 'Digitizer.UnmodifyFeature'});
                    }
                })
            }
        },
        onFeatureAdded: function(schema, feature) {
            feature.set("modificationState", "isNew");
            this.updateFeatureStyle(schema, feature);

            if (schema.openFormAfterEdit) {
                var dialog = schema.openFeatureEditDialog(feature);

                dialog.$popup.bind('popupdialogcancel', function () {
                    feature.dispatchEvent({type: 'Digitizer.ModifyFeature'});
                    if (schema.allowDeleteByCancelNewGeometry) {
                        try {
                            schema.removeFeature(feature);
                        } catch (e) { /* Remove feature only if it exists */
                        }
                    }
                });
            }
        },
        onFeatureCopied: function(schema, feature) {
            feature.set("modificationState", "isCopy");

            $(schema).trigger({type: "Digitizer.FeatureAddedManually", feature: feature});

            var dialog = schema.openFeatureEditDialog(feature);

            dialog.$popup.bind('popupdialogcancel', function () {
                feature.dispatchEvent({type: 'Digitizer.ModifyFeature'});
                if (schema.allowDeleteByCancelNewGeometry) {
                    try {
                        schema.removeFeature(feature);
                    } catch (e) { /* Remove feature only if it exists */
                    }
                }
            });
        },
        onFeatureUpdatedOnServer: function(schema) {
            if (schema.refreshLayersAfterFeatureSave) {
                $.each(schema.refreshLayersAfterFeatureSave, function (k1, layerInstanceId) {
                    var layers = Mapbender.layerManager.getLayersByInstanceId(layerInstanceId);
                    $.each(layers, function (k2, layer) {
                        Mapbender.layerManager.refreshLayer(layer);
                    });
                });
            }

            if(schema.refreshFeaturesAfterSave){
                $.each(schema.refreshFeaturesAfterSave, function(key,schemaName){
                    schema.widget.refreshConnectedDigitizerFeatures(schemaName);
                })
            }
        }
    });

    Object.assign(Mapbender.Digitizer.Scheme.prototype, {
        getFeatureEditDialogHandler: function(feature, schema) {
            return Mapbender.Digitizer.FeatureEditDialog;
        },
        openFeatureEditDialog: function (feature) {
            // inflect via inherited data-manager widget method
            var schema = this;
            var widget = schema.widget;
            var $dialog = widget._openEditDialog(schema, feature);
            // Fake previous internal structure of FeatureEditDialog class
            // @todo: resolve popup access errors in renderer event registration, then unroll this hack
            return {
                '$popup': $dialog
            };
        }
    });




    Mapbender.Digitizer.Scheme.prototype.getDefaultStyles = function () {
        var styles = {

            default: {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor: '#6fb536',
                fillOpacity: 0.3
            },
            select: {
                strokeWidth: 3,
                fillColor: '#F7F79A',
                strokeColor: '#6fb536',
                fillOpacity: 0.5,
                graphicZIndex: 15
            },
            copy: {
                strokeWidth: 5,
                fillColor: '#f7ef7e',
                strokeColor: '#4250b5',
                fillOpacity: 0.7,
            },
            unsaved: {
                strokeWidth: 3,
                fillColor: '#FFD14F',
                strokeColor: '#F5663C',
                fillOpacity: 0.5
            },
            invisible: {
                fillOpacity: 0,
                strokeOpacity: 0,
            }
        };

        return styles;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.getLayer = function() {
        return this.layer;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.initializeStyles_ = function (styleConfigs) {
        var styles = {};
        var keys = Object.keys(styleConfigs);
        for (var i = 0; i < keys.length; ++ i) {
            var key = keys[i];
            var styleConfig = styleConfigs[key];
            styles[key] = ol.style.StyleConverter.convertToOL4Style(styleConfig);
        }
        Object.freeze(styles.default.getFill().getColor()); // Freeze Color to prevent unpredictable behaviour
        return styles;
    };


    Mapbender.Digitizer.FeatureRenderer.prototype.createSchemaFeatureLayer_ = function (schema) {
        var layer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            visible: true
            // HACK: disable min / max resolution and initial visibility while testing
            // @todo: reenable minScale / maxScale config evaluation
//            minResolution: Mapbender.Model.scaleToResolution(schema.maxScale || 0),
//            maxResolution: Mapbender.Model.scaleToResolution(schema.minScale || Infinity),
//            visible: false
        });
        return layer;
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.customStyleFeature_ = function (feature) {
        var schema = this;

        console.assert(!!schema.featureType.styleField, "Style Field in Feature Type is not specified");

        var jsonStyle = feature.get("data") && feature.get("data").get(schema.featureType.styleField);

        if (jsonStyle) {
            var basicStyle = JSON.parse(jsonStyle);
            var style = ol.style.StyleConverter.convertToOL4Style(basicStyle);
            feature.set("basicStyle", basicStyle);
            feature.set("style", style);
            feature.setStyle(style);
        }
    };


    Mapbender.Digitizer.FeatureRenderer.prototype.addSelectControl_ = function () {
        var schema = this;


        var highlightControl = new ol.interaction.Select({

            condition: ol.events.condition.pointerMove,
            layers: [this.layer]

        });


        this.highlightControl = highlightControl;
        this.olMap.addInteraction(this.highlightControl);

        highlightControl.on('select', function (e) {

            e.selected.forEach(function (feature) {
                feature.dispatchEvent({type: 'Digitizer.HoverFeature'});
            });

            e.deselected.forEach(function (feature) {
                feature.dispatchEvent({type: 'Digitizer.UnhoverFeature'});
            });

        });

        highlightControl.setActive(false);

        var selectControl = new ol.interaction.Select({

            condition: ol.events.condition.singleClick,
            layers: [this.layer],
            style: function () {
                return null;
            }

        });

        this.selectControl = selectControl;
        this.olMap.addInteraction(this.selectControl);

        selectControl.on('select', function (event) {
            if (this.schema.allowEditData || this.schema.allowOpenEditDialog) {
                this.schema.openFeatureEditDialog(event.selected[0]);
                selectControl.getFeatures().clear();
            }
        });

        selectControl.setActive(false);

    };

    Mapbender.Digitizer.Scheme.prototype.getGeomType = function () {
        var schema = this;
        return schema.featureType.geomType;
    };

    Mapbender.Digitizer.Scheme.prototype.createMenu = function() {
        var schema = this;
        return new Mapbender.Digitizer.Menu(schema);
    };

    Mapbender.Digitizer.FeatureRenderer.prototype.getFeatureStyle_ = function (feature) {
        return feature.get("style") || this.styles.default
    };

    Mapbender.Digitizer.Scheme.prototype.copyFeature = function (feature) {
        var schema = this;
        var layer = schema.layer;
        var newFeature = feature.clone();

        var defaultAttributes = schema.copy.data || {};

        /** Copy prevention is disabled - no code in Configuration**/
            // var allowCopy = true;
            //
            //
            // _.each(schema.evaluatedHooksForCopyPrevention, function (allowCopyForFeature) {
            //     allowCopy = allowCopy && (allowCopyForFeature(feature));
            // });
            //
            // if (!allowCopy) {
            //     $.notify(Mapbender.trans('mb.digitizer.feature.clone.on.error'));
            //     return;
            // }

        var newAttributes = _.extend({}, defaultAttributes);

        $.each(feature.getProperties().data, function (key, value) {
            if (key === schema.featureType.uniqueId || value === '' || value === null) {
                return;
            }
            if (schema.copy.overwriteValuesWithDefault) {
                newAttributes[key] = newAttributes[key] || value; // Keep default value when existing
            } else {
                newAttributes[key] = value;
            }


        });

        newFeature.set("data", newAttributes);

        // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
        if (schema.copy.moveCopy) {
            newFeature.getGeometry().translate(schema.copy.moveCopy.x, schema.copy.moveCopy.y);
        }


        schema.layer.getSource().addFeature(newFeature);

        // Watch out - Name "Copy of ..." is not instantly stored
        // Control Factory namespace can be misleading and is used for congruence onl<
        schema.layer.getSource().dispatchEvent({type: 'controlFactory.FeatureCopied', feature: newFeature});

    };


    Mapbender.Digitizer.Scheme.prototype.zoomToFeature = function (feature) {
        var schema = this;

        Mapbender.Model.zoomToFeature(feature, { minScale: schema.zoomScaleDenominator});

    };

    Mapbender.Digitizer.Scheme.prototype.openChangeStyleDialog = function (feature) {
        var schema = this;

        var styleOptions = {
            data: feature.get("basicStyle") || schema.basicStyles.default,
        };

        var styleEditor = new Mapbender.Digitizer.FeatureStyleEditor(feature, schema, styleOptions);
    };


    Mapbender.Digitizer.Scheme.prototype.removeFeature = function (feature) {
        var schema = this;
        var widget = schema.widget;
        if (!feature.getId()) {
            // HACK: renderer property is monkey-patched onto schema externally by jqui widget
            schema.renderer.getLayer().getSource().removeFeature(feature);
        } else {
            widget.removeData(this, feature);
        }
    };


    Mapbender.Digitizer.Scheme.prototype.saveFeature = function (feature, formData) {
        var schema = this;
        var widget = schema.widget;
        var id = (feature.get('data') || {})[schema.featureType.uniqueId];
        widget._saveItem(schema, id, feature);
    };


})();
