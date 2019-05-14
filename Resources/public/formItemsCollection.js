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

        formItemsCollection.extend();

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
            if (!modifiedItem.isProcessed) { // in some cases, processed formItems get Children that are not part of the original formItems children
                modifiedItem.children = modifyRecursively(item.children || [], modificator);
            }

            modifiedItems.push(modifiedItem);

        });

        return modifiedItems;
    };



    Mapbender.Digitizer.FormItemsCollection.prototype = {

        //Override
        extend: function() {

        },

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




        process: function (feature, dialog, schema) {
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
                var processedItem = item.process(feature, dialog,schema);
                delete processedItem.schema;
                return processedItem;
            });

        },





    };


})();
