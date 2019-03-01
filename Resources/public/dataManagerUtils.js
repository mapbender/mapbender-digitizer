var DataManagerUtils = function (schema) {

    this.schema = schema;
    this.widget = schema.widget;

};

DataManagerUtils.prototype = {
    /**
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} olFeature
     * @private
     */
    processCurrentFormItemsWithDataManager: function (olFeature) {
        var widget = this.widget;
        var schema = this.schema;

        // dataManager access function
        // TODO: maybe it would be better to create public methods on dataManager to do this
        function withSchema(dataManager, schemaName, callback) {
            var schema = dataManager.options.schemes[schemaName];
            // FIXME: following lines are a hack to get dataManager to open the correct popup
            // (it does open the popup for the scheme provided in currentSettings, not
            // the one passed to the _openEditPopup function)
            var prevSettings = dataManager.currentSettings;
            var prevActiveSchema = dataManager.activeSchema;
            dataManager.activeSchema = dataManager.currentSettings = schema;

            dataManager._getData(schema).then(function () {
                callback(schema);
                dataManager.currentSettings = prevSettings;
                dataManager.activeSchema = prevActiveSchema;
            });
        }

        DataUtil.eachItem(schema.formItems, function (item) {

            if (item.type === "resultTable" && item.editable && !item.isProcessed) {
                var onCreateClick;
                var onEditClick;

                if (!item.hasOwnProperty('dataManagerLink')) {
                    onCreateClick = function (e) {
                        e.preventDefault();
                        var item = $(this).next().data("item");
                        var popup = item.popupItems;
                        var table = $(this).siblings(".mapbender-element-result-table")
                        var uniqueIdKey = item.dataStore.uniqueId;

                        var feature = table.data('olFeature');
                        var data = {};

                        item.allowRemove = false;
                        data['linkId'] = feature.attributes[item.dataStoreLink.uniqueId];
                        data.item = item;
                        data[uniqueIdKey] = null;
                        widget._openEditDialog(data, popup, item, table);
                        return false;
                    };

                    onEditClick = function (rowData, ui, e) {
                        e.defaultPrevented && e.defaultPrevented();
                        e.preventDefault && e.preventDefault();

                        var table = ui.parents('.mapbender-element-result-table');
                        var item = table.data('item');
                        var popup = item.popupItems;
                        var feature = table.data('olFeature');

                        item.allowRemove = true;
                        rowData.externalId = feature.attributes[item.dataStoreLink.uniqueId];

                        widget._openEditDialog(rowData, popup, item, table);

                        return false;
                    };
                } else if (item.hasOwnProperty('dataManagerLink')) {
                    var schemaName = item.dataManagerLink.schema;
                    var fieldName = item.dataManagerLink.fieldName;
                    var schemaFieldName = item.dataManagerLink.schemaFieldName;

                    onCreateClick = function (e) {
                        e.preventDefault && e.preventDefault();

                        var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                        withSchema(dm, schemaName, function (schema) {
                            dm._openEditDialog(schema.create());
                        });

                        return false;
                    };

                    onEditClick = function (rowData, ui, e) {
                        e.defaultPrevented && e.defaultPrevented();
                        e.preventDefault && e.preventDefault();

                        var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];

                        withSchema(dm, schemaName, function (schema) {
                            var dataItem = _.find(schema.dataItems, function (d) {
                                return d[schemaFieldName] === rowData[fieldName];
                            });
                            dm._openEditDialog(dataItem);
                        });

                        return false;
                    };
                }

                var cloneItem = $.extend({}, item);
                cloneItem.isProcessed = true;
                item.type = "container";
                var button = {
                    type: "button",
                    title: "",
                    cssClass: "fa fa-plus",
                    click: onCreateClick
                };

                item.children = [button, cloneItem];

                var buttons = [];

                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                    className: 'edit',
                    onClick: onEditClick
                });

                cloneItem.buttons = buttons;

            }

            if (item.type === "select" && !item.isProcessed && ((item.dataStore && item.dataStore.editable && item.dataStore.popupItems) || item.dataManagerLink)) {
                var onCreateClick;
                var onEditClick;

                if (item.dataManagerLink) {
                    var schemaName = item.dataManagerLink.schema;
                    var schemaFieldName = item.dataManagerLink.schemaFieldName;

                    onCreateClick = function (e) {
                        e.preventDefault && e.preventDefault();

                        var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                        withSchema(dm, schemaName, function (schema) {
                            dm._openEditDialog(schema.create());

                        });
                        $(dm.element).on('data.manager.item.saved', function (event, eventData) {
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
                        var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                        withSchema(dm, schemaName, function (schema) {
                            var dataItem = _.find(schema.dataItems, function (d) {
                                return d[schemaFieldName].toString() === val;
                            });
                            var dialog = dm._openEditDialog(dataItem);

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
                            widget._openEditDialog(data, item.dataStore.popupItems, item, selectRef);

                        });

                        return false;
                    };

                    onEditClick = function () {
                        var selectRef = $(this).siblings().find('select');
                        widget._openEditDialog({}, item.dataStore.popupItems, item, selectRef);

                        return false;
                    };
                }

                var cloneItem = $.extend({}, item);
                cloneItem.isProcessed = true;
                item.type = "fieldSet";
                item.title = undefined;
                item.children = [
                    cloneItem,
                    {
                        type: "button",
                        title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                        cssClass: 'edit',
                        click: onEditClick
                    },
                    {
                        type: "button",
                        title: "",
                        cssClass: "fa fa-plus",
                        click: onCreateClick
                    }
                ];
            }

            if (item.type === "file") {
                item.uploadHanderUrl = widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + olFeature.fid + "&field=" + item.name;
                if (item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                    item.dbSrc = olFeature.data[item.name];
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

                if (item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                    item.dbSrc = olFeature.data[item.name];
                    if (schema.featureType.files) {
                        $.each(schema.featureType.files, function (k, fileInfo) {
                            if (fileInfo.field && fileInfo.field == item.name) {

                                if (fileInfo.uri) {
                                    item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                } else {
                                    item.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + item.name + "/" + item.dbSrc;
                                }
                            }
                        });
                    }
                }

                var src = item.dbSrc || item.origSrc;
                if (!item.hasOwnProperty('relative') && !item.relative) {
                    item.src = src;
                } else {
                    item.src = Mapbender.configuration.application.urls.asset + src;
                }
            }
        });
    },


    /**
     *
     * @param dataItem
     * @param formItems
     * @param {Scheme} schema
     * @param ref
     * @returns {*|jQuery|HTMLElement}
     * @private
     */
    _openEditDialog: function (dataItem, formItems, schema, ref) {
        var widget = this.widget;
        var schema = this.schema;

        var schemaName = schema.schemaName;
        var uniqueKey = schema.dataStore.uniqueId;
        var textKey = schema.dataStore.text;
        var buttons = [];

        if (widget.currentPopup.currentPopup) {
            widget.currentPopup.currentPopup.popupDialog('close');
            widget.currentPopup.currentPopup = null;
        }

        var saveButton = {
            text: Mapbender.DigitizerTranslator.translate("feature.save", false),
            click: function () {
                widget.saveForeignDataStoreItem(dataItem);
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
                    widget.currentPopup.currentPopup.popupDialog('close');
                    widget.currentPopup.currentPopup = null;
                    $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');

                })
            }
        });

        buttons.push({
            text: Mapbender.DigitizerTranslator.translate("cancel"),
            click: function () {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
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
                item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + dataItem.fid + "&field=" + item.name;
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

            width: widget.featureEditDialogWidth,
        }, schema.popup);

        popupConfig.buttons = buttons;

        dialog.generateElements({children: formItems});
        dialog.popupDialog(popupConfig);
        dialog.addClass("data-store-edit-data");
        widget.currentPopup.currentPopup = dialog;
        dialog.parentDialog = widget.currentPopup;
        dialog.data('schema', schema);
        dialog.data('table', ref);

        return dialog;
    },

    /**
     *
     * @param dataItem
     * @returns {boolean}
     */

    saveForeignDataStoreItem: function (dataItem) {

        var widget = this.widget;
        var dialog = widget.currentPopup.currentPopup;
        var uniqueIdKey = dataItem.item.dataStore.uniqueId;
        var isNew = dataItem[uniqueIdKey] === null;
        var formData = dialog.formData();
        var schema = dialog.data('schema');
        debugger;
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

            widget.currentPopup.currentPopup.popupDialog('close');
            widget.currentPopup.currentPopup = null;
            $(dialog).enableForm();
            $.notify(Mapbender.DigitizerTranslator.translate("feature.save.successfully", false), 'info');
        });

    }

};
