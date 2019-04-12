var FormItemFile = function() {
    FormItem.apply(this, arguments);
};

FormItemFile.prototype = {

    CLASS_NAME: "FormItemFile",

};

Object.setPrototypeOf(FormItemFile.prototype,FormItem.prototype);