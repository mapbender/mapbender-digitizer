(function () {
    "use strict";

    window.FormItemSelect =  {

    preprocess: function() {

            var item = this;
            var schema = item.schema;

            var onCreateClick;
            var onEditClick;

            if ((!item.dataStore.editable || !item.dataStore.popupItems) && !item.dataManagerLink) {
                return item.clone();
            }

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
                        FormItemUtils.openEditDialog(data,  item, selectRef);

                    });

                    return false;
                };

                onEditClick = function () {
                    var selectRef = $(this).siblings().find('select');
                    FormItemUtils.openEditDialog({}, item, selectRef);

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


})();
