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

        configuration.initButtons(feature);
        var eventListeners = configuration.createEventListeners(dialog);

        $.each(eventListeners, function (type, listener) {
            feature.on(type, listener);
        });

        widget.currentPopup && widget.currentPopup.popupDialog('close');
        widget.currentPopup = $popup;
        $popup.generateElements({children: schema.formItems});

        console.warn("Creating dm edit dialog", configuration);
        $popup.popupDialog(configuration);


        /** This is evil, but filling of input fields currently relies on that (see select field) **/
        setTimeout(function () {
            $popup.formData(feature.get('data'));
        }, 0);

        $popup.bind('popupdialogclose', function () {
             $.each(eventListeners, function (type, listener) {
                feature.un(type, listener);
            });
        });

        $popup.parent().bind("mouseenter",function(){
            feature.dispatchEvent({type: widget.TYPE+'.UnhoverFeature'});
        });

        return dialog;
    };


    Mapbender.Digitizer.PopupConfiguration = function (schema) {
        var popupConfiguration = this;
        popupConfiguration.schema = schema;

        $.extend(popupConfiguration, schema.popup);

        popupConfiguration.checkForDeprecatedUsageOfButtons_();
        popupConfiguration.buttons = popupConfiguration.createButtons_();

        Object.freeze(popupConfiguration.buttons);
    };

    Mapbender.Digitizer.PopupConfiguration.prototype.createButtons_ = function () {

        var popupConfiguration = this;
        var schema = popupConfiguration.schema;

        var buttons = {};
        if (schema.copy && schema.copy.enable) {
            buttons.copyButton = {
                text: Mapbender.trans('mb.digitizer.feature.clone.title'),
                event: 'Copy'
            };
        }
        if (schema.allowCustomStyle) {
            buttons.styleButton = {
                text: Mapbender.trans('mb.digitizer.feature.style.change'),
                event: 'Style'
            };
        }
        if (schema.printable && this.printClient) {
            buttons.printButton = {
                text: Mapbender.trans('mb.digitizer.feature.print'),
                event: 'Print'
            };
        }
        if (schema.allowEditData) {
            buttons.saveButton = {
                text: Mapbender.trans('mb.digitizer.feature.save.title'),
                event: 'Save',
            };
        }
        if (schema.allowDelete) {
            buttons.deleteButton = {
                text: Mapbender.trans('mb.digitizer.feature.remove.title'),
                event: 'Delete',
            };
        }

        buttons.cancelButton = {
            text: Mapbender.trans('mb.digitizer.cancel'),
            event: 'Cancel',
        };

        return buttons;
    };


    Mapbender.Digitizer.PopupConfiguration.prototype.createEventListeners = function (dialog) {
        var configuration = this;
        var schema = configuration.schema;

        var feature = dialog.$popup.data("feature");

        var eventListeners = {};


        eventListeners['FeatureEditDialog.Copy'] = function (event) {
            schema.copyFeature(feature);
        };

        eventListeners['FeatureEditDialog.Style'] = function (event) {
            schema.openChangeStyleDialog(feature);
        };

        eventListeners['FeatureEditDialog.Print'] = function (event) {
            var printClient = schema.widget.printClient;
            printClient.printDigitizerFeature(feature, schema);
        };

        eventListeners['FeatureEditDialog.Save'] = function (event) {
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

        };

        eventListeners['FeatureEditDialog.Delete'] = function (event) {
            schema.removeFeature(feature);
        };
        eventListeners['FeatureEditDialog.Cancel'] = function (event) {
            dialog.$popup.popupDialog('instance').cancel();
        };

        return eventListeners;
    };

    Object.assign(Mapbender.Digitizer.PopupConfiguration.prototype, {
        checkForDeprecatedUsageOfButtons_: function () {
            var configuration = this;
            _.each(configuration.buttons, function (button) {
                console.error("Using Javascript code in the configuration is deprecated:", button);
            });
        },
        clone: function () {
            return $.extend(true, {}, this)
        },
        initButtons: function (feature) {
            var configuration = this;

            $.each(configuration.buttons, function (name, button) {
                // @todo: avoid self-modification (also saves clone method implementation)
                button.click = function (event) {
                    feature.dispatchEvent({type: 'FeatureEditDialog.' + button.event});
                }
            });
        },
        createFeatureEditDialog: function (feature, schema) {
            var configuration = this;

            return new FeatureEditDialog(feature, schema,configuration.clone())
        }
    });

})();
