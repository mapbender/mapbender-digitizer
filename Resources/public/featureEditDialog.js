(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function (configuration, schema) {
        var popupConfiguration = this;
        $.extend(popupConfiguration, configuration);

        var augmentFeatureEditDialogButtonsWithCustomButtons = function () {
            // Initialize custom button events
            var newButtons = {};
            _.each(configuration.buttons, function (button) {
                newButtons[button.text] = _.clone(button);
                if (button.click) {
                    console.error("Using Javascript code in the configuration is deprecated");

                    newButtons[button.text].createClick = function (feature, dialog) {

                        return function (e) {
                            var _widget = schema.widget;
                            var el = $(this);
                            var form = dialog;
                            var data = feature.data;

                            eval(button.click);
                            e.preventDefault();
                            return false;
                        }
                    }
                }

            });

            return newButtons;
        };

        var createButtons = function () {
            var widget = schema.widget;


            var createButton = function (title, click) {
                return {
                    text: Mapbender.DigitizerTranslator.translate(title),
                    createClick: function (feature, dialog) {
                        return function () {
                            click(feature, dialog);
                        };
                    }
                }
            };

            var buttons = {};

            if (schema.printable) {
                buttons.printButton = createButton('feature.print', function (feature) {
                    var featureSchema = schema.getSchemaByFeature(feature);
                    widget.printClient.printDigitizerFeature(featureSchema.schemaName, feature.fid).then(function(){ // On Finish, on Close
                    });

                });
            }
            if (schema.copy.enable) {
                buttons.copyButton = createButton('feature.clone.title', function (feature) {
                    schema.copyFeature(feature);

                });

            }
            if (schema.allowCustomStyle) {
                buttons.styleButton = createButton('feature.style.change', function (feature) {
                    schema.openChangeStyleDialog(feature);
                });
            }
            if (schema.allowEditData && schema.allowSave) {
                buttons.saveButton = createButton('feature.save.title', function (feature, dialog) {
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
                buttons.deleteButton = createButton('feature.remove.title', function (feature, dialog) {
                    schema.removeFeature(feature);
                    dialog.$popup.popupDialog('close');
                });
            }
            if (schema.allowCancelButton) {
                buttons.cancelButton = createButton('cancel', function (feature, dialog) {
                    dialog.$popup.popupDialog('close');
                });
            }

            return buttons;

        };

        popupConfiguration.buttons = augmentFeatureEditDialogButtonsWithCustomButtons();
        $.extend(popupConfiguration.buttons, createButtons());

        popupConfiguration.getSchema = function (feature) {
            var scheme = schema.getSchemaByFeature(feature);
            return scheme;
        };


        Object.freeze(popupConfiguration.buttons);

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = {
        remoteData: false,

        isOpenLayersCloudPopup: function () {
            var isCloud = this.type === 'openlayers-cloud';
            return isCloud;
        },

        addFeatureAndDialog: function (feature, dialog) {

            _.each(this.buttons, function (button) {
                button.click = button.createClick(feature, dialog);
            });

            // buttons are deep copied! Should be moved to button constructing function though
            if (feature.isNew) {
                delete this.buttons.styleButton;
                delete this.buttons.copyButton;
            }
        },

        clone: function () {
            return $.extend(true, {}, this)
        },


        createFeatureEditDialog: function (feature, schema) {
            return new FeatureEditDialog(feature, schema)
        }
    };



    // TODO - - Carefully separate Feature Scheme and Loading Scheme in order to, for example, enable buttons of other schemes in allscheme!

    var FeatureEditDialog = function (feature, schema) {

        var dialog = this;

        var widget = schema.widget;
        var map = widget.map;
        var $popup = dialog.$popup = $("<div/>");

        dialog.feature = feature;

        var configuration = schema.popup.clone();

        configuration.addFeatureAndDialog(feature, dialog);


        var doFeatureEditDialogBindings = function () {
            var feature = dialog.feature;

            $popup.bind('popupdialogclose', function () {

                if (feature.isNew && schema.allowDeleteByCancelNewGeometry) {
                    schema.removeFeature(feature);
                } else if ((feature.isChanged || feature.isNew) && schema.revertChangedGeometryOnCancel) {

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


            // TODO this looks evil. Test it and change it
            if (configuration.isOpenLayersCloudPopup()) {
                $popup.closest('.ui-dialog').css({'margin-left': '-100000px' }).hide(0);
            }
        };


        if (widget.currentPopup) {
            widget.currentPopup.popupDialog('close');
            if (configuration.isOpenLayersCloudPopup() && schema.featureCloudPopup) {
                widget.map.removePopup(schema.featureCloudPopup);
                schema.featureCloudPopup.destroy();
                schema.featureCloudPopup = null;
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
            // TODO find better solution for ImgPath
            var originalImagePath = OpenLayers.ImgPath;
            OpenLayers.ImgPath =  schema.widget.getOpenLayersCloudImagePath();
            var olPopup = new OpenLayers.Popup.FramedCloud("popup", OpenLayers.LonLat.fromString(feature.geometry.toShortString()), null, $popup.html(), null, true);
            schema.featureCloudPopup = olPopup;
            map.addPopup(olPopup);
            OpenLayers.ImgPath = originalImagePath;
        }


    };


})();
