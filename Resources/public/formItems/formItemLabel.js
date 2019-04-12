(function () {
    "use strict";

    window.FormItemLabel = function () {
        FormItem.apply(this, arguments);
    };

    FormItemLabel.prototype = {

        CLASS_NAME: "FormItemLabel",

    };

    Object.setPrototypeOf(FormItemLabel.prototype, FormItem.prototype);

})();
