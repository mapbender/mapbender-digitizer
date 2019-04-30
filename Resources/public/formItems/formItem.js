(function () {
    "use strict";

    Mapbender.Digitizer.FormItem = {

        CLASS_NAME: "FormItem",

        clone: function () {
            var formItem = this;
            var clonedItem = {};
            for (var property in formItem) {
                if (formItem.hasOwnProperty(property)) {  // copy only
                    if (property === "children") {
                        continue;
                    }
                    var value = formItem[property];
                    clonedItem[property] = typeof value == "object"  && property !== 'schema' && property !== "columns" ? $.extend(true,{},value) : value;
                }
            }
            var children = [];
            formItem.children.forEach(function (childFormItem) {
                children.push(childFormItem.clone());
            });

            clonedItem.children = children;

            Object.setPrototypeOf(clonedItem, Object.getPrototypeOf(formItem));

            return clonedItem;

        },


        preprocess: function (schema) {
            return this.clone();
        },

        process: function (feature,dialog,schema) {
            return this.clone();
        }

    };


    Mapbender.Digitizer.FormItemUtils = {

        openEditDialog: function (data,item, ref) {

            var popup =  item.popupItems;
            var schema = item.schema;
            var widget = schema.widget;

            var buttons = [];

            if (widget.currentPopup.currentPopup) {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
            }

            var saveButton = {
                text: Mapbender.DigitizerTranslator.translate("feature.save.title", false),
                click: function () {
                    Mapbender.Digitizer.FormItemUtils.saveForeignDataStoreItem(data);
                }
            };
            buttons.push(saveButton);

            buttons.push({

                text: Mapbender.DigitizerTranslator.translate("feature.remove.title", false),
                class: 'critical',
                click: function () {

                    var uniqueIdKey = schema.dataStore.uniqueId;
                    widget.query('datastore/remove', {
                        schema: data.item.dataStoreLink.name,
                        dataItemId: data[uniqueIdKey],
                        dataStoreLinkFieldName: schema.dataStoreLink.fieldName,
                        linkId: data[data.item.dataStoreLink.fieldName]

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
                        schema.widget.currentPopup.currentPopup.popupDialog('close');
                        schema.widget.currentPopup.currentPopup = null;
                        $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');

                    })
                }
            });

            buttons.push({
                text: Mapbender.DigitizerTranslator.translate("cancel"),
                click: function () {
                    schema.widget.currentPopup.currentPopup.popupDialog('close');
                    schema.widget.currentPopup.currentPopup = null;
                }
            });

            var dialog = $("<div/>");
            dialog.on("popupdialogopen", function (event, ui) {
                setTimeout(function () {
                    dialog.formData(data);

                }, 1);
            });


            DataUtil.eachItem(schema.formItems, function (item) {
                if (item.type === "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + data.fid + "&field=" + item.name;
                    if (item.hasOwnProperty("name") && data.data.hasOwnProperty(item.name) && data.data[item.name]) {
                        item.dbSrc = data.data[item.name];
                        if (schema.featureType.files) {
                            $.each(schema.featureType.files, function (k, fileInfo) {
                                if (fileInfo.field && fileInfo.field === item.name) {
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

                    if (item.hasOwnProperty("name") && data.data.hasOwnProperty(item.name) && data.data[item.name]) {
                        item.dbSrc = data.data[item.name];
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

            var popupConfig = _.extend({

                title: Mapbender.DigitizerTranslator.translate("feature.attributes"),

                width: "423px",
            }, schema.popup);

            popupConfig.buttons = buttons;

            dialog.generateElements({children: popup});
            dialog.popupDialog(popupConfig);
            dialog.addClass("data-store-edit-data");
            schema.widget.currentPopup.currentPopup = dialog;
            dialog.parentDialog = schema.widget.currentPopup;
            dialog.data('schema', schema);
            dialog.data('table', ref);

            return dialog;
        },

    saveForeignDataStoreItem: function(dataItem) {

        var schema = dataItem.item.schema;
        var widget = schema.widget;
        var dialog = schema.widget.currentPopup.currentPopup;
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

        widget.query('datastore/save', {
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
            if (Array.isArray(data)) {
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

            schema.widget.currentPopup.currentPopup.popupDialog('close');
            schema.widget.currentPopup.currentPopup = null;
            $(dialog).enableForm();
            $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully", false), 'info');
        });

    }

}

})();
