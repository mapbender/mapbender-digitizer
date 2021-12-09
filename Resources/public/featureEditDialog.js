(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function (configuration, schema) {

        var popupConfiguration = this;
        popupConfiguration.schema = schema;

        $.extend(popupConfiguration, configuration);

        var createButtons = function () {
            var widget = schema.widget;


            var createButton = function (title, click) {
                return {
                    text: Mapbender.trans('mb.digitizer.' + title),
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
                    widget.printClient.printDigitizerFeature(feature, featureSchema.schemaName ).then(function(){ // On Finish, on Close
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
                    schema.saveFeature(feature, formData).then(function (response) {
                        if (!response) {
                            console.error("Caution: save operation did not return any result - this might occur due to a filter setting")
                        } else
                        if (response.hasOwnProperty('errors')) {
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

        $.extend(popupConfiguration.buttons, createButtons());

        Object.freeze(popupConfiguration.buttons);

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = {
        remoteData: false,


        addFeatureAndDialog: function (feature, dialog) {

            _.each(this.buttons, function (button) {
                button.click = button.createClick(feature, dialog);
            });

            // buttons are deep copied! Should be moved to button constructing function though
            if (feature.isNew) {
                //delete this.buttons.styleButton;
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
        var $popup = dialog.$popup = $("<div/>");

        dialog.feature = feature;

        var configuration = schema.popup.clone();

        configuration.addFeatureAndDialog(feature, dialog);
        configuration.classes = {
            'ui-dialog': 'ui-dialog digitizer-dialog'
        };

        dialog.schema = schema.getSchemaByFeature(feature);
        configuration.title = schema.getSchemaByFeature(feature).popup.title;
        configuration.width = schema.getSchemaByFeature(feature).popup.width;

        var doFeatureEditDialogBindings = function () {
            var feature = dialog.feature;

            $popup.bind('popupdialogclose', function () {

                if (feature.isNew && schema.allowDeleteByCancelNewGeometry) {
                    schema.removeFeature(feature);
                } else if ((feature.isChanged || feature.isNew) && schema.getSchemaByFeature(feature).revertChangedGeometryOnCancel) {

                    schema.layer.renderer.eraseGeometry(feature.geometry);
                    feature.geometry = feature.oldGeometry;
                    feature.isChanged = false;
                    schema.layer.drawFeature(feature);
                    schema.setModifiedState(feature, false, null);

                }
            });

        };



        widget.currentPopup && widget.currentPopup.popupDialog('close');
        widget.currentPopup = $popup;


        $popup.data('feature', feature);

        var formItems = JSON.parse(JSON.stringify(dialog.schema.formItems)); // Deep clone hack!

        var processedFormItems = Mapbender.Digitizer.Utilities.processFormItems(feature,formItems,dialog);

        $popup.generateElements({children: processedFormItems, declarations: configuration.declarations || {} });

        $popup.popupDialog(configuration);


        doFeatureEditDialogBindings();

        /** This is evil, but filling of input fields currently relies on that (see select field) **/
        setTimeout(function () {
            $popup.formData(feature.data);
        },0);

    };



})();
