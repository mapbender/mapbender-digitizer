var FeatureEditDialogFactory = function (configuration, schema) {

    this.schema = schema;

    this.configuration = _.clone(configuration);
    this.configuration.buttons = this.configuration.buttons || [];

    this._createFeatureEditDialogConfigurationButtons();


};


FeatureEditDialogFactory.prototype = {


    createFeatureEditDialog: function (feature) {
        var factory = this;

        return new FeatureEditDialog(feature, factory.configuration, factory.schema);

    },

    _augmentFeatureEditDialogButtonsWithConfigurationButtons: function () {
        var factory = this;
        var configuration = factory.configuration;
        var schema = factory.schema;
        var widget = schema.widget;

        // Initialize custom button events
        _.each(configuration.buttons, function (button) {
            if (button.click) {
                var eventHandlerCode = button.click;
                button.click = function (e) {
                    var _widget = widget;
                    var el = $(this);
                    var form = $(this).closest(".ui-dialog-content");
                    var feature = form.data('feature');
                    var data = feature.data;

                    eval(eventHandlerCode);

                    e.preventDefault();
                    return false;
                }
            }
        });
    },


    _createFeatureEditDialogConfigurationButtons: function () {

        var factory = this;
        var configuration = factory.configuration;
        var schema = factory.schema;

        var buttons = configuration.buttons;

        this._augmentFeatureEditDialogButtonsWithConfigurationButtons();

        if (schema.printable) {
            var printButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.print'),
                click: function () {
                    var printWidget = $('.mb-element-printclient').data('mapbenderMbPrintClient');
                    if (printWidget) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        printWidget.printDigitizerFeature(schema.featureTypeName || schema.schemaName, feature.fid);
                    } else {
                        $.notify('Druck Element ist nicht verfügbar!');
                    }
                }
            };
            buttons.push(printButton);
        }
        if (schema.copy.enable) {
            buttons.push({
                text: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                click: function (e) {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.copyFeature(olFeature); // TODO possibly a bug?
                }
            });
        }
        if (schema.allowCustomerStyle) {
            var styleButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                click: function (e) {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.openChangeStyleDialog(feature);
                }
            };
            buttons.push(styleButton);
        }
        if (schema.allowEditData && schema.allowSave) {
            var saveButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.save.title'),
                click: function () {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.saveFeature(feature);
                }
            };
            buttons.push(saveButton);
        }
        if (schema.allowDelete) {
            buttons.push({
                text: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                'class': 'critical',
                click: function () {
                    var dialog = $(this).closest('.ui-dialog-content');
                    var feature = dialog.data('feature');
                    schema.removeFeature(feature);
                    schema.widget.currentPopup.popupDialog('close');
                }
            });
        }
        if (schema.allowCancelButton) {
            buttons.push({
                text: Mapbender.DigitizerTranslator.translate('cancel'),
                click: function () {
                    schema.widget.currentPopup.popupDialog('close');
                }.bind(this)
            });
        }

    },


};

var FeatureEditDialog = function (feature, configuration, schema) {

    var dialog = this;
    var widget = schema.widget;
    var $popup = dialog.$popup = $("<div/>");

    dialog.feature = feature;
    dialog.schema = schema;
    dialog.configuration = configuration;


    if (widget.currentPopup) {
        widget.currentPopup.popupDialog('close');
        if (dialog.isOpenLayerCloudPopup() && schema.olFeatureCloudPopup) {
            map.removePopup(schema.olFeatureCloudPopup);
            schema.olFeatureCloudPopup.destroy();
            schema.olFeatureCloudPopup = null;
        }
    }


    // TODO comprehensive schema throws Exception because no formItems
    try {
        var dataManagerUtils = new DataManagerUtils(widget);
        dataManagerUtils.processCurrentFormItemsWithDataManager(feature, schema);
    } catch (e) {
        console.warn(e);
    }


    widget.currentPopup = $popup;


    $popup.data('feature', feature);

    var formItems = schema.getFormItems(feature);
    $popup.generateElements({children: formItems});

    $popup.popupDialog(configuration);


    dialog.doFeatureEditDialogBindings(feature, $popup);

    dialog.retrieveFeatureTableDataFromDataStore(feature, $popup);
    dialog.addFeatureDataToEditDialog(feature, $popup);


};

FeatureEditDialog.prototype = {

    isOpenLayerCloudPopup: function () {
        var dialog = this;

        return dialog.configuration.type && dialog.configuration.type === 'openlayers-cloud';
    },

    doFeatureEditDialogBindings: function () {
        var dialog = this;
        var $popup = dialog.$popup;
        var feature = dialog.feature;
        var configuration = dialog.configuration;


        var schema = this.schema;
        var widget = schema.widget;

        var isOpenLayerCloudPopup = configuration.type && configuration.type === 'openlayers-cloud';


        $popup.bind('popupdialogclose', function () {
            if (feature.isNew && schema.allowDeleteByCancelNewGeometry) {
                schema.removeFeature(feature);
            }
            if (configuration.modal) {
                widget.currentPopup = null;
            }
        });


        if (isOpenLayerCloudPopup) {
            // Hide original popup but not kill it.
            $popup.closest('.ui-dialog').css({
                'margin-left': '-100000px'
            }).hide(0);
        }
    },


    retrieveFeatureTableDataFromDataStore: function () {
        var dialog = this;
        var $popup = dialog.$popup;
        var feature = dialog.feature;

        var tables = $popup.find(".mapbender-element-result-table");

        _.each(tables, function (table) {

            var item = $(table).data('item');
            $(table).data('feature', feature);
            if (item.editable) {
                item.columns.pop();
            }

            var dataStoreLinkName = item.dataStoreLink.name;
            if (dataStoreLinkName) {
                var requestData = {
                    dataStoreLinkName: dataStoreLinkName,
                    fid: feature.fid,
                    fieldName: item.dataStoreLink.fieldName
                };

                QueryEngine.query('dataStore/get', requestData).done(function (data) {
                    if (Array.isArray(data)) {

                        var dataItems = [];
                        _.each(data, function (el, i) {
                            el.attributes.item = item;
                            dataItems.push(el.attributes)

                        });

                    } else {
                        data.item = item;
                    }

                    var tableApi = $(table).resultTable('getApi');
                    tableApi.clear();
                    tableApi.rows.add(dataItems);
                    tableApi.draw();

                });
            }

        });
    },

    addFeatureDataToEditDialog: function () {
        var dialog = this;
        var $popup = dialog.$popup;
        var feature = dialog.feature;
        var configuration = dialog.configuration;

        var schema = this.schema;
        var widget = schema.widget;
        var layer = schema.layer;
        var map = layer.map;

        var isOpenLayerCloudPopup = configuration.type && configuration.type === 'openlayers-cloud';


        setTimeout(function () {

            if (configuration.remoteData && feature.isNew) {


                var bbox = $popup.data("feature").geometry.getBounds();
                bbox.right = parseFloat(bbox.right + 0.00001);
                bbox.top = parseFloat(bbox.top + 0.00001);
                bbox = bbox.toBBOX();
                var srid = map.getProjection().replace('EPSG:', '');
                var url = widget.elementUrl + "getFeatureInfo/";

                $.ajax({
                    url: url, data: {
                        bbox: bbox,
                        schema: schema.schemaName,
                        srid: srid
                    }
                }).success(function (response) {
                    _.each(response.dataSets, function (dataSet) {
                        var newData = JSON.parse(dataSet).features[0].properties
                        $.extend(feature.data, newData);


                    });
                    $popup.formData(feature.data);

                });


            } else {
                $popup.formData(feature.data);
            }


            if (isOpenLayerCloudPopup) {
                /**
                 * @var {OpenLayers.Popup.FramedCloud}
                 */
                var olPopup = new OpenLayers.Popup.FramedCloud("popup", OpenLayers.LonLat.fromString(feature.geometry.toShortString()), null, $popup.html(), null, true);
                schema.featureCloudPopup = olPopup;
                map.addPopup(olPopup);
            }

        }, 21);
    },


};