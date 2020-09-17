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
        if (schema.allowEditData) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.save.title'),
                click: function() {
                    var formData = dialog.$popup.formData();
                    var $allNamedInputs = $(':input[name]', dialog.$popup);
                    var $invalidInputs = $allNamedInputs.filter(function() {
                        // NOTE: jQuery pseudo-selector :valid can not be chained into a single .find (or snytactic variant)
                        return $(this).is(':not(:valid)');
                    });
                    // @todo vis-ui: some inputs (with ".mandatory") are made invalid only visually when
                    //               empty, but do not have the HTML required or pattern property to
                    //               support selector detection. Work around that here.
                    $invalidInputs = $invalidInputs.add($('.has-error :input', dialog.$popup));
                    if ($invalidInputs.length) {
                        console.warn("Error", $invalidInputs.get());
                        return;
                    }

                    dialog.$popup.disableForm();

                    schema.saveFeature(feature, formData).then(function (response) {
                        if (response.hasOwnProperty('errors')) {
                            dialog.$popup.enableForm();
                            return;
                        }
                        dialog.$popup.popupDialog('instance').close();
                    });
                }
            });
        }
        if (schema.allowDelete) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                click: function() {
                    schema.removeFeature(feature);
                }
            });
        }

        buttons.push({
            text: Mapbender.trans('mb.digitizer.cancel'),
            click: function() {
                dialog.$popup.popupDialog('instance').cancel();
            }
        });

        return buttons;
    };
})();
