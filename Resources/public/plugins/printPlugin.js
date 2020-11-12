(function() {
    "use strict";

    Mapbender.Digitizer.printPlugin = {

        printDigitizerFeature: function (feature,schemaName) {
            var d = $.Deferred();
            this.digitizerData = {
                digitizer_feature: {
                    id: feature.fid,
                    schemaName: schemaName
                }
            };

            this._getDigitizerTemplates(schemaName);
            return d;
        },

        _getDigitizerTemplates: function (schemaName) {

            var self = this;

            var url = this.elementUrl + 'getDigitizerTemplates';
            return $.ajax({
                url: url,
                type: 'GET',
                data: {schemaName: schemaName},
                success: function (data) {
                    self._overwriteTemplateSelect(data);
                    // open changed dialog
                    self.open();
                    self.popup.$element.one('close', function () {
                    });
                    return true;
                },
                error: function() {
                  console.error("Print Request failed");
                  return true;
                },
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
