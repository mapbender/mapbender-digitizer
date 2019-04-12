var FormItemText = function() {
    FormItem.apply(this, arguments);
};

FormItemText.prototype = {

    CLASS_NAME: "FormItemText",

};

Object.setPrototypeOf(FormItemText.prototype,FormItem.prototype);