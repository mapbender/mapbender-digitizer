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

        this.sources_ = {
            'all' : new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                loader: schema.getData.bind(schema),
                strategy: ol.loadingstrategy.all
            }),
            'bbox' : new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                loader: function(extent,resolution,projection) {
                    this.resolution = resolution;
                    schema.getData.bind(schema).apply(this,arguments);
                },
                //strategy: ol.loadingstrategy.bbox
                strategy: function(extent, resolution) {
                    if(this.resolution && this.resolution != resolution){
                        this.loadedExtentsRtree_.clear();
                    }
                    return [extent];
                }
            }),

        };

        // this.sources_['all'].on(ol.events.EventType.CHANGE, function(event){
        //     schema.menu.resultTable.redrawResultTableFeatures(event.target.getFeatures());
        //
        //
        // });
        //
        // this.sources_['bbox'].on(ol.events.EventType.CHANGE, function(event){
        //     schema.menu.resultTable.redrawResultTableFeatures(event.target.getFeatures());
        //
        //
        // });
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

        schema.createSchemaFeatureLayer_();

        schema.addSelectControl_();

        schema.createMenu_();

        schema.initializeWithDefaultStyles_();


        schema.styles.default = ol.style.StyleConverter.convertToOL4Style(schema.styles.default);
        schema.styles.select = ol.style.StyleConverter.convertToOL4Style(schema.styles.select);
        schema.styles.unsaved =ol.style.StyleConverter.convertToOL4Style(schema.styles.unsaved);

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

    };


    Mapbender.Digitizer.Scheme.prototype = {

        initializeWithDefaultStyles_: function() {
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

            $.each(styles,function(label,style){
               schema.styles[label] = schema.styles[label] || style;

            });

        },


        createPopupConfiguration_: function () {
            var schema = this;
            schema.popup = new Mapbender.Digitizer.PopupConfiguration(schema.popup, schema);
        },


        getVectorSource: function(strategy) {
            var schema = this;
            return schema.sources_[strategy];
        },

        createSchemaFeatureLayer_: function () {
            var schema = this;
            var widget = schema.widget;


            var layer = new ol.layer.Vector({
                source: schema.getVectorSource(schema.currentExtentSearch ? 'bbox' : 'all'),
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

                    feature.dispatchEvent({ type: 'Digitizer.HoverFeature', hover: true});

                });

                e.deselected.forEach(function (feature) {
                   feature.dispatchEvent({ type: 'Digitizer.HoverFeature', hover: false});
                });

            });

            highlightControl.setActive(false);

            var selectControl = new ol.interaction.Select({

                condition: ol.events.condition.singleClick,
                layers: [schema.layer],
                style: function() {
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

        deactivateInteractions: function() {
            var schema = this;
            schema.menu.toolSet.activeInteraction && schema.menu.toolSet.activeInteraction.setActive(false);
            schema.highlightControl.setActive(false);
            schema.selectControl.setActive(false);
        },


        openFeatureEditDialog: function (feature) {
            var schema = this;
            schema.popup.createFeatureEditDialog(feature, schema);
        },



        introduceFeature: function(feature) {

            var schema = this;
            feature.mbOrigin = 'digitizer';

            feature.setStyle(schema.styles.default);

            feature.on('Digitizer.HoverFeature', function(event) {

                schema.menu.resultTable.hoverInResultTable(feature,event.hover);
                feature.setStyle(event.hover ? schema.styles.select : feature.temporaryStyle || schema.styles.default);

            });
        },


        createRequest_: function (extent,projectionCode) {
            var schema = this;

            var request = {
                srid: projectionCode,
                maxResults: schema.maxResults,
                schema: schema.schemaName,

            };

            if (schema.layer.getSource().strategy_ !== ol.loadingstrategy.all) {
                 var extentPolygon = new ol.geom.Polygon.fromExtent(extent);
                 request['intersectGeometry'] =  new ol.format.WKT().writeGeometryText(extentPolygon);
            }


            return request;

        },

        reload: function(currentExtent) {
            var schema = this;
            var source = currentExtent ? schema.getVectorSource('bbox') : schema.getVectorSource('all');
            schema.layer.setSource(source);
            source.clear();
            source.refresh();
        },

        getData: function (extent, resolution, projection) {

            var schema = this;
            var widget = schema.widget;

            var request = schema.createRequest_(extent,projection.getCode().split(":").pop());

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

            $.each(schema.layer.getSource().getFeatures(),function(key,feature) {
                schema.layer.getSource().removeFeature(feature);
            });

            newFeatures.forEach(function (feature) {
                schema.introduceFeature(feature);
            });

            schema.layer.getSource().addFeatures(newFeatures);
            schema.redrawFeaturesInResultTable();

        },

        notifyResultTable: function() {
          var schema = this;
        },

        redrawFeaturesInResultTable: function() {
            var schema = this;
            var features = schema.layer.getSource().getFeatures();
            schema.menu.resultTable.redrawResultTableFeatures(features);
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
                geometry:  new ol.format.WKT().writeGeometryText(feature.getGeometry()),
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
