(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function () {
        Mapbender.DataManager.PopupConfiguration.apply(this, arguments);

        this.PREFIX = "Digitizer";

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = Object.create(Mapbender.DataManager.PopupConfiguration.prototype);
    Mapbender.Digitizer.PopupConfiguration.prototype.constructor = Mapbender.DataManager.PopupConfiguration;

    Mapbender.Digitizer.PopupConfiguration.prototype.createButtons_ = function () {

        var popupConfiguration = this;
        var schema = popupConfiguration.schema;

        var buttons = {};
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

        buttons.cancelButton = {
            title: 'cancel',
            event: 'Cancel',
        };

        return buttons;

    };


    Mapbender.Digitizer.PopupConfiguration.prototype.createEventListeners = function (dialog) {
        var configuration = this;
        var schema = configuration.schema;

        var feature = dialog.$popup.data("feature");

        var eventListeners = {};


        eventListeners[configuration.PREFIX + '.FeatureEditDialog.Copy'] = function (event) {
            schema.copyFeature(feature);
        };

        eventListeners[configuration.PREFIX + '.FeatureEditDialog.Style'] = function (event) {
            schema.openChangeStyleDialog(feature);
        };


        eventListeners = Object.assign({}, eventListeners, Mapbender.DataManager.PopupConfiguration.prototype.createEventListeners.apply(this, arguments));

        return eventListeners;

    };


})();
