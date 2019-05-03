(function () {
    "use strict";

    Mapbender.Digitizer.FormItemInput = {

        process: function (feature,dialog,schema) {
            var formItem = this;
            if (schema.popup.remoteData && formItem.automatic_detection) {
                var children = [];

                var input = {
                    type: formItem.type,
                    title: formItem.title,
                    label: '',
                    name: formItem.name,
                    mandatory: formItem.mandatory,
                    options: formItem.options,
                    css: {width: '80%'},
                    keyup: formItem.keyup

                };

                var button = {
                    type: "button",
                    title: "<i class='fa fa-plus'></i>",
                    css: {'margin-left': '15px', 'margin-bottom': '2px', 'width': '10%', 'max-width': '30px'},
                    label: '',
                    attr: {'href': '#', 'title': 'Automatisch ermitteln' },
                    click: function () {
                        var inputfield = $(dialog).find("[name=" + formItem.name + "]");
                        inputfield.attr('disabled','disabled');
                        schema.getRemotePropertyValue(feature, formItem.name).done(function (value) {
                            inputfield.removeAttr('disabled');
                            inputfield.val(value).keyup();
                        });
                        return false;
                    }
                };

                children.push(input);
                children.push(button);

                var fieldSetItem = {};
                Object.setPrototypeOf(fieldSetItem,Mapbender.Digitizer.FormItemFieldSet);

                fieldSetItem.title = '';
                fieldSetItem.label = '';
                fieldSetItem.cssClass = 'automatic-detection-fieldset';
                fieldSetItem.children = children;

                return fieldSetItem;
                
            }
        }
        
    };

    Object.setPrototypeOf(Mapbender.Digitizer.FormItemInput, Mapbender.Digitizer.FormItem);

})();
