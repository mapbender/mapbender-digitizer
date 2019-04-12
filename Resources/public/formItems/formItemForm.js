(function () {
    "use strict";

    window.FormItemForm = function () {
        FormItem.apply(this, arguments);
    };

    FormItemForm.prototype = {

        CLASS_NAME: "FormItemForm",

    };

    Object.setPrototypeOf(FormItemForm.prototype, FormItem.prototype);

})();
