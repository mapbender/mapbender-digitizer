(function () {
    "use strict";

    window.FormItemTextArea = function () {
        FormItem.apply(this, arguments);
    };

    FormItemTextArea.prototype = {

        CLASS_NAME: "FormItemTextArea",

    };

    Object.setPrototypeOf(FormItemTextArea.prototype, FormItem.prototype);

})();
