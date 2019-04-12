(function () {
    "use strict";

    window.FormItem = function (item) {

        var formItem = this;
        formItem.children = [];
        $.extend(true, formItem, item); // Deep copy
    };

    FormItem.prototype = {

        CLASS_NAME: "FormItem",

        clone: function () {
            var formItem = this;
            console.assert(formItem.constructor !== window.FormItem,"An abstract Form Item cannot be cloned");
            var clonedItem = new formItem.constructor(formItem,formItem.schema);
            var children = [];
            formItem.children.forEach(function (childFormItem) {
                children.push(childFormItem.clone());
            });

            clonedItem.children = children;
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
