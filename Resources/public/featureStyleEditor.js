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
        $content.dialog({
            title: "Stylemanager",
            modal: true,
            width: '500px',
            classes: {
                'ui-dialog': 'ui-dialog mb-element-popup-dialog modal-content',
                'ui-dialog-titlebar': 'ui-dialog-titlebar modal-header',
                'ui-dialog-titlebar-close': 'ui-dialog-titlebar-close close',
                'ui-dialog-content': 'ui-dialog-content modal-body digitizer-style-editor',
                'ui-dialog-buttonpane': 'ui-dialog-buttonpane modal-footer',
                'ui-button': 'ui-button button btn'
            },
            hide: {
                effect: 'fadeOut',
                duration: 200
            },
            buttons: [{
                text: "Abbrechen",
                class: 'button btn',
                click: function (e) {
                    $(this).dialog('close');
                }
            }, {
                text: "Speichern",
                class: 'button btn',
                click: function (e) {
                    editor.submit(schema, feature, $content);
                    $(this).dialog('close');
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


