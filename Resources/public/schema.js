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

        Mapbender.DataManager.Scheme.apply(schema, arguments);

        schema.toolset = options.toolset || Mapbender.Digitizer.Utilities.getDefaultToolsetByGeomType(schema.getGeomType());

        schema.openFormAfterEdit = options.openFormAfterEdit || false;

        schema.openFormAfterModification = options.openFormAfterModification || false;

        schema.allowCustomStyle = options.allowCustomStyle || false;

        schema.allowDigitize = options.allowDigitize || false;

        schema.allowSaveInResultTable = options.allowSaveInResultTable || false;

        schema.copy = options.copy || {enable: false, overwriteValuesWithDefault: false, moveCopy: {x: 10, y: 10}};

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

        /** To be implemented **/
        // schema.refreshFeaturesAfterSave = options.refreshFeaturesAfterSave || false;

        //schema.refreshLayersAfterFeatureSave = options.refreshLayersAfterFeatureSave || false;

        /** New properties **/
        schema.revertChangedGeometryOnCancel = options.revertChangedGeometryOnCancel || false;

        schema.deactivateControlAfterModification = options.deactivateControlAfterModification || true;

        schema.allowSaveAll = options.allowSaveAll || false;

        schema.markUnsavedFeatures = options.markUnsavedFeatures || false;

        /** implement this **/
        schema.showLabel = options.showLabel || false;

        schema.allowOpenEditDialog = options.allowOpenEditDialog || false;

        schema.openDialogOnResultTableClick = options.openDialogOnResultTableClick || false;

        schema.zoomOnResultTableClick = options.zoomOnResultTableClick || true;

        schema.basicStyles = Object.assign({}, schema.getDefaultStyles_(), options.styles);

        schema.styles = {};

        schema.initializeWithDefaultStyles_();

        schema.createSchemaFeatureLayer_();

        schema.addSelectControl_();

        schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;

            feature.set("mbOrigin", "digitizer");

            feature.setStyle(schema.styles.default);

            feature.on('Digitizer.HoverFeature', function (event) {

                if (!feature.get("hidden")) {
                    feature.set("selected", true);
                }

            });

            feature.on('Digitizer.UnhoverFeature', function (event) {
                feature.set("selected", false);
            });

            feature.on('Digitizer.ModifyFeature', function (event) {
                //feature.changed();
            });

            feature.on('Digitizer.UnmodifyFeature', function (event) {
                feature.set("modificationState", undefined);
                //feature.changed();
            });

            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function (event) {
                if (event.key == "selected" || event.key == "modificationState" || event.key == "hidden") {

                    if (feature.get("hidden")) {
                        feature.setStyle(schema.styles.invisible);
                        return;
                    } else if (feature.get("selected")) {
                        feature.setStyle(schema.styles.select);
                        return;
                    } else if (feature.get("modificationState") && schema.markUnsavedFeatures) {
                        switch (feature.get("modificationState")) {
                            case "isChanged" :
                            case "isNew" :
                                feature.setStyle(schema.styles.unsaved);
                                return;
                            case "isCopy" :
                                feature.setStyle(schema.styles.copy);
                                return;

                        }
                    }

                    feature.setStyle(schema.getFeatureStyle_(feature));

                }

            });

            feature.on('Digitizer.toggleVisibility', function (event) {

                feature.set("hidden", event.hide);

            });

            if (schema.allowCustomStyle) {
                schema.customStyleFeature_(feature);
            }

            feature.set("oldGeometry", feature.getGeometry().clone());
        });

        schema.layer.getSource().on(['controlFactory.FeatureMoved', 'controlFactory.FeatureModified'], function (event) {
            var feature = event.feature;

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


        });

        schema.layer.getSource().on('controlFactory.FeatureAdded', function (event) {
            var feature = event.feature;

            feature.set("modificationState", "isNew");

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


        });


        schema.layer.getSource().on('controlFactory.FeatureCopied', function (event) {
            var feature = event.feature;

            feature.set("modificationState", "isCopy");

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

            feature.dispatchEvent({type: 'Digitizer.ModifyFeature'});

        });


    };

    Mapbender.Digitizer.Scheme.prototype = Object.create(Mapbender.DataManager.Scheme.prototype);
    Mapbender.Digitizer.Scheme.prototype.constructor = Mapbender.DataManager.Scheme;

    Mapbender.Digitizer.Scheme.prototype.getDefaultStyles_ = function () {
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

    Mapbender.Digitizer.Scheme.prototype.featureExists_ = function (feature) {
        var schema = this;
        return schema.layer.getSource().getFeatures().includes(feature);
    };

    Mapbender.Digitizer.Scheme.prototype.initializeWithDefaultStyles_ = function () {
        var schema = this;

        $.each(schema.basicStyles, function (label, style) {
            schema.styles[label] = ol.style.StyleConverter.convertToOL4Style(style);
        });

        Object.freeze(schema.styles.default.getFill().getColor()); // Freeze Color to prevent unpredictable behaviour
    };


    // createSourceModification_: function () {
    //     var schema = this;
    //     var widget = schema.widget;
    //
    //     var createRequest = function (extent) {
    //
    //         var request = {
    //             srid: widget.getProjectionCode(),
    //             maxResults: schema.maxResults,
    //             schema: schema.schemaName,
    //
    //         };
    //         return request;
    //
    //     };
    //
    //     var sourceModificatorGlobal = {
    //         strategy: ol.loadingstrategy.all,
    //         createRequest: createRequest
    //     };
    //
    //     var sourceModificatorExtent = {
    //         strategy: function (extent, resolution) {
    //             if (this.resolution && this.resolution !== resolution) {
    //                 this.loadedExtentsRtree_.clear();
    //             }
    //             return [extent];
    //         },
    //         createRequest: function (extent) {
    //             var request = createRequest(extent);
    //             var extentPolygon = new ol.geom.Polygon.fromExtent(extent);
    //             request['intersectGeometry'] = new ol.format.WKT().writeGeometryText(extentPolygon);
    //
    //             return request;
    //
    //         }
    //     };
    //
    //     schema.currentSourceModificator = schema.currentExtentSearch ? sourceModificatorExtent : sourceModificatorGlobal;
    //
    //     schema.switchSourceModificator = function (currentExtent) {
    //
    //         var sourceModificator = currentExtent ? sourceModificatorExtent : sourceModificatorGlobal;
    //
    //         schema.currentSourceModificator = sourceModificator;
    //         schema.layer.getSource().strategy_ = sourceModificator.strategy;
    //
    //
    //         schema.layer.getSource().loadedExtentsRtree_.clear();
    //         schema.layer.getSource().refresh();
    //     };
    // },


    Mapbender.Digitizer.Scheme.prototype.createSchemaFeatureLayer_ = function () {
        var schema = this;
        var widget = schema.widget;

        var layer = new ol.layer.Vector({
            source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                loader: schema.getData.bind(schema),
                minResolution: schema.minScale ? Mapbender.Digitizer.Utilities.scaleToResolution(schema.minScale) : 0,
                maxResolution: schema.maxScale ? Mapbender.Digitizer.Utilities.scaleToResolution(schema.maxScale) : Infinity,
                strategy: ol.loadingstrategy.all // ol.loadingstrategy.bbox
            }),
            visible: false,
        });

        schema.layer = layer;

        widget.map.addLayer(schema.layer);

    };

    Mapbender.Digitizer.Scheme.prototype.customStyleFeature_ = function (feature) {
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


    Mapbender.Digitizer.Scheme.prototype.addSelectControl_ = function () {
        var schema = this;
        var widget = schema.widget;


        var highlightControl = new ol.interaction.Select({

            condition: ol.events.condition.pointerMove,
            layers: [schema.layer]

        });


        schema.highlightControl = highlightControl;
        widget.map.addInteraction(schema.highlightControl);

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
            layers: [schema.layer],
            style: function () {
                return null;
            }

        });

        schema.selectControl = selectControl;

        widget.map.addInteraction(schema.selectControl);

        selectControl.on('select', function (event) {
            if (schema.allowEditData || schema.allowOpenEditDialog) {
                schema.openFeatureEditDialog(event.selected[0]);
                selectControl.getFeatures().clear();
            }
        });

        selectControl.setActive(false);

    };

    Mapbender.Digitizer.Scheme.prototype.getGeomType = function () {
        var schema = this;
        return schema.featureType.geomType;
    };

    Mapbender.Digitizer.Scheme.prototype.createPopupConfiguration_ = function () {
        var schema = this;
        schema.popupConfiguration = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
    };

    Mapbender.Digitizer.Scheme.prototype.activateSchema = function (wholeWidget) {

        var schema = this;

        Object.getPrototypeOf(Mapbender.Digitizer.Scheme.prototype).activateSchema.apply(this, arguments);


        schema.highlightControl.setActive(true);
        schema.selectControl.setActive(true);

        if (!wholeWidget) {
            schema.layer.setVisible(true);
        }

        schema.widget.recalculateLayerVisibility_(true);
    };

    Mapbender.Digitizer.Scheme.prototype.deactivateSchema = function (wholeWidget) {

        var schema = this;

        Object.getPrototypeOf(Mapbender.Digitizer.Scheme.prototype).deactivateSchema.apply(this, arguments);

        schema.highlightControl.setActive(false);
        schema.selectControl.setActive(false);

        schema.deactivateInteractions();

        if (!wholeWidget) {
            if (!schema.displayPermanent) {
                schema.layer.setVisible(false);
            }
        }

        schema.widget.recalculateLayerVisibility_(false);

    };

    Mapbender.Digitizer.Scheme.prototype.deactivateInteractions = function () {
        var schema = this;
        schema.menu.toolSet.activeInteraction && schema.menu.toolSet.activeInteraction.setActive(false);
        schema.highlightControl.setActive(false);
        schema.selectControl.setActive(false);
    };

    Mapbender.Digitizer.Scheme.prototype.createMenu = function ($element) {
        var schema = this;
        schema.menu = new Mapbender.Digitizer.Menu(schema);
        schema.menu.appendTo($element);
    };

    Mapbender.Digitizer.Scheme.prototype.getFeatureStyle_ = function (feature) {
        var schema = this;

        return feature.get("style") || schema.styles.default
    };

    Mapbender.Digitizer.Scheme.prototype.integrateFeatures = function (features) {
        var schema = this;
        schema.layer.getSource().addFeatures(features);
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
            //     $.notify(Mapbender.DataManager.Translator.translate('feature.clone.on.error'));
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

        var name = schema.featureType.name;
        if (name) {
            newFeature.get("data").set(name, "Copy of " + (feature.get("data").get(name) || '#' + feature.getId()));
        }

        newFeature.set("data", newAttributes);

        // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
        if (schema.copy.moveCopy) {
            newFeature.getGeometry().translate(schema.copy.moveCopy.x, schema.copy.moveCopy.y);
        }


        schema.layer.getSource().addFeature(newFeature);

        // Watch out - Name "Copy of ..." is not instantly stored
        schema.layer.getSource().dispatchEvent({type: 'controlFactory.FeatureCopied', feature: newFeature});

    };


    Mapbender.Digitizer.Scheme.prototype.zoomToFeature = function (feature) {

        Mapbender.Model.zoomToFeature(feature);
        // var schema = this;
        // var widget = schema.widget;
        // var map = widget.map;
        //
        // if (!feature) {
        //     return;
        // }
        //
        // var olMap = widget.map;
        // var geometry = feature.getGeometry();
        //
        // var extent = schema.layer.getSource().getExtent();
        // map.getView().fit(geometry.getExtent(), map.getSize());
        //
        // if (schema.zoomScaleDenominator) {
        //     $.notify("zoomScaleDenominator not implemented yet");
        // }
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

        var limitedFeature = {};
        limitedFeature[schema.featureType.uniqueId] = feature.getId();
        if (!feature.getId()) {
            schema.layer.getSource().removeFeature(feature);
        } else {
            confirmDialog({
                html: Mapbender.DataManager.Translator.translate("feature.remove.from.database"),

                onSuccess: function () {
                    widget.query('delete', {
                        schema: schema.schemaName,
                        feature: limitedFeature,
                    }).done(function (fid) {
                        schema.layer.getSource().removeFeature(feature);
                        $.notify(Mapbender.DataManager.Translator.translate('feature.remove.successfully'), 'info');
                    });
                }
            });
        }

        return feature;
    };


    Mapbender.Digitizer.Scheme.prototype.saveFeature = function (feature, formData) {
        var schema = this;
        var widget = schema.widget;

        if (!schema.featureExists_(feature)) {
            $.notify('Feature doesn\'t exist');
            widget.currentPopup && widget.currentPopup.popupDialog('close');

            return $.Deferred().reject();
        }

        var createNewFeatureWithDBFeature = function (feature, response) {

            var features = response.features;

            if (features.length === 0) {
                console.warn("No Feature returned from DB Operation");
                schema.layer.getSource().removeFeature(feature);
                return null;
            } else if (features.length > 1) {
                console.warn("More than 1 Feature returned from DB Operation");
            }

            var geoJsonReader = new ol.format.GeoJSONWithSeperateData();

            var newFeature = geoJsonReader.readFeatureFromObject(response.features[0]);

            return newFeature;

        };

        var request = {
            id: feature.getId(),
            properties: formData || {},
            geometry: new ol.format.WKT().writeGeometryText(feature.getGeometry()),
            srid: widget.getProjectionCode(),
            type: "Feature"
        };

        var promise = widget.query('save', {
            schema: schema.schemaName,
            feature: request
        }).then(function (response) {

            if (response.errors) {

                response.errors.forEach(function (error) {
                    console.error(error.message);
                    $.notify(error.message, {
                        title: 'API Error',
                        autoHide: false,
                        className: 'error'
                    });
                });

            } else {


                var newFeature = createNewFeatureWithDBFeature(feature, response);

                if (newFeature == null) {
                    console.warn("Creation of new Feature failed");
                    return;
                }

                feature.dispatchEvent({type: 'Digitizer.UnmodifyFeature'});


                console.assert(schema.layer.getSource().getFeatures().includes(feature), "Feature is not part of the source", schema.layer.getSource().getFeatures());

                schema.layer.getSource().removeFeature(feature);
                schema.layer.getSource().addFeature(newFeature);


                $.notify(Mapbender.DataManager.Translator.translate("feature.save.successfully"), 'info');

            }

            return response;

        });

        return promise;

    };


})();
