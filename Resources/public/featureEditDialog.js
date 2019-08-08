(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function () {
        Mapbender.DataManager.PopupConfiguration.apply(this, arguments);

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = Object.create(Mapbender.DataManager.PopupConfiguration.prototype);
    Mapbender.Digitizer.PopupConfiguration.prototype.constructor = Mapbender.DataManager.PopupConfiguration;

    Mapbender.Digitizer.PopupConfiguration.prototype.createButtons_ = function () {

        var popupConfiguration = this;
        var schema = popupConfiguration.schema;

        var buttons = {};
        if (schema.printable) {
            buttons.printButton = {
                title: 'feature.print',
                event: 'Print'
            };
        }
        if (schema.copy && schema.copy.enable) {
            buttons.copyButton = {
                title: 'feature.clone.title',
                event: 'Copy'
            };
        }
        if (schema.allowCustomStyle) {
            buttons.styleButton = {
                title: 'feature.style.change',
                event: 'Style'
            };
        }

        if (schema.allowEditData) {
            buttons.saveButton = {
                title: 'feature.save.title',
                event: 'Save',
            };
        }
        if (schema.allowDelete) {
            buttons.deleteButton = {
                title: 'feature.remove.title',
                event: 'Delete',
            };
        }
        if (schema.allowCancelButton) {
            buttons.cancelButton = {
                title: 'cancel',
                event: 'Cancel',
            };
        }

        return buttons;

    };


    Mapbender.Digitizer.PopupConfiguration.prototype.createEventListeners = function (dialog) {
        var configuration = this;
        var schema = configuration.schema;

        var eventListeners =
            {

                'Digitizer.FeatureEditDialog.Print': function (event) {

                },
                'Digitizer.FeatureEditDialog.Copy': function (event) {
                    schema.copyFeature(feature);
                },
                'Digitizer.FeatureEditDialog.Style': function (event) {
                    schema.openChangeStyleDialog(feature);
                },
                'Digitizer.FeatureEditDialog.Save': function (event) {
                    var formData = dialog.$popup.formData();

                    dialog.$popup.disableForm();

                    schema.saveFeature(feature, formData).then(function (response) {

                        if (response.hasOwnProperty('errors')) {
                            dialog.$popup.enableForm();
                            return;
                        }
                        dialog.$popup.popupDialog('close');
                    });

                },
                'Digitizer.FeatureEditDialog.Delete': function (event) {
                    schema.removeFeature(feature);
                },
                'Digitizer.FeatureEditDialog.Cancel': function (event) {
                    dialog.$popup.popupDialog('close');
                }

            };


        return eventListeners;

    };


})();
