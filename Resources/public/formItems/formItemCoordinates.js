(function () {
    "use strict";

    window.FormItemCoordinates = function () {
        FormItem.apply(this, arguments);
    };

    FormItemCoordinates.prototype = {

        CLASS_NAME: "FormItemCoordinates",

    };

    Object.setPrototypeOf(FormItemCoordinates.prototype, FormItem.prototype);

})();
