
var FormItem = function (item) {

    var formItem = this;
    $.extend(true,formItem, item);

};

FormItem.prototype = {


    dataStore:  {
        editable: undefined,
        popupItems: undefined,

    },
    type: undefined, // [tabs,form,fieldSet,text,select,input,coordinates,container,breakLine]
    name: undefined,
    title: undefined,
    css:  undefined,
    editable: undefined,
    isProcessed: undefined,
    dataManagerLink: undefined,
    popupItems: undefined,
    children: undefined,
    accept: undefined,
    origSrc: undefined,
    src: undefined,
    dbSrc: undefined,
    relative: undefined,
    allowRemove: undefined,
    popupItems: undefined,
    itemPattern: undefined,
    itemName: undefined,


    preprocess: function() {

    },

    process: function(feature) {

    },

};

var FormItemResultTable = function() {
    FormItem.apply(this, arguments);
};

FormItemResultTable.prototype = {

    preprocess: function() {
        var formItem = this;
        var dataManager = formItem.dataManager;

        if (formItem.editable) {

            var onCreateClick;
            var onEditClick;

            if (!formItem.dataManagerLink) {

                onCreateClick = function (e) {
                    e.preventDefault();
                    var item = $(this).next().data("item");
                    var popup = item.popupItems;
                    var table = $(this).siblings(".mapbender-element-result-table");
                    var uniqueIdKey = item.dataStore.uniqueId;

                    var feature = table.data('olFeature');
                    var data = {};

                    item.allowRemove = false;
                    data['linkId'] = feature.attributes[item.dataStoreLink.uniqueId];
                    data.item = item;
                    data[uniqueIdKey] = null;
                    dataManagerUtils.openEditDialog(data, popup, item, table);
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

                    dataManagerUtils.openEditDialog(rowData, popup, item, table);

                    return false;
                };
            }
            else {
                var schemaName = formItem.dataManagerLink.schema;
                var fieldName = formItem.dataManagerLink.fieldName;
                var schemaFieldName = formItem.dataManagerLink.schemaFieldName;

                onCreateClick = function (e) {
                    e.preventDefault && e.preventDefault();

                    dataManager.withSchema(schemaName, function (schema) {
                        dataManager._openEditDialog(schema.create());
                    });

                    return false;
                };

                onEditClick = function (rowData, ui, e) {
                    e.defaultPrevented && e.defaultPrevented();
                    e.preventDefault && e.preventDefault();

                    dataManager.withSchema(schemaName, function (schema) {
                        var dataItem = _.find(schema.dataItems, function (d) {
                            return d[schemaFieldName] === rowData[fieldName];
                        });
                        dataManager._openEditDialog(dataItem);
                    });

                    return false;
                };
            }

            var containerItem = new FormItemContainer(formItem);

            var cloneItem = $.extend({}, formItem);
            cloneItem.isProcessed = true;

            var buttons = [];

            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                className: 'edit',
                onClick: onEditClick
            });

            cloneItem.buttons = buttons;

            var button = {
                type: "button",
                title: "",
                cssClass: "fa fa-plus",
                click: onCreateClick
            };

            containerItem.children = [button, cloneItem];

            return containerItem;
        }
    }
};
Object.setPrototypeOf(FormItemResultTable.prototype,FormItem.prototype);


