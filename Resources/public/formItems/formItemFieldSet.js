(function () {
    "use strict";

    window.FormItemFieldSet = function () {
        FormItem.apply(this, arguments);
    };

    FormItemFieldSet.prototype = {

        CLASS_NAME: "FormItemFieldSet",

    };

    Object.setPrototypeOf(FormItemFieldSet.prototype, FormItem.prototype);

})();
