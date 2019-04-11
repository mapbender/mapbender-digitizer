var FormItem = function (item) {

    var formItem = this;
    formItem.children = [];
    $.extend(true,formItem, item);

};

FormItem.prototype = {

    schema: null,
    dataManager: null,


    dataStore: {
        editable: undefined,
        popupItems: undefined,

    },
    type: undefined, // [tabs,form,fieldSet,text,select,input,coordinates,container,breakLine]
    name: undefined,
    title: undefined,
    css: undefined,
    editable: undefined,
    isProcessed: undefined,
    dataManagerLink: undefined,
    popupItems: undefined,
    children: undefined,
    accept: undefined,
    origSrc: undefined,
    src: undefined,
    dbSrc: undefined,
    relative: undefined,
    allowRemove: undefined,
    popupItems: undefined,
    itemPattern: undefined,
    itemName: undefined,

    clone: function() {
        var formItem = this;
        var clonedItem = $.extend(true,{},formItem);
        clonedItem.protoype = formItem.protoype;
        return clonedItem;
    },


    preprocess: function (schema,dataManager) {
        return this.clone();
    },

    process: function (feature) {
        return this.clone();
    },

};