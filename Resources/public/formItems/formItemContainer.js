(function () {
    "use strict";

    window.FormItemContainer = function () {
        FormItem.apply(this, arguments);
    };

    FormItemContainer.prototype = {

        CLASS_NAME: "FormItemContainer",

    };

    Object.setPrototypeOf(FormItemContainer.prototype, FormItem.prototype);

})();
