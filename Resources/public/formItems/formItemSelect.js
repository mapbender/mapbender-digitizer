(function () {
    "use strict";

    Mapbender.Digitizer.FormItemSelect = {

        type: "select",
        CLASS_NAME: "FormItemSelect",

        getValue: function(event) {
            return $(event.currentTarget).find('select').val();
        },

        preprocess: function () {

            var item = this;
            var schema = item.schema;
            var widget = schema.widget;

            var onCreateClick;
            var onEditClick;

            if ((!item.dataStore || !item.dataStore.editable || !item.dataStore.popupItems) && !item.dataManagerLink) {
                return item.clone();
            }

            if (item.dataManagerLink) {
                var schemaName = item.dataManagerLink.schema;
                var schemaFieldName = item.dataManagerLink.schemaFieldName;
                var dataManager = schema.widget.dataManager;


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
                    widget.query("datastore/get", {
                        schema: schema.schemaName,
                        id: dataStoreId,
                        dataItemId: dataItemId
                    }).done(function (data) {
                        Mapbender.Digitizer.FormItemUtils.openEditDialog(data, item, selectRef);

                    });

                    return false;
                };

                onEditClick = function () {
                    var selectRef = $(this).siblings().find('select');
                    Mapbender.Digitizer.FormItemUtils.openEditDialog({}, item, selectRef);

                    return false;
                };
            }

            var preProcessedItem = item.clone();
            var fieldSetItem = {};
            Object.setPrototypeOf(fieldSetItem, Mapbender.Digitizer.FormItemFieldSet);

            fieldSetItem.title = '';

            var button1 = {
                type: "button",
                title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                cssClass: 'edit',
                click: onEditClick
            };
            Object.setPrototypeOf(button1, Mapbender.Digitizer.FormItemButton);

            var button2 = {
                type: "button",
                title: "",
                cssClass: "fa fa-plus",
                click: onCreateClick
            };
            Object.setPrototypeOf(button2, Mapbender.Digitizer.FormItemButton);


            fieldSetItem.children = [
                preProcessedItem,
                button1, button2
            ];

            return fieldSetItem;
        },

    };

    Object.setPrototypeOf(Mapbender.Digitizer.FormItemSelect, Mapbender.Digitizer.FormItem);


})();
