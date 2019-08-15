(function () {
    "use strict";

    /**
     *
     * @param {Object} rawScheme
     * @param widget
     * @param {number} index
     * @constructor
     */

    Mapbender.Digitizer.Scheme = function (rawScheme, widget) {
        var schema = this;

        Mapbender.DataManager.Scheme.apply(this, arguments);

        this.openFormAfterEdit = true;


        schema.createSchemaFeatureLayer_();

        schema.addSelectControl_();

        schema.initializeWithDefaultStyles_();


        schema.layer.getSource().on('controlFactory.FeatureMoved', function (event) {
            var feature = event.feature;

            feature.set("temporaryStyle",schema.styles.unsaved);
            feature.setStyle(feature.get("temporaryStyle"));

            feature.dispatchEvent({type: 'Digitizer.ModifyFeature', allowSaving: true});


        });

        schema.layer.getSource().on('controlFactory.FeatureModified', function (event) {

            var feature = event.feature;

            feature.set("temporaryStyle",schema.styles.unsaved);
            feature.setStyle(feature.get("temporaryStyle"));

            feature.dispatchEvent({type: 'Digitizer.ModifyFeature', allowSaving: true});

        });

        schema.layer.getSource().on('controlFactory.FeatureAdded', function (event) {
            var feature = event.feature;

            schema.introduceFeature(feature);

            feature.set("temporaryStyle",schema.styles.unsaved);
            feature.setStyle(feature.get("temporaryStyle"));

            if (schema.openFormAfterEdit) {
                var dialog = schema.openFeatureEditDialog(feature);

                dialog.$popup.bind('popupdialogclose', function () {
                    feature.dispatchEvent({type: 'Digitizer.ModifyFeature', allowSaving: true});
                    if (schema.allowDeleteByCancelNewGeometry) {
                        try {
                            schema.removeFeature(feature);
                        } catch(e) { /* Remove feature only if it exists */}
                    }
                });
            }


        });


        schema.layer.getSource().on('controlFactory.FeatureCopied', function (event) {
            var feature = event.feature;

            schema.introduceFeature(feature);

            feature.set("temporaryStyle",schema.styles.copy);
            feature.setStyle(feature.get("temporaryStyle"));

            var dialog = schema.openFeatureEditDialog(feature);

            feature.dispatchEvent({type: 'Digitizer.ModifyFeature', allowSaving: true});

        });


        schema.layer.getSource().on('Digitizer.toggleFeatureVisibility', function (event) {

            var feature = event.feature;
            var hidden = !feature.get("hidden");

            if (hidden) {
                feature.set("hidden",true);
                feature.set("temporaryStyle2",feature.getStyle());
                feature.setStyle(schema.styles.invisible);
            } else {
                feature.set("hidden",false);
                feature.setStyle(feature.get("temporaryStyle2"));
            }

        });


        schema.layer.getSource().on('Digitizer.StyleFeature', function (event) {

            var feature = event.feature;

            console.assert(!!schema.featureType.styleField,"Style Field in Feature Type is not specified");

            var jsonStyle = feature.get("data").get(schema.featureType.styleField);

            if (jsonStyle) {
                var basicStyle = JSON.parse(jsonStyle);
                var style = ol.style.StyleConverter.convertToOL4Style(basicStyle);
                feature.set("basicStyle",basicStyle);
                feature.set("style",style);
                feature.setStyle(style);
            }

        });

    };

    Mapbender.Digitizer.Scheme.prototype = Object.create(Mapbender.DataManager.Scheme.prototype);
    Mapbender.Digitizer.Scheme.prototype.constructor = Mapbender.DataManager.Scheme;


    Mapbender.Digitizer.Scheme.prototype.initializeWithDefaultStyles_ = function () {
        var schema = this;
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

        schema.styles = schema.styles || {};
        schema.basicStyles =  {};

        $.each(styles, function (label, style) {
            schema.basicStyles[label] = schema.styles[label] || style;
            schema.styles[label] = ol.style.StyleConverter.convertToOL4Style(schema.basicStyles[label]);
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
                feature.dispatchEvent({type: 'Digitizer.HoverFeature', hover: true});
            });

            e.deselected.forEach(function (feature) {
                feature.dispatchEvent({type: 'Digitizer.HoverFeature', hover: false});
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
        schema.popup = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
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

    Mapbender.Digitizer.Scheme.prototype.getFeatureStyle_ = function(feature){
      var schema = this;

      return feature.get("style") || schema.styles.default
    };

    Mapbender.Digitizer.Scheme.prototype.introduceFeature = function (feature) {

        var schema = this;
        feature.set("mbOrigin","digitizer");

        feature.setStyle(schema.styles.default);

        feature.on('Digitizer.HoverFeature', function (event) {

            if (!feature.get("hidden")) {
                feature.setStyle(event.hover ? schema.styles.select : feature.get("temporaryStyle") ||  schema.getFeatureStyle_(feature));
            }

        });

       schema.layer.getSource().dispatchEvent({ type : "Digitizer.StyleFeature", feature: feature });

    };

    Mapbender.Digitizer.Scheme.prototype.integrateFeatures = function (features) {
        var schema = this;
        features.forEach(function (feature) {
            schema.introduceFeature(feature);
        });
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

        newFeature.set("data",newAttributes);

        // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
        if (schema.copy.moveCopy) {
            newFeature.getGeometry().translate(schema.copy.moveCopy.x, schema.copy.moveCopy.y);
        }



        schema.layer.getSource().addFeature(newFeature);

        // Watch out - Name "Copy of ..." is not instantly stored
        schema.layer.getSource().dispatchEvent({type: 'controlFactory.FeatureCopied', feature: newFeature});

    };


    Mapbender.Digitizer.Scheme.prototype.zoomToFeature = function (feature) {
        var schema = this;
        var widget = schema.widget;
        var map = widget.map;

        if (!feature) {
            return;
        }

        var olMap = widget.map;
        var geometry = feature.getGeometry();

        var extent = schema.layer.getSource().getExtent();
        map.getView().fit(geometry.getExtent(), map.getSize());

        if (schema.zoomScaleDenominator) {
            $.notify("zoomScaleDenominator not implemented yet");
        }
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
            Mapbender.confirmDialog({
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

            schema.introduceFeature(newFeature);

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

                console.assert(schema.layer.getSource().getFeatures().includes(feature),"Feature is not part of the source");

                schema.layer.getSource().removeFeature(feature);
                schema.layer.getSource().addFeature(newFeature);


                feature.dispatchEvent({type: 'Digitizer.ModifyFeature', allowSaving: false});

                $.notify(Mapbender.DataManager.Translator.translate("feature.save.successfully"), 'info');

            }

            return response;

        });

        return promise;

    };


})();
