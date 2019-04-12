(function () {
    "use strict";

    window.FormItemDate = function () {
        FormItem.apply(this, arguments);
    };

    FormItemDate.prototype = {

        CLASS_NAME: "FormItemDate",

    };

    Object.setPrototypeOf(FormItemDate.prototype, FormItem.prototype);

})();
