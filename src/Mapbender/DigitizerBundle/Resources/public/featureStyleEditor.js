(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget
     * @param {Mapbender.DataManager.DialogFactory} dialogFactory
     * @constructor
     */
    Mapbender.Digitizer.FeatureStyleEditor = function(owner, dialogFactory) {
        this.owner = owner;
        this.template_ = $.get([this.owner.elementUrl, 'style-editor'].join(''));
        this.dialogFactory = dialogFactory;
    };
    Mapbender.Digitizer.FeatureStyleEditor.prototype.openDialog_ = function($content) {
        var promise = $.Deferred();
        var editor = this;
        this.dialogFactory.dialog($content, {
            title: "Style manager",
            width: '500px',
            resizable: true,
            classes: {
                'ui-dialog-content': 'ui-dialog-content data-manager-edit-data digitizer-style-editor content-padding'
            },
            buttons: [{
                text: Mapbender.trans('mb.digitizer.actions.save'),
                class: 'btn btn-primary',
                click: function (e) {
                    var values = editor.getFormData(this);
                    promise.resolveWith(null, [values]);
                    $(this).dialog('close');
                }
            },{
                text: Mapbender.trans('mb.digitizer.actions.cancel'),
                class: 'btn btn-light',
                click: function (e) {
                    promise.reject();
                    $(this).dialog('close');
                }
            }]
        });
        return promise;
    };
    Mapbender.Digitizer.FeatureStyleEditor.prototype.openEditor = function(schema, feature, values) {
        var self = this;
        var valuesPromise = $.Deferred();
        this.template_.then(function(html) {
            var $content = $(document.createElement('div')).append(html);
            self.configureContent($content, schema, feature);
            var formData = self.extendDefaults(schema, values);
            $(':input', $content).filter('[name]').each(function() {
                if (typeof formData[this.name] !== 'undefined' && formData[this.name] !== null) {
                    $(this).val(formData[this.name]);
                }
            });
            $('input[type="range"]', $content).each(function() {
                var $input = $(this);
                var $vp = $('.value-preview', $input.closest('.mb-3'));
                var update = function($el) {
                    var value = parseFloat($input.val());
                    if (!isNaN(value)) {
                        $vp.text(value.toFixed(2));
                    }
                };
                update($input);
                $input.on('change', function() {
                    update($(this));
                });
            });

            var dlgPromise = self.openDialog_($content);
            $('.-js-colorpicker', $content).colorpicker({format: 'hex'});
            dlgPromise.always(function() {
                $('.-js-colorpicker', $content).colorpicker('destroy');
            });
            dlgPromise.then(function(values) {
                valuesPromise.resolveWith(null, [values]);
            }, function() {
                valuesPromise.rejectWith(this, arguments);
            });
        });
        return valuesPromise;
    };

    Object.assign(Mapbender.Digitizer.FeatureStyleEditor.prototype, {
        configureContent: function($content, schema, feature) {
            var geomType = feature.getGeometry().getType();
            if (geomType !== 'Point') {
                $('[data-style-group="point"]', $content).hide();
            }
            if (geomType === "LineString") {
                $('[data-style-group="fill"]', $content).hide();
            }
        },
        getFormData: function($scope) {
            var data = {};
            $(':input', $scope).filter('[name]').each(function() {
                data[this.name] = $(this).val();
            });
            return data;
        },
        extendDefaults: function(schema, values) {
            var defaults = this.getDefaults(schema);
            var merged = Object.assign({}, defaults, values);
            // Fix empty values that cannot be allowed (breaks colorpickers
            // and rendering)
            ['fillColor', 'strokeColor', 'fontColor'].forEach(function(nonEmpty) {
                if (!merged[nonEmpty]) {
                    merged[nonEmpty] = defaults[nonEmpty];
                }
            });
            return merged;
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


