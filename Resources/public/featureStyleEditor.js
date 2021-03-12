(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget, for access to _saveItem method
     * @constructor
     */
    Mapbender.Digitizer.FeatureStyleEditor = function(owner) {
        this.owner = owner;
        this.template_ = $.get([this.owner.elementUrl, 'style-editor'].join(''));
    };
    Mapbender.Digitizer.FeatureStyleEditor.prototype.openDialog_ = function($content, schema, feature) {
        var editor = this;
        $content.popupDialog({
            title: "Stylemanager",
            modal: true,
            width: '500px',
            classes: {
                'ui-dialog-content': 'ui-dialog-content digitizer-style-editor'
            },
            buttons: [{
                text: "Abbrechen",
                click: function (e) {
                    $(this).popupDialog("close");
                    return false;
                }
            }, {
                text: "Speichern",
                click: function (e) {
                    editor.submit(schema, feature, $content);
                }
            }]
        });
    };
    Mapbender.Digitizer.FeatureStyleEditor.prototype.openEditor = function(schema, feature, values) {
        var self = this;
        var geomType = feature.getGeometry().getType();
        this.template_.then(function(html) {
            var $content = $(document.createElement('div')).append(html);
            if (geomType !== 'Point') {
                $('[data-style-group="point"]', $content).hide();
            }
            if (geomType === "LineString") {
                $('[data-style-group="fill"]', $content).hide();
            }

            $content.formData(Object.assign({}, self.getDefaults(schema), values));
            // Work around vis-ui formData not updating selects properly
            $('select', $content).trigger('change');
            self.openDialog_($content, schema, feature);
            $('.-js-colorpicker', $content).colorpicker({format: 'hex'});
        });
    };

    Object.assign(Mapbender.Digitizer.FeatureStyleEditor.prototype, {
        submit: function (schema, feature, element) {
            var styleData = element.formData();
            element.disableForm();

            var formData = {};
            formData[schema.featureType.styleField] = JSON.stringify(styleData);
            // TODO enable defered saving
            // @todo: decouple from feature saving; use a distinct url to save the style
            this.owner._saveItem(schema, feature, formData);
            element.popupDialog("close");
        },
        getDefaults: function(schema) {
            return {
                fillColor: '#ff0000',
                fillOpacity: 1.0,
                pointRadius: 5,
                strokeColor: '#ffffff',
                strokeOpacity: 1.0,
                strokeWidth: 1,
                strokeLinecap: 'round',
                strokeDashstyle: 'solid',
                label: null,
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: 11,
                fontWeight: 'regular',
                fontColor: '#000000',
                fontOpacity: 1.0
            };
        }
    });

})();


