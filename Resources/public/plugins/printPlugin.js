(function() {
    "use strict";

    Mapbender.Digitizer.printPlugin = {

        printDigitizerFeature: function (feature, schema) {
            var d = $.Deferred();
            this.digitizerData = {
                digitizer_feature: Object.assign({}, feature, {
                    schemaName: schema.schemaName
                })
            };

            var self = this;
            this._getDigitizerTemplates(schema.schemaName, d).then(function() {
                self.open();
            });
            return d;
        },

        _getDigitizerTemplates: function (schemaName, defered) {
            var self = this;

            var url =  this.elementUrl + 'getDigitizerTemplates';
            return $.ajax({
                url: url,
                type: 'GET',
                data: {schemaName: schemaName},
                success: function(data) {
                    self._overwriteTemplateSelect(data);
                }
            });
        },

        _overwriteTemplateSelect: function (templates) {
            var templateSelect = $('select[name=template]', this.element);
            var templateList = templateSelect.siblings(".dropdownList");
            var valueContainer = templateSelect.siblings(".dropdownValue");

            templateSelect.empty();
            templateList.empty();

            var count = 0;
            $.each(templates, function (key, template) {
                templateSelect.append($('<option></option>', {
                    'value': template.template,
                    'html': template.label,
                    'class': "opt-" + count
                }));
                templateList.append($('<li></li>', {
                    'html': template.label,
                    'class': "item-" + count
                }));
                if (count === 0) {
                    valueContainer.text(template.label);
                }
                ++count;
            });
            this.overwriteTemplates = true;
        }


    };


})();
