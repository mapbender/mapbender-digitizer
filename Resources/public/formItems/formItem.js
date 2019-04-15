(function () {
    "use strict";

    window.FormItem = {

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
                    clonedItem[property] = typeof value == "object"  && property !== 'schema' ? $.extend(true,{},value) : value;
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
        },

    };

})();
