(function () {
    "use strict";

    window.FormItemSelect =  {

        preprocess: function() {

            var item = this;
            var schema = item.schema;

            var onCreateClick;
            var onEditClick;

            if (item.dataManagerLink) {
                var schemaName = item.dataManagerLink.schema;
                var schemaFieldName = item.dataManagerLink.schemaFieldName;
                var dataManager =  schema.widget.dataManager;


                onCreateClick = function (e) {
                    e.preventDefault && e.preventDefault();

                    dataManager.withSchema(schemaName, function (schema) {
                        dataManager._openEditDialog(schema.create());

                    });
                    $(dataManager.element).on('data.manager.item.saved', function (event, eventData) {
                        var uniqueIdKey = eventData.uniqueIdKey;
                        var text = item.itemPattern.replace('{id}', eventData.item[uniqueIdKey]).replace('{name}', eventData.item[item.itemName]);
                        var $option = $('<option />').val(eventData.item[uniqueIdKey]).text(text);
                        var $select = $('select[name=' + item.name + ']').append($option);
                        $select.val(eventData.item[uniqueIdKey]);
                    });
                    return false;
                };

                onEditClick = function (e) {
                    e.preventDefault && e.preventDefault();

                    var val = $(this).siblings().find('select').val();
                    dataManager.withSchema(schemaName, function (schema) {
                        var dataItem = _.find(schema.dataItems, function (d) {
                            return d[schemaFieldName].toString() === val;
                        });
                        var dialog = dataManager._openEditDialog(dataItem);

                    });

                    return false;
                };
            } else {


                onCreateClick = function () {
                    var dataItemId = $(this).siblings().find('select').val();
                    var selectRef = $(this).siblings().find('select');

                    var dataStoreId = item.dataStore.id;
                    QueryEngine.query("datastore/get", {
                        schema: schema.schemaName,
                        id: dataStoreId,
                        dataItemId: dataItemId
                    }).done(function (data) {
                        openEditDialog(data, item.dataStore.popupItems, item, selectRef);

                    });

                    return false;
                };

                onEditClick = function () {
                    var selectRef = $(this).siblings().find('select');
                    openEditDialog({}, item.dataStore.popupItems, item, selectRef);

                    return false;
                };
            }

            var preProcessedItem = item.clone();
            var fieldSetItem = {};
            Object.setPrototypeOf(fieldSetItem,FormItemFieldSet);

            fieldSetItem.title = '';

            var button1 =  {
                type: "button",
                title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                cssClass: 'edit',
                click: onEditClick
            };
            Object.setPrototypeOf(button1,FormItemButton);

            var button2 = {
                type: "button",
                title: "",
                cssClass: "fa fa-plus",
                click: onCreateClick
            };
            Object.setPrototypeOf(button2,FormItemButton);


            fieldSetItem.children = [
                preProcessedItem,
                button1, button2
            ];

            return fieldSetItem;
        },

    };

    Object.setPrototypeOf(FormItemSelect, FormItem);


    var openEditDialog = function (dataItem, formItems, schema, ref) {

        var dataManagerUtils = this;
        var schema = this.schema;
        var widget = schema.widget;

        var buttons = [];

        if (widget.currentPopup.currentPopup) {
            widget.currentPopup.currentPopup.popupDialog('close');
            widget.currentPopup.currentPopup = null;
        }

        var saveButton = {
            text: Mapbender.DigitizerTranslator.translate("feature.save", false),
            click: function () {
                dataManagerUtils.saveForeignDataStoreItem(dataItem);
            }
        };
        buttons.push(saveButton);

        buttons.push({

            text: Mapbender.DigitizerTranslator.translate("feature.remove.title", false),
            class: 'critical',
            click: function () {

                var uniqueIdKey = schema.dataStore.uniqueId;
                QueryEngine.query('datastore/remove', {
                    schema: dataItem.item.dataStoreLink.name,
                    dataItemId: dataItem[uniqueIdKey],
                    dataStoreLinkFieldName: schema.dataStoreLink.fieldName,
                    linkId: dataItem[dataItem.item.dataStoreLink.fieldName]

                }).done(function (response) {

                    if (response.processedItem.hasOwnProperty('errors')) {
                        $(dialog).enableForm();
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
                    var data = response.dataItems;
                    var tableApi = $(dialog).data('table').resultTable('getApi');
                    var item = $(dialog).data('table').data('item');
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
                    dataManagerUtils.currentPopup.currentPopup.popupDialog('close');
                    dataManagerUtils.currentPopup.currentPopup = null;
                    $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');

                })
            }
        });

        buttons.push({
            text: Mapbender.DigitizerTranslator.translate("cancel"),
            click: function () {
                dataManagerUtils.currentPopup.currentPopup.popupDialog('close');
                dataManagerUtils.currentPopup.currentPopup = null;
            }
        });

        var dialog = $("<div/>");
        dialog.on("popupdialogopen", function (event, ui) {
            setTimeout(function () {
                dialog.formData(dataItem);

            }, 1);
        });


        DataUtil.eachItem(schema.formItems, function (item) {
            if (item.type === "file") {
                item.uploadHanderUrl = dataManagerUtils.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + dataItem.fid + "&field=" + item.name;
                if (item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                    item.dbSrc = dataItem.data[item.name];
                    if (schema.featureType.files) {
                        $.each(schema.featureType.files, function (k, fileInfo) {
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
                    if (schema.featureType.files) {
                        $.each(schema.featureType.files, function (k, fileInfo) {
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

            title: Mapbender.DigitizerTranslator.translate("feature.attributes"),

            width: "423px",
        }, schema.popup);

        popupConfig.buttons = buttons;

        dialog.generateElements({children: formItems});
        dialog.popupDialog(popupConfig);
        dialog.addClass("data-store-edit-data");
        dataManagerUtils.currentPopup.currentPopup = dialog;
        dialog.parentDialog = dataManagerUtils.currentPopup;
        dialog.data('schema', schema);
        dialog.data('table', ref);

        return dialog;
    };

    var saveForeignDataStoreItem =  function (dataItem) {

        var dataManagerUtils = this;
        var dialog = dataManagerUtils.currentPopup.currentPopup;
        var uniqueIdKey = dataItem.item.dataStore.uniqueId;
        var isNew = dataItem[uniqueIdKey] === null;
        var formData = dialog.formData();
        var schema = dialog.data('schema');
        if (!isNew) {

            formData[uniqueIdKey] = dataItem[uniqueIdKey];
            dataItem['linkId'] = dataItem[schema.dataStoreLink.fieldName];

        } else {
            delete formData[uniqueIdKey];

            formData[schema.dataStoreLink.fieldName] = dataItem.linkId;

        }
        var errorInputs = $(".has-error", dialog);
        var hasErrors = errorInputs.size() > 0;
        if (hasErrors) {
            return false;

        }

        $(dialog).disableForm();

        QueryEngine.query('datastore/save', {
            schema: dataItem.item.dataStoreLink.name,
            dataItem: formData,
            dataItemId: dataItem[uniqueIdKey],
            linkId: dataItem.linkId,
            dataStoreLinkFieldName: schema.dataStoreLink.fieldName
        }).done(function (response) {
            if (response.processedItem.hasOwnProperty('errors')) {
                $(dialog).enableForm();
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
            var data = response.dataItems;
            var tableApi = $(dialog).data('table').resultTable('getApi');
            var item = $(dialog).data('table').data('item');
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

            dataManagerUtils.currentPopup.currentPopup.popupDialog('close');
            dataManagerUtils.currentPopup.currentPopup = null;
            $(dialog).enableForm();
            $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully", false), 'info');
        });

    }

})();
