var FeatureEditDialog = function (feature, configuration, schema) {
    // TODO buttons/realButtons approach is misleading and should be refactored

    var dialog = this;
    dialog.schema = schema;

    var widget = schema.widget;
    var $popup = dialog.$popup = $("<div/>");

    dialog.configuration = _.clone(configuration);
    dialog.configuration.realButtons = {};
    dialog._augmentFeatureEditDialogButtonsWithCustomButtons();
    dialog._createFeatureEditDialogConfigurationButtons();

    dialog.feature = feature;

    dialog.addClickHandlerToButtons();



    if (widget.currentPopup) {
        widget.currentPopup.popupDialog('close');
        if (dialog.configuration.isOpenLayersCloudPopup() && schema.olFeatureCloudPopup) {
            map.removePopup(schema.olFeatureCloudPopup);
            schema.olFeatureCloudPopup.destroy();
            schema.olFeatureCloudPopup = null;
        }
    }




    widget.currentPopup = $popup;


    $popup.data('feature', feature);

    var formItems = schema.processFormItems(feature);
    $popup.generateElements({children: formItems});


    $popup.popupDialog(dialog.configuration);


    dialog.doFeatureEditDialogBindings();

    dialog.retrieveFeatureTableDataFromDataStore();
    dialog.addFeatureDataToEditDialog();


};

FeatureEditDialog.prototype = {

    addClickHandlerToButtons: function() {

        var dialog = this;
        var schema = dialog.schema;
        var widget = schema.widget;
        var feature = dialog.feature;
        var buttons = dialog.configuration.realButtons;

        if (buttons.printButton) {
            buttons.printButton.click = function() {
                widget.printClient.printDigitizerFeature(schema.featureTypeName || schema.schemaName, feature.fid);
            }
        }
        if (buttons.copyButton) {
            buttons.copyButton.click = function() {
                schema.copyFeature(feature);
            }
        }
        if (buttons.saveButton) {
            buttons.saveButton.click = function () {


                var formData = dialog.$popup.formData();

                // TODO this is not nice. Find a better solution
                var errorInputs = $(".has-error", dialog.$popup);
                if (errorInputs.length > 0) {
                    console.warn("Error",errorInputs);
                    return;
                }

                dialog.$popup.disableForm();
                schema.saveFeature(dialog.feature, formData).done(function(response) {
                    if (response.hasOwnProperty('errors')) {
                        dialog.feature.disabled = false;
                        $.each(response.errors, function (i, error) {
                            $.notify(error.message, {
                                title: 'API Error',
                                autoHide: false,
                                className: 'error'
                            });
                            console.error(error.message);
                        });
                        dialog.$popup.enableForm();

                        return;
                    }

                    dialog.$popup.popupDialog('close');

                });
            };
        }
        if (buttons.styleButton) {
            buttons.styleButton.click = function() {
                schema.openChangeStyleDialog(feature);
            }
        }
        if (buttons.deleteButton) {
            buttons.deleteButton.click = function() {
                schema.removeFeature(feature);
                dialog.$popup.popupDialog('close');
            }
        }
        if (buttons.cancelButton) {
            buttons.cancelButton.click = function() {
                dialog.$popup.popupDialog('close');
            }

        }

        dialog.configuration.buttons = Object.values(buttons);

    },


    doFeatureEditDialogBindings: function () {
        var dialog = this;
        var $popup = dialog.$popup;
        var feature = dialog.feature;
        var configuration = dialog.configuration;


        var schema = this.schema;
        var widget = schema.widget;

        $popup.bind('popupdialogclose', function () {

            if (feature.isNew && schema.allowDeleteByCancelNewGeometry) {
                schema.removeFeature(feature);
            }
            if (feature.isChanged && schema.revertChangedGeometryOnCancel) {
                schema.layer.renderer.eraseGeometry(feature.geometry);
                feature.geometry = feature.oldGeometry;
                feature.isChanged = false;
                schema.layer.drawFeature(feature);
            }
            if (configuration.modal) {
                widget.currentPopup = null;
            }
        });


        if (dialog.configuration.isOpenLayersCloudPopup()) {
            // Hide original popup but not kill it.
            $popup.closest('.ui-dialog').css({
                'margin-left': '-100000px'
            }).hide(0);
        }
    },


    // TODO find out what this is for
    retrieveFeatureTableDataFromDataStore: function () {
        var dialog = this;
        var $popup = dialog.$popup;
        var feature = dialog.feature;

        var tables = $popup.find(".mapbender-element-result-table");
        // TODO Tables exist only when
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



        setTimeout(function () {


            $popup.formData(feature.data);

            if (dialog.configuration.isOpenLayersCloudPopup()) {
                /**
                 * @var {OpenLayers.Popup.FramedCloud}
                 */
                var olPopup = new OpenLayers.Popup.FramedCloud("popup", OpenLayers.LonLat.fromString(feature.geometry.toShortString()), null, $popup.html(), null, true);
                schema.featureCloudPopup = olPopup;
                map.addPopup(olPopup);
            }

        }, 21);
    },




    _augmentFeatureEditDialogButtonsWithCustomButtons: function () {
        var dialog = this;
        var configuration = dialog.configuration;
        var schema = dialog.schema;
        var widget = schema.widget;

        var i = 0;

        // Initialize custom button events
        _.each(configuration.buttons, function (button) {
            if (button.click) {
                var eventHandlerCode = button.click;
                configuration.realButtons[i++] = {
                    click : function (e) {
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
            }
        });
    },


    _createFeatureEditDialogConfigurationButtons: function () {

        var dialog = this;
        var configuration = dialog.configuration;
        var schema = dialog.schema;
        var buttons = configuration.realButtons;

        if (schema.printable) {
            buttons.printButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.print')
            };
        }
        if (schema.copy.enable) {
            buttons.copyButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.clone.title')
            };
        }
        if (schema.allowCustomerStyle) {
            buttons.styleButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.style.change')
            };
        }
        if (schema.allowEditData && schema.allowSave) {
            buttons.saveButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.save.title')
            };
        }
        if (schema.allowDelete) {
            buttons.deleteButton = {
                text: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                'class': 'critical',
            };
        }
        if (schema.allowCancelButton) {
            buttons.cancelButton = {
                text: Mapbender.DigitizerTranslator.translate('cancel')
            };
        }

    }



};
