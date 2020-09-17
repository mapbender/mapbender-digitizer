(function () {
    "use strict";

    /**
     *
     * @param {ol.Feature} feature
     * @param {Mapbender.Digitizer.Scheme} schema
     * @param {Mapbender.Digitizer.PopupConfiguration} configuration
     * @returns {FeatureEditDialog}
     * @constructor
     */
    var FeatureEditDialog = function (feature, schema,configuration) {

        var dialog = this;

        var widget = schema.widget;
        var $popup = dialog.$popup = $("<div/>");

        $popup.data('feature', feature);

        $popup.generateElements({children: schema.formItems});

        console.warn("Creating dm edit dialog", configuration);
        $popup.popupDialog(configuration);


        /** This is evil, but filling of input fields currently relies on that (see select field) **/
        setTimeout(function () {
            $popup.formData(feature.get('data'));
        }, 0);

        $popup.parent().bind("mouseenter",function(){
            feature.dispatchEvent({type: widget.TYPE+'.UnhoverFeature'});
        });

        return dialog;
    };


    Mapbender.Digitizer.PopupConfiguration = function (schema) {
    };

    Mapbender.Digitizer.PopupConfiguration.prototype.createButtons_ = function () {

        var popupConfiguration = this;
        var schema = popupConfiguration.schema;

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
        if (schema.printable && this.printClient) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.print'),
                click: function() {
                    schema.widget.printClient.printDigitizerFeauture(feature, schema);
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


    Object.assign(Mapbender.Digitizer.PopupConfiguration.prototype, {
        createFeatureEditDialog: function (feature, schema) {
            var configuration = this;
            return new FeatureEditDialog(feature, schema, configuration)
        }
    });

})();
