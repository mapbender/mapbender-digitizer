(function () {
    "use strict";

    Mapbender.Digitizer.FormItemsCollection = function (items, schema) {

        var formItemsCollection = this;

        formItemsCollection.schema = schema;

        formItemsCollection.items = modifyRecursively(items || [], function(item){
            setPrototypeOfFormItem(item);
            item.schema = schema;
            return item;
        });


        formItemsCollection.items = modifyRecursively(formItemsCollection.items, function (item) {
            var preprocessedItem = item.preprocess();
            return preprocessedItem;
        });

        Object.freeze(formItemsCollection.items);


    };

    var setPrototypeOfFormItem = function (item) {

        var typeName = item.type.charAt(0).toUpperCase() + item.type.slice(1);
        var prototypeName = 'FormItem' + typeName;
        var prototype = Mapbender.Digitizer[prototypeName];

        if (!prototype) {
            throw new Error("No prototype '" + prototypeName + "' defined");
        }
        Object.setPrototypeOf(item,prototype);
    };

    var modifyRecursively = function (items, modificator) {

        var modifiedItems = [];
        items.forEach(function (item) {

            var modifiedItem = modificator(item);
            modifiedItem.children = modifyRecursively(item.children || [], modificator);

            modifiedItems.push(modifiedItem);

        });

        return modifiedItems;
    };



    Mapbender.Digitizer.FormItemsCollection.prototype = {

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




        process: function (feature, dialog) {
            var formItemsCollection = this;

            var getDefaultFormItems = function () {

                var defaultFormItems = [];
                _.each(feature.data, function (value, key) {
                    defaultFormItems.push({
                        type: 'input',
                        name: key,
                        title: key
                    });
                });

                return defaultFormItems;
            };

            return modifyRecursively(formItemsCollection.items || getDefaultFormItems(), function (item) {
                var processedItem = item.process(feature, dialog);
                return processedItem;
            });

        },






        // preprocessSelectWithData: function(item) {
        //     var formItemsCollection = this;
        //     var schema = formItemsCollection.schema;
        //     var dataManager = formItemsCollection.dataManager;
        //
        //     var onCreateClick;
        //     var onEditClick;
        //
        //     item.processFeature = function (feature) {
        //         var processedItem = $.extend(true,{},item);
        //         return processedItem;
        //     };
        //
        //     if (item.dataManagerLink) {
        //         var schemaName = item.dataManagerLink.schema;
        //         var schemaFieldName = item.dataManagerLink.schemaFieldName;
        //
        //
        //         onCreateClick = function (e) {
        //             e.preventDefault && e.preventDefault();
        //
        //             dataManager.withSchema(schemaName, function (schema) {
        //                 dataManager._openEditDialog(schema.create());
        //
        //             });
        //             $(dataManager.element).on('data.manager.item.saved', function (event, eventData) {
        //                 var uniqueIdKey = eventData.uniqueIdKey;
        //                 var text = item.itemPattern.replace('{id}', eventData.item[uniqueIdKey]).replace('{name}', eventData.item[item.itemName]);
        //                 var $option = $('<option />').val(eventData.item[uniqueIdKey]).text(text);
        //                 var $select = $('select[name=' + item.name + ']').append($option);
        //                 $select.val(eventData.item[uniqueIdKey]);
        //             });
        //             return false;
        //         };
        //
        //         onEditClick = function (e) {
        //             e.preventDefault && e.preventDefault();
        //
        //             var val = $(this).siblings().find('select').val();
        //             dataManager.withSchema(schemaName, function (schema) {
        //                 var dataItem = _.find(schema.dataItems, function (d) {
        //                     return d[schemaFieldName].toString() === val;
        //                 });
        //                 var dialog = dataManager._openEditDialog(dataItem);
        //
        //             });
        //
        //             return false;
        //         };
        //     } else {
        //
        //
        //         onCreateClick = function () {
        //             var dataItemId = $(this).siblings().find('select').val();
        //             var selectRef = $(this).siblings().find('select');
        //
        //             var dataStoreId = item.dataStore.id;
        //             widget.query("datastore/get", {
        //                 schema: schema.schemaName,
        //                 id: dataStoreId,
        //                 dataItemId: dataItemId
        //             }).done(function (data) {
        //                 dataManagerUtils.openEditDialog(data, item.dataStore.popupItems, item, selectRef);
        //
        //             });
        //
        //             return false;
        //         };
        //
        //         onEditClick = function () {
        //             var selectRef = $(this).siblings().find('select');
        //             dataManagerUtils.openEditDialog({}, item.dataStore.popupItems, item, selectRef);
        //
        //             return false;
        //         };
        //     }
        //
        //     var cloneItem = $.extend({}, item);
        //     cloneItem.isProcessed = true;
        //     item.type = "fieldSet";
        //     item.title = undefined;
        //     item.children = [
        //         cloneItem,
        //         {
        //             type: "button",
        //             title: Mapbender.DigitizerTranslator.translate('feature.edit'),
        //             cssClass: 'edit',
        //             click: onEditClick
        //         },
        //         {
        //             type: "button",
        //             title: "",
        //             cssClass: "fa fa-plus",
        //             click: onCreateClick
        //         }
        //     ];
        // },
        //
        //
        // preprocessFile: function(item) {
        //     var formItemsCollection = this;
        //     var schema = formItemsCollection.schema;
        //     var widget = schema.widget;
        //
        //     item.processFeature = function (feature) {
        //         var processedItem = $.extend(true,{},item);
        //
        //         processedItem.uploadHanderUrl = widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + feature.fid + "&field=" + item.name;
        //         if (item.name && feature.data[item.name]) {
        //             processedItem.dbSrc = feature.data[item.name];
        //             if (schema.featureType.files) {
        //                 schema.featureType.files.forEach(function(fileInfo) {
        //                     if (fileInfo.field === item.name) {
        //                         if (fileInfo.formats) {
        //                             processedItem.accept = fileInfo.formats;
        //                         }
        //                     }
        //                 });
        //             }
        //         }
        //         return processedItem;
        //     }
        //
        // },
        //
        // preprocessImage: function(item) {
        //     var formItemsCollection = this;
        //     var schema = formItemsCollection.schema;
        //     var widget = schema.widget;
        //
        //     item.processFeature = function (feature) {
        //         var processedItem = $.extend(true,{},item);
        //         if (item.name && feature.data[item.name]) {
        //             processedItem.dbSrc = feature.data[item.name];
        //             if (schema.featureType.files) {
        //                 schema.featureType.files.forEach( function (fileInfo) {
        //                     if (fileInfo.field === item.name) {
        //                         if (fileInfo.uri) {
        //                             processedItem.dbSrc = fileInfo.uri + "/" + item.dbSrc;
        //                         } else {
        //                             processedItem.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + processedItem.name + "/" + processedItem.dbSrc;
        //                         }
        //                     }
        //                 });
        //             }
        //         }
        //
        //         var src = processedItem.dbSrc || processedItem.origSrc;
        //         if (!processedItem.relative) {
        //             processedItem.src = src;
        //         } else {
        //             processedItem.src = Mapbender.configuration.application.urls.asset + src;
        //         }
        //
        //         return processedItem;
        //     };


        //
        // },
    };


})();