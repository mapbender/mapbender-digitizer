(function () {
    "use strict";

    window.FormItem = function (item) {

        var formItem = this;
        formItem.children = [];
        $.extend(true, formItem, item);


    };

    FormItem.prototype = {

        CLASS_NAME: "FormItem",

        clone: function () {
            var formItem = this;
            var clonedItem = new formItem.constructor(formItem);
            var children = [];
            console.assert(!!formItem.children, formItem);
            formItem.children.forEach(function (childFormItem) {
                children.push(childFormItem.clone());
            });

            clonedItem.children = children;
            return clonedItem;

        },


        preprocess: function () {
            return this.clone();
        },

        process: function (feature) {
            return this.clone();
        },

    };

})();
