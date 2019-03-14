window.Mapbender = window.Mapbender || {};
Mapbender.DigitzerPlugins = {};

Mapbender.DigitzerPlugins.print =  {
    _getTemplateSize: function() {
        var self = this;
        var template = $('select[name="template"]', this.$form).val();
        var cached = this._templateSizeCache[template];
        var promise;
        if (!cached) {
            var url =  this.elementUrl + 'getTemplateSize';
            promise = $.ajax({
                url: url,
                type: 'GET',
                data: {template: template},
                dataType: "json",
                success: function(data) {
                    // dimensions delivered in cm, we need m
                    var widthMeters = data.width / 100.0;
                    var heightMeters = data.height / 100.0;
                    self.width = widthMeters;
                    self.height = heightMeters;
                    self._templateSizeCache[template] = {
                        width: widthMeters,
                        height: heightMeters
                    };
                }
            });
        } else {
            this.width = cached.width;
            this.height = cached.height;
            // Maintain the illusion of an asynchronous operation
            promise = $.Deferred();
            promise.resolve();
        }
        return promise;
    },
    printDigitizerFeature: function(schemaName,featureId){
        // Sonderlocke Digitizer
        this.digitizerData = {
            digitizer_feature: {
                id: featureId,
                schemaName: schemaName
            }
        };

        this._getDigitizerTemplates(schemaName);
    },

    _getDigitizerTemplates: function(schemaName) {

        var self = this;

        var url =  this.elementUrl + 'getDigitizerTemplates';
        $.ajax({
            url: url,
            type: 'GET',
            data: {schemaName: schemaName},
            success: function(data) {
                self._overwriteTemplateSelect(data);
                // open changed dialog
                self.open();
            }
        });
    },

    _overwriteTemplateSelect: function(templates) {
        var templateSelect = $('select[name=template]', this.element);
        var templateList = templateSelect.siblings(".dropdownList");
        var valueContainer = templateSelect.siblings(".dropdownValue");

        templateSelect.empty();
        templateList.empty();

        var count = 0;
        $.each(templates, function(key,template) {
            templateSelect.append($('<option></option>', {
                'value': template.template,
                'html': template.label,
                'class': "opt-" + count
            }));
            templateList.append($('<li></li>', {
                'html': template.label,
                'class': "item-" + count
            }));
            if(count == 0){
                valueContainer.text(template.label);
            }
            ++count;
        });
        this.overwriteTemplates = true;
    }


};



