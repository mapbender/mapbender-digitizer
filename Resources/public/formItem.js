
var FormItem = function (item) {

    var formItem = this;
    formItem = $.extend(formItem, item);

};

FormItem.prototype = {


    dataStore:  {
        editable: undefined,
        popupItems: undefined,

    },
    type: undefined, // [tabs,form,fieldSet,text,select,input,coordinates,container,breakLine]
    name: undefined,
    title: undefined,
    css:  undefined,
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



    setDependencies: function() {

    },



};
