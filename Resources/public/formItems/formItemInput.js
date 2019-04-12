var FormItemInput = function() {
    FormItem.apply(this, arguments);
};

FormItemInput.prototype = {

    CLASS_NAME: "FormItemInput",

};

Object.setPrototypeOf(FormItemInput.prototype,FormItem.prototype);