(function () {
    "use strict";

    Mapbender.Digitizer.Scheme = function (rawScheme, widget, index) {
        var schema = this;
        schema.index = index;
        schema.widget = widget;
        $.extend(schema, rawScheme);

        schema.initTableFields();

        schema.createFormItemsCollection();

        schema.createPopupConfiguration_();

        schema.createSchemaFeatureLayer_();

        schema.createMenu_();

        schema.addSelectControls_();

        schema.layer.getSource().on('controlFactory.FeatureMoved', function (event) {

        });

        schema.layer.getSource().on('controlFactory.FeatureModified', function (event) {

        });

        schema.layer.getSource().on('controlFactory.FeatureAdded', function (event) {

        });

    };


    Mapbender.Digitizer.Scheme.prototype = {


        createPopupConfiguration_: function () {
            var schema = this;
            schema.popup = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
        },


        createSchemaFeatureLayer_: function () {
            var schema = this;
            var widget = schema.widget;


            var layer = new ol.layer.Vector({
                projection: 'EPSG:4258',
                source: new ol.source.Vector({
                    format: new ol.format.GeoJSON(),
                    loader: schema.getData.bind(schema)
                }),
                visible: true,
                strategy: ol.loadingstrategy.bbox,

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

        addSelectControls_: function () {
            var schema = this;
            var widget = schema.widget;


            var selectControl = new ol.interaction.Select({

                condition: ol.events.condition.pointerMove,
                layers: [schema.layer]

            });


            schema.selectControl = selectControl;

            widget.map.addInteraction(schema.selectControl);

            selectControl.on('select', function (e) {

                // e.selected.forEach(function (feature) {
                //     schema.menu.resultTable.hoverInResultTable(feature, true);
                // });
                //
                // e.deselected.forEach(function (feature) {
                //     schema.menu.resultTable.hoverInResultTable(feature, false);
                // });

            });

        },


        /**
         *  Can be overriden in specific digitizer instances
         */
        inject: function () {

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

            widget.getCurrentSchema = function () {
                return schema;
            };

            var promise;
            promise = $.Deferred().resolve();

            promise.then(function () {
                return widget.query('getConfiguration');
            }).done(function (response) {

                schema.updateConfigurationAfterSwitching(response.schemes);
                layer.setVisible(true);
                frame.show();
                if (schema.widget.isFullyActive) {
                    schema.selectControl.setActive(true);
                }

            });

        },

        deactivateSchema: function (deactivateWidget) {
            var schema = this;
            var widget = schema.widget;
            var frame = schema.menu.frame;
            var layer = schema.layer;

            frame.hide();

            if ((deactivateWidget && !schema.widget.displayOnInactive) || (!deactivateWidget && !schema.displayPermanent)) {
                layer.setVisible(false);
            }

            schema.selectControl.setActive(false);

            if (widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

            schema.menu.deactivateControls();


        },



        processFormItems: function (feature, dialog) {
            var schema = this;

            //var scheme = schema.getSchemaByFeature(feature);

            var processedFormItems = schema.formItems.process(feature, dialog, schema);

            return processedFormItems;
        },


        openFeatureEditDialog: function (feature) {
            var schema = this;
            schema.popup.createFeatureEditDialog(feature, schema);
        },



        reloadFeatures: function () {
            var schema = this;
            var layer = schema.layer;
            var features = schema.getLayerFeatures();

            layer.getSource().clear();
            layer.getSource().addFeatures(features);

        },


        createRequest: function () {
            var schema = this;
            var widget = schema.widget;

            var map = widget.map;
            var projection = map.getView().getProjection().getCode().split(':').pop();
            return {
                srid: projection,
                maxResults: schema.maxResults,
                schema: schema.schemaName,
            }

        },

        getData: function (options) {
            var schema = this;
            var widget = schema.widget;


            var callback = options && options.callback;

            var request = schema.createRequest();


            schema.lastRequest = JSON.stringify(request);

            schema.selectXHR = widget.query('select', request).then(function (featureCollection) {
                var xhr = this;
                schema.onFeatureCollectionLoaded(featureCollection, false, xhr);
                if (typeof callback === "function") {
                    callback.apply();
                }
                schema.selectXHR = null;
            });

            return schema.selectXHR;
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
            var geoJsonReader = new ol.format.GeoJSON();
            var newFeatures = geoJsonReader.readFeaturesFromObject({
                type: "FeatureCollection",
                features: featureCollection.features
            });

            schema.layer.getSource().addFeatures(newFeatures);

            schema.layer.getSource().getFeatures().forEach(function (feature) {

            });



        },


        // Overwrite
        getLayerFeatures: function () {
            var schema = this;
            return schema.layer.getSource().getFeatures();
        },

        removeFeatureFromUI: function (feature) {
            var schema = this;
            schema.layer.getSource().removeFeature(feature);
        },

        removeAllFeatures: function () {
            var schema = this;
            schema.layer.getSource().clear();
        },



        // TODO feature / option formData parameters are not pretty -> keep data in feature directly
        saveFeature: function (feature, formData) {
            var schema = this;
            var widget = schema.widget;
            var wkt = new ol.format.WKT().writeFeatureText(feature);
            var srid = widget.map.getView().getProjection().getCode().split(':').pop();

            var createNewFeatureWithDBFeature = function (feature, response) {

                var features = response.features;

                if (features.length === 0) {
                    console.warn("No Feature returned from DB Operation");
                    schema.removeFeatureFromUI(feature);
                    return null;
                } else if (features.length > 1) {
                    console.warn("More than 1 Feature returned from DB Operation");
                }

                var geoJsonReader = new ol.format.GeoJSON();

                var newFeatures = geoJsonReader.readFeaturesFromObject(response);
                var newFeature = _.first(newFeatures);

                if (feature.saveStyleDataCallback) {
                    feature.saveStyleDataCallback(newFeature);
                    feature.saveStyleDataCallback = null;
                }

                return newFeature;

            };


            if (feature.disabled) { // Feature is temporarily disabled
                return;
            }

            feature.disabled = true;

            formData = formData || schema.getSchemaByFeature(feature).formItems.createHeadlessFormData(feature);

            var request = {
                id: feature.getId(),
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


                var newFeature = createNewFeatureWithDBFeature(feature, response);

                if (newFeature == null) {
                    console.warn("Creation of new Feature failed");
                    return;
                }

                newFeature.isNew = false;

                schema.removeFeatureFromUI(feature);
                schema.layer.getSource().addFeature(newFeature);

                $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully"), 'info');


                return response;

            });

            return promise;

        },




        getDefaultProperties: function () {
            var schema = this;

            var newFeatureDefaultProperties = [];
            $.each(schema.tableFields, function (fieldName) {
                newFeatureDefaultProperties.push(fieldName);
            });
            return newFeatureDefaultProperties;
        },





    };


})();
