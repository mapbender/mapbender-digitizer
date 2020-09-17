(function () {
    "use strict";

    Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.FeatureEditDialog = {};

    Mapbender.Digitizer.FeatureEditDialog.getPopupConfiguration = function(feature, schema) {
        return Object.assign({}, schema.popup, {
            buttons: this.getButtonConfiguration(feature, schema)
        });
    };

    Mapbender.Digitizer.FeatureEditDialog.getButtonConfiguration = function(feature, schema) {
        var buttons = [];
        if (schema.copy && schema.copy.enable) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.clone.title'),
                click: function() {
                    schema.copyFeature(feature);
                }
            });
        }
        if (schema.allowCustomStyle) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.style.change'),
                click: function() {
                    schema.openChangeStyleDialog(feature);
                }
            });
        }
        // @todo: .printClient access broken (not passed through from widget)
        if (schema.printable && this.printClient) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.print'),
                click: function() {
                    schema.widget.printClient.printDigitizerFeature(feature, schema);
                }
            });
        }

        return buttons;
    };
})();
