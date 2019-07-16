(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function (configuration, schema) {
        var popupConfiguration = this;
        popupConfiguration.schema = schema;

        $.extend(popupConfiguration, configuration);

        popupConfiguration.checkForDeprecatedUsageOfButtons_();

        popupConfiguration.buttons = popupConfiguration.createButtons_();


        Object.freeze(popupConfiguration.buttons);

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = {
        remoteData: false,


        checkForDeprecatedUsageOfButtons_: function () {
            var configuration = this;
            _.each(configuration.buttons, function (button) {
                console.error("Using Javascript code in the configuration is deprecated:", button);
            });
        },

        createButtons_: function () {
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

            if (schema.allowEditData && schema.allowSave) {
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

        },

        clone: function () {
            return $.extend(true, {}, this)
        },

        initButtons: function(feature) {
            var configuration = this;
            
            $.each(configuration.buttons,function(name,button){
                button.text = button.title  = Mapbender.DigitizerTranslator.translate(button.title);
                button.click = function(event)  {  feature.dispatchEvent({ type: 'Digitizer.FeatureEditDialog.'+button.event }); }
            });
        },

        createFeatureEditDialog: function (feature, schema) {
            return new FeatureEditDialog(feature, schema)
        },

        // This can be overridden
        augment: function (feature, $popup) {

        }
    };


    var FeatureEditDialog = function (feature, schema) {

        var dialog = this;

        var widget = schema.widget;
        var $popup = dialog.$popup = $("<div/>");

        dialog.feature = feature;

        var configuration = schema.popup.clone();

        configuration.initButtons(feature);





        feature.on('Digitizer.FeatureEditDialog.Print', function (event) {

        });

        feature.on('Digitizer.FeatureEditDialog.Copy', function (event) {
        });

        feature.on('Digitizer.FeatureEditDialog.Style', function (event) {
            schema.openChangeStyleDialog(feature);
        });

        feature.on('Digitizer.FeatureEditDialog.Save', function (event)  {
        });

        feature.on('Digitizer.FeatureEditDialog.Delete', function (event) {
        });

        feature.on('Digitizer.FeatureEditDialog.Cancel', function (event) {
        });


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

        };


        widget.currentPopup = $popup;


        $popup.data('feature', feature);

        var processedFormItems = schema.processFormItems(feature, $popup);

        $popup.generateElements({children: processedFormItems});


        $popup.popupDialog(configuration);


        doFeatureEditDialogBindings();

        configuration.augment(feature, $popup);

        /** This is evil, but filling of input fields currently relies on that (see select field) **/
        if (feature.data) {
            setTimeout(function () {
                $popup.formData(feature.data);
            }, 0);
        }

    };


})();
