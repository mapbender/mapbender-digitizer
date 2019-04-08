window.Mapbender = window.Mapbender || {};
Mapbender.DigitzerPlugins = Mapbender.DigitzerPlugins || {};

Mapbender.DigitzerPlugins.print =  {
    /**
     * @param {OpenLayers.Feature.Vector} feature
     * @return {Object}
     * @private
     */
    printDigitizerFeature: function(attributesOrFeature,templateName){
        // Sonderlocke Digitizer
        var d = new $.Deferred();
        if (typeof attributesOrFeature !== 'object') {
            var msg = "Unsupported mbPrintClient.printDigitizerFeature invocation. Must pass in printable attributes object (preferred) or OpenLayers feature to extract them from. Update your mapbender/digitizer to >=1.1.68";
            console.error(msg, arguments);
            throw new Error(msg);
        }
        var attributes;
        if (attributesOrFeature.attributes) {
            // Standard OpenLayers feature; see https://github.com/openlayers/ol2/blob/release-2.13.1/lib/OpenLayers/Feature/Vector.js#L44
            attributes = this._extractPrintAttributes(attributesOrFeature);
        } else {
            // Plain-old-data attributesOrFeature object (preferred invocation method)
            attributes = attributesOrFeature;
        }

        this.digitizerData = {
            // Freeze attribute values in place now.
            // Also, if the resulting object is not serializable (cyclic refs), let's run into that error right now
            digitizer_feature: JSON.parse(JSON.stringify(attributes))
        };

        if (templateName) {
            var self = this;
            this._getDigitizerTemplates(templateName,d).then(function(data) {
                this._overwriteTemplateSelect(data);
                this.open();
                this.popup.$element.one('close', function(){
                    d.resolve();
                });

        }.bind(this))} else {
            this.open();
            this.popup.$element.one('close', function(){
                    d.resolve();
            });
        }




        return d;
    },

    _getDigitizerTemplates: function(schemaName,defered) {

        var url =  this.elementUrl + 'getDigitizerTemplates';
        return $.ajax({
            url: url,
            type: 'GET',
            data: {schemaName: schemaName},

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



