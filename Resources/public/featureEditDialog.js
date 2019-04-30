(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function (configuration, schema) {
        var popupConfiguration = this;
        $.extend(popupConfiguration, configuration);

        popupConfiguration.buttons = augmentFeatureEditDialogButtonsWithCustomButtons(configuration, schema);
        $.extend(popupConfiguration.buttons, createButtons(configuration, schema));

        popupConfiguration.getSchema = function(feature) {
            var scheme = schema.getSchemaByFeature(feature);
            return scheme;
        };

        Object.freeze(popupConfiguration.buttons);

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = {
        remoteData: false,
        isOpenLayersCloudPopup: function () {
            return this.type === 'openlayers-cloud';
        },

        addFeatureAndDialog: function (feature,dialog) {

            _.each(this.buttons, function (button) {
                button.click =  button.createClick(feature,dialog);
            });
        },

        clone: function() {
            return $.extend(true, {}, this)
        },


        createFeatureEditDialog: function(feature, schema) {
            return new FeatureEditDialog(feature, schema)
        }
    };

    var augmentFeatureEditDialogButtonsWithCustomButtons = function (configuration, schema) {
        // Initialize custom button events
        var newButtons = {};
        _.each(configuration.buttons, function (button) {
            if (button.click) {
                var eventHandlerCode = button.click;
                newButtons[button.text] = {
                    click: function (e) {
                        var _widget = schema.widget;
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

        return newButtons;
    };

    var createButtons = function (configuration, schema) {
        var widget = schema.widget;


        var createButton = function (title, click) {
            return {
                text: Mapbender.DigitizerTranslator.translate(title),
                createClick: function (feature,dialog) {
                    return function () {
                        click(feature,dialog);
                    };
                }
            }
        };

        var buttons = {};

        if (schema.printable) {
            buttons.printButton = createButton('feature.print', function (feature) {
                widget.printClient.printDigitizerFeature(schema.featureType.name || schema.schemaName, feature.fid);

            });
        }
        if (schema.copy.enable) {
            buttons.copyButton = createButton('feature.clone.title', function (feature) {
                schema.copyFeature(feature);

            });

        }
        if (schema.allowCustomerStyle) {
            buttons.styleButton = createButton('feature.style.change', function (feature) {
                schema.openChangeStyleDialog(feature);
            });
        }
        if (schema.allowEditData && schema.allowSave) {
            buttons.saveButton = createButton('feature.save.title', function (feature,dialog) {
                var formData = dialog.$popup.formData();

                // TODO this is not nice. Find a better solution
                var errorInputs = $(".has-error", dialog.$popup);
                if (errorInputs.length > 0) {
                    console.warn("Error", errorInputs);
                    return;
                }

                dialog.$popup.disableForm();
                schema.saveFeature(feature, formData).done(function (response) {
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
            });
        }
        if (schema.allowDelete) {
            buttons.deleteButton = createButton('feature.remove.title', function (feature,dialog) {
                schema.removeFeature(feature);
                dialog.$popup.popupDialog('close');
            });
        }
        if (schema.allowCancelButton) {
            buttons.cancelButton = createButton('cancel', function (feature,dialog) {
                dialog.$popup.popupDialog('close');
            });
        }

        return buttons;

    };


    var FeatureEditDialog = function (feature, schema) {
        // TODO buttons/realButtons approach is misleading and should be refactored

        var dialog = this;
        dialog.schema = schema;

        var widget = schema.widget;
        var map = widget.map;
        var $popup = dialog.$popup = $("<div/>");

        dialog.feature = feature;

        var configuration = schema.popup.clone();
        configuration.addFeatureAndDialog(feature,dialog);


        var doFeatureEditDialogBindings = function () {
            var $popup = dialog.$popup;
            var feature = dialog.feature;
            var schema = dialog.schema;
            var configuration = dialog.schema.popup;

            var widget = schema.widget;

            $popup.bind('popupdialogclose', function () {

                if (feature.isNew && schema.allowDeleteByCancelNewGeometry) {
                    schema.removeFeature(feature);
                } else
                if ( (feature.isChanged || feature.isNew) && schema.revertChangedGeometryOnCancel) {

                    schema.layer.renderer.eraseGeometry(feature.geometry);
                    feature.geometry = feature.oldGeometry;
                    feature.isChanged = false;
                    schema.layer.drawFeature(feature);

                    schema.unsetModifiedState(feature);

                }
                if (configuration.modal) {
                    widget.currentPopup = null;
                }


            });


            if (configuration.isOpenLayersCloudPopup()) {
                // Hide original popup but not kill it.
                $popup.closest('.ui-dialog').css({
                    'margin-left': '-100000px'
                }).hide(0);
            }
        };


        if (widget.currentPopup) {
            widget.currentPopup.popupDialog('close');
            if (configuration.isOpenLayersCloudPopup() && schema.olFeatureCloudPopup) {
                widget.map.removePopup(schema.olFeatureCloudPopup);
                schema.olFeatureCloudPopup.destroy();
                schema.olFeatureCloudPopup = null;
            }
        }


        widget.currentPopup = $popup;


        $popup.data('feature', feature);

        var processedFormItems = schema.processFormItems(feature, $popup);


        $popup.generateElements({children: processedFormItems});


        $popup.popupDialog(configuration);


        doFeatureEditDialogBindings();

        $popup.formData(feature.data);

        if (configuration.isOpenLayersCloudPopup()) {
            var olPopup = new OpenLayers.Popup.FramedCloud("popup", OpenLayers.LonLat.fromString(feature.geometry.toShortString()), null, $popup.html(), null, true);
            schema.featureCloudPopup = olPopup;
            map.addPopup(olPopup);
        }


    };




})();
