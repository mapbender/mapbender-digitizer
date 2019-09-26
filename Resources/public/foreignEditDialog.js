(function () {
    "use strict";

    /**
     *
     * @param dataItem
     * @param formItem
     * @param parentTable
     * @param parentDialog
     */



    Mapbender.Digitizer.ForeignEditDialog = function (dataItem, formItem, parentTable, parentDialog) {
        var dialog = this;
        var buttons = [];
        dialog.dataItem = dataItem;
        dialog.formItem = formItem;
        dialog.parentDialog = parentDialog;
        dialog.schema = parentDialog.schema;
        dialog.parentTable = parentTable;

        var formItems = JSON.parse(JSON.stringify(formItem.popupItems));

        var $popup = dialog.$popup = $("<div/>");

        if (parentDialog.$popup.currentPopup) {
            parentDialog.$popup.currentPopup.popupDialog('close');
            parentDialog.$popup.currentPopup = null;
        }

        var refreshConnectedDataManager = function () {
            $('.mb-element').filter(function (i, el) {
                return !!$(el).data()["mapbenderMbDataManager"]
            }).each(function (i, el) {

                var dataManager = $(el).data()["mapbenderMbDataManager"];

                if (!!dataManager.options.schemes[formItem.connectedDataManager]) {
                    dataManager._getData(dataManager.currentSettings);
                    console.log("Data Manager "+formItem.connectedDataManager+" refreshed");
                }
            });

        };

        var saveButton = {
            text: Mapbender.DigitizerTranslator.translate("feature.save.title", false),
            click: function () {
                dialog.saveForeignDataStoreItem(refreshConnectedDataManager);
            }
        };
        buttons.push(saveButton);

        buttons.push({

            text: Mapbender.DigitizerTranslator.translate("feature.remove.title", false),
            class: 'critical',
            click: function () {

                dialog.deleteForeignDataStoreItem(refreshConnectedDataManager);

            }
        });

        buttons.push({
            text: Mapbender.DigitizerTranslator.translate("cancel"),
            click: function () {
                $popup.popupDialog('close');
                parentDialog.$popup.currentPopup = null;
            }
        });


        $popup.on("popupdialogopen", function (event, ui) {
            setTimeout(function () {
                $popup.formData(dataItem);
            }, 0);
        });


        var processedFormItems = Mapbender.Digitizer.Utilities.processFormItems(dataItem,formItems,dialog);

        var popupConfig = _.extend({

            title: dataItem.item.title, //Mapbender.DigitizerTranslator.translate("feature.attributes"),

            width: dataItem.item.width || "423px",
        }, formItem.popup);

        popupConfig.buttons = buttons;

        $popup.generateElements({children: processedFormItems});
        $popup.popupDialog(popupConfig);
        $popup.addClass("data-store-edit-data");
        parentDialog.$popup.currentPopup = $popup;
        // $popup.data('schema', subschema);
        // $popup.data('table', ref);

        return $popup;

    };


    Mapbender.Digitizer.ForeignEditDialog.prototype.refreshParentTable = function(data) {
        var dialog = this;

        var tableApi = dialog.parentTable.resultTable('getApi');
        var processedData = [];

        if (Array.isArray(data)) {
            $.each(data, function (i,e) {
                if (e.hasOwnProperty('attributes')) {
                    e.attributes.item = dialog.formItem;
                    processedData.push(e.attributes);
                }
            });

        } else {
            if (data.hasOwnProperty('attributes')) {
                data.attributes.item = dialog.formItem;
                processedData = [data.attributes];

            }
        }
        tableApi.clear();
        tableApi.rows.add(processedData);
        tableApi.draw();
    };


    Mapbender.Digitizer.ForeignEditDialog.prototype.deleteForeignDataStoreItem = function(callback) {
        var dialog = this;
        var formItem = dialog.formItem;
        var dataItem = dialog.dataItem;
        var schema = dialog.schema;
        var widget = schema.widget;
        var $popup = dialog.$popup;

        Mapbender.confirmDialog({

            html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
            onSuccess: function () {

                var uniqueIdKey = formItem.dataStore.uniqueId;
                widget.query('datastore/remove', {
                    schema: formItem.dataStoreLink.name,
                    dataItemId: dataItem[uniqueIdKey],
                    dataStoreLinkFieldName: formItem.dataStoreLink.fieldName,
                    linkId: dataItem[dataItem.item.dataStoreLink.fieldName]

                }).done(function (response) {

                    if (response.processedItem.hasOwnProperty('errors')) {
                        $popup.enableForm();
                        $.each(response.errors, function (i, error) {
                            $.notify(error.message, {
                                title: 'API Error',
                                autoHide: false,
                                className: 'error'
                            });
                            console.error(error.message);
                        });
                        return;
                    }

                    dialog.refreshParentTable(response.dataItems);

                    dialog.$popup.popupDialog('close');
                    dialog.parentDialog.$popup.currentPopup = null;
                    $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');
                    callback();

                })

            }
        });

    };

    Mapbender.Digitizer.ForeignEditDialog.prototype.saveForeignDataStoreItem = function (callback) {

        var dialog = this;
        var dataItem = dialog.dataItem;
        var $popup = dialog.$popup;
        var subschema = dataItem.item;
        var schema = dialog.schema;
        var widget = schema.widget;

        var uniqueIdKey = dataItem.item.dataStore.uniqueId;
        var isNew = dataItem[uniqueIdKey] === null;
        var formData = $popup.formData();

        if (!isNew) {

            formData[uniqueIdKey] = dataItem[uniqueIdKey];
            dataItem['linkId'] = dataItem[subschema.dataStoreLink.fieldName];

        } else {
            delete formData[uniqueIdKey];

            formData[subschema.dataStoreLink.fieldName] = dataItem.linkId;

        }
        var errorInputs = $(".has-error", $popup);
        var hasErrors = errorInputs.size() > 0;
        if (hasErrors) {
            return false;

        }

        $($popup).disableForm();

        var request = {
            schema: subschema.dataStoreLink.name,
            dataItem: formData,
            dataItemId: dataItem[uniqueIdKey],
            linkId: dataItem.linkId,
            dataStoreLinkFieldName: subschema.dataStoreLink.fieldName
        };

        return widget.query('datastore/save', request).done(function (response) {
            if (response.processedItem.hasOwnProperty('errors')) {
                $($popup).enableForm();
                $.each(response.errors, function (i, error) {
                    $.notify(error.message, {
                        title: 'API Error',
                        autoHide: false,
                        className: 'error'
                    });
                    console.error(error.message);
                });
                return;
            }
            dialog.refreshParentTable(response.dataItems);

            widget.currentPopup.currentPopup.popupDialog('close');
            widget.currentPopup.currentPopup = null;
            $($popup).enableForm();
            $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully", false), 'info');
            callback();

        });

    };


})();
