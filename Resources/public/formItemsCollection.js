var FormItemsCollection = function(rawFormItems) {

    var formItemsCollection = this;

    formItemsCollection = $.extend(formItemsCollection, rawFormItems);

    formItemsCollection = Mapbender.DigitizerTranslator.translateStructure(formItemsCollection);
};

FormItemsCollection.prototype =  {

};