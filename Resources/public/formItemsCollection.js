var FormItemsCollection = function(rawFormItems, schema) {

    var formItemsCollection = this;

    formItemsCollection.schema = schema;

    formItemsCollection.rawItems = rawFormItems;
    formItemsCollection.items =  [];

    $.extend(formItemsCollection.items, formItemsCollection.rawItems);
    $.extend(formItemsCollection.items,Mapbender.DigitizerTranslator.translateStructure(formItemsCollection.items));

    formItems.typify();

    formItemsCollection.dataManager = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];

    formItemsCollection.preprocess();

    //TODO prevent items from being modified afterwards

    console.log(formItemsCollection);
};

FormItemsCollection.prototype =  {

    /**
     * "Fake" form data for a feature that hasn't gone through attribute
     * editing, for saving. This is used when we save a feature that has only
     * been moved / dragged. The popup dialog with the form is not initialized
     * in these cases.
     * Assigned values are copied from the feature's data, if it was already
     * stored in the db, empty otherwise.
     *
     * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
     * @returns {{}}
     */
    createHeadlessFormData: function (feature) {
        var formItemsCollection = this;
        var formData = {};

        var extractFormData = function (definition) {
            definition.forEach(function (item) {
                if (_.isArray(item)) {
                    // recurse into lists
                    extractFormData(item);
                } else if (item.name) {
                    var currentValue = (feature.data || {})[item.name];
                    // keep empty string, but replace undefined => null
                    if (typeof (currentValue) === 'undefined') {
                        currentValue = null;
                    }
                    formData[item.name] = currentValue;
                } else if (item.children) {
                    // recurse into child property (should be a list)
                    extractFormData(item.children);
                }
            });
        };

        extractFormData(formItemsCollection.items);
        return formData;
    },


    process: function(feature) {
        var formItemsCollection = this;
        var processedFormItems = [];
        formItemsCollection.items.forEach(function(item) {

            //TODO use typed formItem
            processedFormItems.push(item.processFeature ? item.processFeature(feature) : _.clone(item));

        });

        return processedFormItems;
    },

    createTypedFormItem: function(item) {

        switch(item.type) {
            case 'resultTable' :
                return new FormItemResultTable(item);
            case 'select' :
                return new FormItemSelect(item);
            case 'image' :
                return new FormItemImage(item);
            case 'file' :
                return new FormItemFile(item);
        }

        return FormItem();
    },


    typify: function() {
        var formItemsCollection = this;
        var typedItems = [];

        formItemsCollection.items.forEach(function (item) {

            var typedItem = formItemsCollection.createTypedFormItem(item);
            typedItem.dataManager = formItemsCollection.dataManager;
            typedItem.schema = formItemsCollection.schema;
            typedItems.push(typedItem);

        });

        formItemsCollection.items = typedItems;
    },

    preprocess: function() {
        var formItemsCollection = this;
        var preprocessedItems  = [];

        formItemsCollection.items.forEach(function (item) {

            preprocessedItems.push(item.preprocess());

        });

        formItemsCollection.items = preprocessedItems;

    },

    preprocessResultTable: function(item) {
        var formItemsCollection = this;
        var schema = formItemsCollection.schema;
        var dataManager = formItemsCollection.dataManager;

        var onCreateClick;
        var onEditClick;

        item.processFeature = function (feature) {
            var processedItem = $.extend(true,{},item);
            return processedItem;
        };

        if (!item.dataManagerLink) {

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
            var schemaName = item.dataManagerLink.schema;
            var fieldName = item.dataManagerLink.fieldName;
            var schemaFieldName = item.dataManagerLink.schemaFieldName;

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

        var cloneItem = $.extend({}, item);
        cloneItem.isProcessed = true;
        item.type = "container";


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
        item.children = [button, cloneItem];


        return item;

    },


    preprocessSelectWithData: function(item) {
        var formItemsCollection = this;
        var schema = formItemsCollection.schema;
        var dataManager = formItemsCollection.dataManager;

        var onCreateClick;
        var onEditClick;

        item.processFeature = function (feature) {
            var processedItem = $.extend(true,{},item);
            return processedItem;
        };

        if (item.dataManagerLink) {
            var schemaName = item.dataManagerLink.schema;
            var schemaFieldName = item.dataManagerLink.schemaFieldName;


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
                    dataManagerUtils.openEditDialog(data, item.dataStore.popupItems, item, selectRef);

                });

                return false;
            };

            onEditClick = function () {
                var selectRef = $(this).siblings().find('select');
                dataManagerUtils.openEditDialog({}, item.dataStore.popupItems, item, selectRef);

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
    },


    preprocessFile: function(item) {
        var formItemsCollection = this;
        var schema = formItemsCollection.schema;
        var widget = schema.widget;

        item.processFeature = function (feature) {
            var processedItem = $.extend(true,{},item);

            processedItem.uploadHanderUrl = widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + feature.fid + "&field=" + item.name;
            if (item.name && feature.data[item.name]) {
                processedItem.dbSrc = feature.data[item.name];
                if (schema.featureType.files) {
                    schema.featureType.files.forEach(function(fileInfo) {
                        if (fileInfo.field === item.name) {
                            if (fileInfo.formats) {
                                processedItem.accept = fileInfo.formats;
                            }
                        }
                    });
                }
            }
            return processedItem;
        }

    },

    preprocessImage: function(item) {
        var formItemsCollection = this;
        var schema = formItemsCollection.schema;
        var widget = schema.widget;

        item.processFeature = function (feature) {
            var processedItem = $.extend(true,{},item);
            if (item.name && feature.data[item.name]) {
                processedItem.dbSrc = feature.data[item.name];
                if (schema.featureType.files) {
                    schema.featureType.files.forEach( function (fileInfo) {
                        if (fileInfo.field === item.name) {
                            if (fileInfo.uri) {
                                processedItem.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                            } else {
                                processedItem.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + processedItem.name + "/" + processedItem.dbSrc;
                            }
                        }
                    });
                }
            }

            var src = processedItem.dbSrc || processedItem.origSrc;
            if (!processedItem.relative) {
                processedItem.src = src;
            } else {
                processedItem.src = Mapbender.configuration.application.urls.asset + src;
            }

            return processedItem;
        };



    },
};