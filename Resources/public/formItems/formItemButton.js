(function () {
    "use strict";

    window.FormItemButton = function () {
        FormItem.apply(this, arguments);
    };

    FormItemButton.prototype = {

        CLASS_NAME: "FormItemButton",

    };

    Object.setPrototypeOf(FormItemButton.prototype, FormItem.prototype);

})();
