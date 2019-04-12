(function () {
    "use strict";

    window.FormItemBreakLine = function () {
        FormItem.apply(this, arguments);
    };

    FormItemBreakLine.prototype = {

        CLASS_NAME: "FormItemBreakLine",

    };

    Object.setPrototypeOf(FormItemBreakLine.prototype, FormItem.prototype);

})();
