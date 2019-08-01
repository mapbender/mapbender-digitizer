(function () {
    "use strict";

    /**
     *
     * @param {Object} rawScheme
     * @param widget
     * @param {number} index
     * @constructor
     */

    Mapbender.Digitizer.Scheme = function (rawScheme, widget, index) {

        var schema = this;

        this.index = index;
        this.widget = widget;


        /**
         * @type {boolean}
         */
        this.allowEditData = false;

        /**
         * @type {boolean}
         */
        this.allowOpenEditDialog = false;

        $.extend(schema, rawScheme);

        schema.createPopupConfiguration_();

        schema.createSourceModification_();

        schema.createSchemaFeatureLayer_();

        schema.addSelectControl_();

        schema.createMenu_();

        schema.initializeWithDefaultStyles_();



        schema.layer.getSource().on('controlFactory.FeatureMoved', function (event) {
            var feature = event.feature;

            feature.temporaryStyle = schema.styles.unsaved;
            feature.setStyle(feature.temporaryStyle);

        });

        schema.layer.getSource().on('controlFactory.FeatureModified', function (event) {

            var feature = event.feature;

            feature.temporaryStyle = schema.styles.unsaved;
            feature.setStyle(feature.temporaryStyle);

        });

        schema.layer.getSource().on('controlFactory.FeatureAdded', function (event) {
            var feature = event.feature;

            schema.introduceFeature(feature);

            feature.temporaryStyle = schema.styles.unsaved;
            feature.setStyle(feature.temporaryStyle);

            schema.openFeatureEditDialog(feature);

        });


        schema.layer.getSource().on('controlFactory.FeatureCopied', function (event) {
            var feature = event.feature;

            schema.introduceFeature(feature);

            feature.temporaryStyle = schema.styles.copy;
            feature.setStyle(feature.temporaryStyle);

            schema.openFeatureEditDialog(feature);

        });

    };


    Mapbender.Digitizer.Scheme.prototype = {

        initializeWithDefaultStyles_: function () {
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
            };

            schema.styles = schema.styles || {};

            $.each(styles, function (label, style) {
                schema.styles[label] = ol.style.StyleConverter.convertToOL4Style(schema.styles[label] || style);

            });

        },


        createSourceModification_: function () {
            var schema = this;

            var createRequest = function (extent, projectionCode) {

                var request = {
                    srid: projectionCode,
                    maxResults: schema.maxResults,
                    schema: schema.schemaName,

                };
                return request;

            };

            var sourceModificatorGlobal = {
                strategy: ol.loadingstrategy.all,
                createRequest: createRequest
            };

            var sourceModificatorExtent = {
                strategy: function (extent, resolution) {
                    if (this.resolution && this.resolution !== resolution) {
                        this.loadedExtentsRtree_.clear();
                    }
                    return [extent];
                },
                createRequest: function (extent, projectionCode) {
                    var request = createRequest(extent, projectionCode);
                    var extentPolygon = new ol.geom.Polygon.fromExtent(extent);
                    request['intersectGeometry'] = new ol.format.WKT().writeGeometryText(extentPolygon);

                    return request;

                }
            };

            schema.currentSourceModificator = schema.currentExtentSearch ? sourceModificatorExtent : sourceModificatorGlobal;

            schema.switchSourceModificator = function (currentExtent) {

                var sourceModificator = currentExtent ? sourceModificatorExtent : sourceModificatorGlobal;

                schema.currentSourceModificator = sourceModificator;
                schema.layer.getSource().strategy_ = sourceModificator.strategy;

                schema.layer.getSource().clear();
                schema.layer.getSource().refresh();
            };
        },


        createPopupConfiguration_: function () {
            var schema = this;
            schema.popup = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
        },


        createSchemaFeatureLayer_: function () {
            var schema = this;
            var widget = schema.widget;


            var layer = new ol.layer.Vector({
                source: new ol.source.Vector({
                    format: new ol.format.GeoJSON(),
                    loader: schema.getData.bind(schema),
                    strategy: schema.currentSourceModificator.strategy // ol.loadingstrategy.bbox
                }),
                visible: false,
            });

            schema.layer = layer;

            widget.map.addLayer(schema.layer);

        },

        createMenu_: function () {
            var schema = this;
            var widget = schema.widget;
            var element = $(widget.element);

            schema.menu = new Mapbender.Digitizer.Menu(schema);

            element.append(schema.menu.frame);

        },

        addSelectControl_: function () {
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

        },

        getGeomType: function () {
            var schema = this;
            return schema.featureType.geomType;
        },

        activateSchema: function (wholeWidget) {

            var schema = this;

            var widget = schema.widget;
            var frame = schema.menu.frame;
            var layer = schema.layer;

            widget.getCurrentSchema = function () {
                return schema;
            };

            frame.show();

            schema.highlightControl.setActive(true);
            schema.selectControl.setActive(true);

            if (!wholeWidget) {
                layer.setVisible(true);
            }
        },

        deactivateSchema: function (wholeWidget) {

            var schema = this;
            var widget = schema.widget;
            var frame = schema.menu.frame;
            var layer = schema.layer;

            frame.hide();

            schema.highlightControl.setActive(false);
            schema.selectControl.setActive(false);

            if (widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

            schema.deactivateInteractions();

            if (!wholeWidget) {
                if (!schema.displayPermanent) {
                    layer.setVisible(false);
                }
            }

        },

        deactivateInteractions: function () {
            var schema = this;
            schema.menu.toolSet.activeInteraction && schema.menu.toolSet.activeInteraction.setActive(false);
            schema.highlightControl.setActive(false);
            schema.selectControl.setActive(false);
        },


        openFeatureEditDialog: function (feature) {
            var schema = this;
            schema.popup.createFeatureEditDialog(feature, schema);
        },


        introduceFeature: function (feature) {

            var schema = this;
            feature.mbOrigin = 'digitizer';

            feature.setStyle(schema.styles.default);

            feature.on('Digitizer.HoverFeature', function (event) {

                schema.menu.resultTable.hoverInResultTable(feature, event.hover);
                feature.setStyle(event.hover ? schema.styles.select : feature.temporaryStyle || schema.styles.default);

            });
        },

        getData: function (extent, resolution, projection) {

            var schema = this;
            var widget = schema.widget;

            // This is necessary to enable cache deletion in currentExtentSearch when zooming In
            schema.layer.getSource().resolution = resolution;

            var request = schema.currentSourceModificator.createRequest(extent, projection.getCode().split(":").pop());

            var selectXHR = widget.query('select', request).then(schema.onFeatureCollectionLoaded.bind(schema));

            return selectXHR;
        },


        onFeatureCollectionLoaded: function (featureCollection) {
            var schema = this;

            if (!featureCollection || !featureCollection.hasOwnProperty("features")) {
                Mapbender.error(Mapbender.DigitizerTranslator.translate("features.loading.error"), featureCollection);
                return;
            }

            if (featureCollection.features && featureCollection.features.length === parseInt(schema.maxResults)) {
                Mapbender.info("It is requested more than the maximal available number of results.\n ( > " + schema.maxResults + " results. )");
            }


            var geoJsonReader = new ol.format.GeoJSON();
            var newFeatures = geoJsonReader.readFeaturesFromObject({
                type: "FeatureCollection",
                features: featureCollection.features
            });

            // Actually, this only needs to be done when doing currentExtent Search, but as long as it doesn't hurt performance, it can stay
            $.each(schema.layer.getSource().getFeatures(), function (key, feature) {
                schema.layer.getSource().removeFeature(feature);
            });

            newFeatures.forEach(function (feature) {
                schema.introduceFeature(feature);
            });

            schema.layer.getSource().addFeatures(newFeatures);
            schema.redrawFeaturesInResultTable();

        },


        redrawFeaturesInResultTable: function () {
            var schema = this;
            var features = schema.layer.getSource().getFeatures();
            schema.menu.resultTable.redrawResultTableFeatures(features);
        },


        copyFeature: function (feature) {
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
                //     $.notify(Mapbender.DigitizerTranslator.translate('feature.clone.on.error'));
                //     return;
                // }

            var newAttributes = _.extend({}, defaultAttributes);

            $.each(feature.getProperties(), function (key, value) {
                if (key === schema.featureType.uniqueId || value === '' || value === null) {
                    return;
                }
                if (schema.copy.overwriteValuesWithDefault) {
                    newAttributes[key] = newAttributes[key] || value; // Keep default value when existing
                } else {
                    newAttributes[key] = value;
                }


            });

            // TODO this works, but is potentially buggy: numbers need to be relative to current zoom
            if (schema.copy.moveCopy) {
                newFeature.getGeometry().translate(schema.copy.moveCopy.x, schema.copy.moveCopy.y);
            }

            var name = schema.featureType.name;
            if (name) {
                newFeature.set(name, "Copy of " + (feature.get(name) || feature.getId()));
            }

            schema.layer.getSource().addFeature(newFeature);

            schema.layer.getSource().dispatchEvent({ type: 'controlFactory.FeatureCopied', feature: newFeature});

        },


        removeFeature: function (feature) {
            var schema = this;
            var widget = schema.widget;

            var limitedFeature = {};
            limitedFeature[schema.featureType.uniqueId] = feature.getId();
            if (!feature.getId()) {
                schema.layer.getSource().removeFeature(feature);
            } else {
                Mapbender.confirmDialog({
                    html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),

                    onSuccess: function () {
                        widget.query('delete', {
                            schema: schema.schemaName,
                            feature: limitedFeature,
                        }).done(function (fid) {
                            schema.layer.getSource().removeFeature(feature);
                            $.notify(Mapbender.DigitizerTranslator.translate('feature.remove.successfully'), 'info');
                        });
                    }
                });
            }

            return feature;
        },


        saveFeature: function (feature, formData) {
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

                var geoJsonReader = new ol.format.GeoJSON();

                var newFeatures = geoJsonReader.readFeaturesFromObject(response);
                var newFeature = _.first(newFeatures);

                schema.introduceFeature(newFeature);

                return newFeature;

            };

            var request = {
                id: feature.getId(),
                properties: formData,
                geometry: new ol.format.WKT().writeGeometryText(feature.getGeometry()),
                srid: widget.map.getView().getProjection().getCode().split(':').pop(),
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

                    schema.layer.getSource().removeFeature(feature);
                    schema.layer.getSource().addFeature(newFeature);

                    schema.menu.resultTable.redrawResultTableFeatures(schema.layer.getSource().getFeatures());

                    $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully"), 'info');

                }

                return response;

            });

            return promise;

        },


    };


})();
