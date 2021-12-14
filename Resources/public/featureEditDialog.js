(function () {
    "use strict";

    Mapbender.Digitizer.FeatureEditDialog = {
    getButtonsOption_: function($dialog, schema, feature) {
        var buttons = [];
        if (schema.printable) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.print'),
                click: function() {
                    schema.widget.printClient.printDigitizerFeature(feature, schema.schemaName);
                }
            });
        }
        if (!schema.disableAggregation && !feature.isNew && schema.copy && schema.copy.enable) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.clone.title'),
                click: function() {
                    schema.widget.getCurrentSchema().copyFeature(feature);
                }
            });
        }
        if (!schema.disableAggregation && schema.allowCustomStyle) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.style.change'),
                click: function() {
                    schema.openChangeStyleDialog(feature);
                }
            });
        }
        if (!schema.disableAggregation && schema.allowEditData && schema.allowSave) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.save.title'),
                click: function() {
                    var formData = $dialog.formData();

                    // TODO this is not nice. Find a better solution
                    var errorInputs = $('.has-error', $dialog);
                    if (errorInputs.length > 0) {
                        console.warn("Error", errorInputs);
                        return;
                    }

                    $dialog.disableForm();
                    schema.saveFeature(feature, formData).then(function (response) {
                        if (!response) {
                            console.error("Caution: save operation did not return any result - this might occur due to a filter setting")
                        } else {
                            if (response.hasOwnProperty('errors')) {
                                $dialog.enableForm();
                                return;
                            }
                        }

                        $dialog.dialog('close');
                    });
                }
            });
        }
        if (!schema.disableAggregation && schema.allowDelete) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                click: function() {
                    schema.widget.deleteFeature(feature);
                    $dialog.dialog('close');
                }
            });
        }
        if (schema.allowCancelButton) {
            buttons.push({
                text: Mapbender.trans('mb.digitizer.cancel'),
                click: function() {
                    $dialog.dialog('close');
                }
            });
        }

        return buttons;
    },
    open: function(feature, schema) {

        var widget = schema.widget;
        var $popup = $("<div/>");

        var configuration = Object.assign({}, schema.popup, {
            classes: {
                'ui-dialog': 'ui-dialog digitizer-dialog'
            },
            buttons: this.getButtonsOption_($popup, schema, feature)
        });

            $popup.on('popupdialogclose', function () {
                if (feature.isNew) {
                    schema.widget.deleteFeature(feature);
                } else if (feature.isChanged && schema.getSchemaByFeature(feature).revertChangedGeometryOnCancel) {
                    feature.geometry = feature.oldGeometry;
                    schema.setModifiedState(feature, false, null);
                    schema.layer.drawFeature(feature);
                }
            });


        widget.currentPopup && widget.currentPopup.dialog('close');
        widget.currentPopup = $popup;


        var formItems = JSON.parse(JSON.stringify(schema.formItems)); // Deep clone hack!

        var processedFormItems = Mapbender.Digitizer.Utilities.processFormItems(feature,formItems,schema);

        $popup.generateElements({children: processedFormItems, declarations: configuration.declarations || {} });

        $popup.popupDialog(configuration);



        /** This is evil, but filling of input fields currently relies on that (see select field) **/
        setTimeout(function () {
            $popup.closest('.ui-dialog').data('feature', feature);
            $popup.formData(feature.data);
        },0);

    }
    };


})();
