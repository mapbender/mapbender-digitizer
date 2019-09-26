(function () {
    "use strict";

    /**
     *
     * @param dataItem
     * @param formItems
     * @param {Scheme} subschema
     * @param ref
     * @returns {*|jQuery|HTMLElement}
     */



    Mapbender.Digitizer.ForeignEditDialog = function (dataItem, subschema, ref, schema) {
        var dialog = this;
        var buttons = [];
        dialog.schema = schema;
        var widget = schema.widget;
        var formItems = subschema.popupItems;

        var $popup = dialog.$popup = $("<div/>");

        if (widget.currentPopup.currentPopup) {
            widget.currentPopup.currentPopup.popupDialog('close');
            widget.currentPopup.currentPopup = null;
        }

        var refreshConnectedDataManager = function () {
            $('.mb-element').filter(function (i, el) {
                return !!$(el).data()["mapbenderMbDataManager"]
            }).each(function (i, el) {

                var dataManager = $(el).data()["mapbenderMbDataManager"];

                if (!!dataManager.options.schemes[subschema.connectedDataManager]) {
                    dataManager._getData(dataManager.currentSettings);
                    console.log("Data Manager refreshed");
                }
            });

        };

        var saveButton = {
            text: Mapbender.DigitizerTranslator.translate("feature.save.title", false),
            click: function () {
                dialog.saveForeignDataStoreItem(dataItem).then(refreshConnectedDataManager);
            }
        };
        buttons.push(saveButton);

        buttons.push({

            text: Mapbender.DigitizerTranslator.translate("feature.remove.title", false),
            class: 'critical',
            click: function () {

                Mapbender.confirmDialog({

                    html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
                    onSuccess: function () {

                        var uniqueIdKey = subschema.dataStore.uniqueId;
                        widget.query('datastore/remove', {
                            schema: subschema.dataStoreLink.name,
                            dataItemId: dataItem[uniqueIdKey],
                            dataStoreLinkFieldName: subschema.dataStoreLink.fieldName,
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

                            widget.currentPopup.currentPopup.popupDialog('close');
                            widget.currentPopup.currentPopup = null;
                            $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');

                            refreshConnectedDataManager();
                        })

                    }
                });
            }
        });

        buttons.push({
            text: Mapbender.DigitizerTranslator.translate("cancel"),
            click: function () {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
            }
        });


        $popup.on("popupdialogopen", function (event, ui) {
            setTimeout(function () {
                $popup.formData(dataItem);

            }, 1);
        });


        DataUtil.eachItem(formItems, function (item) {
            if (item.type === "file") {
                item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + subschema.schemaName + "&fid=" + dataItem.fid + "&field=" + item.name;
                if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                    item.dbSrc = dataItem.data[item.name];
                    if (subschema.featureType.files) {
                        $.each(subschema.featureType.files, function (k, fileInfo) {
                            if (fileInfo.field && fileInfo.field == item.name) {
                                if (fileInfo.formats) {
                                    item.accept = fileInfo.formats;
                                }
                            }
                        });
                    }
                }

            }

            if (item.type === 'image') {

                if (!item.origSrc) {
                    item.origSrc = item.src;
                }

                if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                    item.dbSrc = dataItem.data[item.name];
                    if (subschema.featureType.files) {
                        $.each(subschema.featureType.files, function (k, fileInfo) {
                            if (fileInfo.field && fileInfo.field === item.name) {

                                if (fileInfo.uri) {
                                    item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                } else {
                                }
                            }
                        });
                    }
                }

                var src = item.dbSrc ? item.dbSrc : item.origSrc;
                if (item.relative) {
                    item.src = src.match(/^(http[s]?\:|\/{2})/) ? src : Mapbender.configuration.application.urls.asset + src;
                } else {
                    item.src = src;
                }
            }

        });
        /*  if(schema.popup.buttons) {
         buttons = _.union(schema.popup.buttons, buttons);
         } */
        var popupConfig = _.extend({

            title: dataItem.item.title, //Mapbender.DigitizerTranslator.translate("feature.attributes"),

            width: "423px",
        }, subschema.popup);

        popupConfig.buttons = buttons;

        $popup.generateElements({children: formItems});
        $popup.popupDialog(popupConfig);
        $popup.addClass("data-store-edit-data");
        widget.currentPopup.currentPopup = $popup;
        $popup.parentDialog = widget.currentPopup;
        $popup.data('schema', subschema);
        $popup.data('table', ref);

        return $popup;

    };


    Mapbender.Digitizer.ForeignEditDialog.prototype.refreshParentTable = function(data) {
        var dialog = this;
        var $popup = dialog.$popup;

        var tableApi = $popup.data('table').resultTable('getApi');
        var item = $popup.data('table').data('item');
        if (Object.prototype.toString.call(data) === '[object Array]') {
            var a = [];
            _.each(data, function (e, i) {
                if (e.hasOwnProperty('attributes')) {
                    e.attributes.item = item;
                    a.push(e.attributes);
                }
            });

            data = a;

        } else {
            if (data.hasOwnProperty('attributes')) {
                data = [data.attributes];

            }

        }
        tableApi.clear();
        tableApi.rows.add(data);
        tableApi.draw();
    };

    /**
     *
     * @param dataItem
     * @returns {boolean}
     */

    Mapbender.Digitizer.ForeignEditDialog.prototype.saveForeignDataStoreItem = function (dataItem) {

        var dialog = this;
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
        });

    };


})();
