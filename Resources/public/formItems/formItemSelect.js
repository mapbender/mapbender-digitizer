var FormItemSelect = function() {
    FormItem.apply(this, arguments);
};

FormItemSelect.prototype = {

    CLASS_NAME: "FormItemSelect",

};

Object.setPrototypeOf(FormItemSelect.prototype,FormItem.prototype);