(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget, for access to _saveItem method
     * @constructor
     */
    Mapbender.Digitizer.FeatureStyleEditor = function(owner) {
        this.owner = owner;
    };
    /**
     * @param {*} schema
     * @param {*} feature
     * @return {Element}
     */
    Mapbender.Digitizer.FeatureStyleEditor.prototype.renderDialogContent = function(schema, feature) {
        var geomType = feature.getGeometry().getType();
        /** @todo: this is a static form, use a twig template */
        var element = $("<div/>");
        var fillTab = {
            title: Mapbender.trans('mb.digitizer.style.filling'),
            type: "form",
            children: [{
                type: 'fieldSet',
                children: [{
                    title: Mapbender.trans('mb.digitizer.style.color'),
                    type: "colorPicker",
                    name: "fillColor",
                    mandatory: "/^#{1,1}[abcdefABCDEF0-9]{6,6}$/",
                    mandatoryText: Mapbender.trans('mb.digitizer.style.chooseColorPicker'),
                    css: {width: "30%"}
                }, {
                    title: Mapbender.trans('mb.digitizer.style.opacity'),
                    name: "fillOpacity",
                    type: "slider",
                    range: "max",
                    min: 0.1,
                    max: 1,
                    step: 0.1,
                    css: {width: "35%"}

                }, {
                    title: Mapbender.trans('mb.digitizer.style.radius'),
                    name: "pointRadius",
                    type: "slider",
                    mandatory: "/^\\d+$/",
                    mandatoryText: Mapbender.trans('mb.digitizer.style.onlyNumbers'),
                    range: "max",
                    min: 0,
                    max: 20,
                    css: {
                        width: "35%",
                        visibility: geomType == "Point" ? "visible" : "hidden"
                    }

                }]
            }]
        };
        var strokeTab = {
            title: Mapbender.trans('mb.digitizer.style.stroke'),
            type: "form",
            children: [{
                type: 'fieldSet',
                children: [{
                    title: Mapbender.trans('mb.digitizer.style.color'),
                    type: "colorPicker",
                    name: "strokeColor",
                    horizontal: true,
                    mandatory: "/^\#[A-F0-9]{6}$/i",
                    mandatoryText: Mapbender.trans('mb.digitizer.style.chooseColorPicker'),
                    css: {width: "30%"}

                }, {
                    title: Mapbender.trans('mb.digitizer.style.opacity'),
                    name: "strokeOpacity",
                    type: "slider",
                    range: "max",
                    min: 0.1,
                    max: 1,
                    step: 0.1,
                    css: {width: "35%"}

                }, {
                    title: Mapbender.trans('mb.digitizer.style.width'),
                    type: "slider",
                    name: "strokeWidth",
                    min: 0,
                    max: 10,
                    step: 1,
                    css: {width: "35%"}
                }]
            }, {
                type: 'fieldSet',
                children: [{
                    title: Mapbender.trans('mb.digitizer.style.lineCap'),
                    name: "strokeLinecap",
                    type: "select",
                    options: {
                        round: Mapbender.trans('mb.digitizer.style.round'),
                        square: Mapbender.trans('mb.digitizer.style.square'),
                        butt: Mapbender.trans('mb.digitizer.style.butt')
                    },
                    css: {width: "50%"}
                }, {
                    title: Mapbender.trans('mb.digitizer.style.style'),
                    name: "strokeDashstyle",
                    type: "select",
                    options: {
                        solid: Mapbender.trans('mb.digitizer.style.solid'),
                        dot: Mapbender.trans('mb.digitizer.style.dot'),
                        dash: Mapbender.trans('mb.digitizer.style.dash'),
                        longdash: Mapbender.trans('mb.digitizer.style.longdash'),
                        dashdot: Mapbender.trans('mb.digitizer.style.dashdot'),
                        longdashdot: Mapbender.trans('mb.digitizer.style.longdashdot')
                    },
                    css: {width: "50%"}

                }]
            }]
        };

        var labelTab = {

            title: Mapbender.trans('mb.digitizer.style.caption'),
            type: 'form',
            children: [
                {
                    type: 'textArea',
                    name: 'label',
                    title: Mapbender.trans('mb.digitizer.style.caption'),
                    infoText: Mapbender.trans('mb.digitizer.style.captionInfoText')
                }, {
                    type: 'fieldSet',
                    children: [{
                        title: Mapbender.trans('mb.digitizer.style.fontname'),
                        type: 'select',
                        options: {
                            'Arial, Helvetica, sans-serif': 'Arial, Helvetica, sans-serif',
                            'Arial Black, Gadget, sans-serif': 'Arial Black, Gadget, sans-serif',
                            'Comic Sans MS, cursive, sans-serif': 'Comic Sans MS, cursive, sans-serif',
                            'Impact, Charcoal, sans-serif': 'Impact, Charcoal, sans-serif',
                            'Lucida Sans Unicode, Lucida Grande, sans-serif': 'Lucida Sans Unicode, Lucida Grande, sans-serif',
                            'Tahoma, Geneva, sans-serif': 'Tahoma, Geneva, sans-serif',
                            'Trebuchet MS, Helvetica, sans-serif': 'Trebuchet MS, Helvetica, sans-serif',
                            'Verdana, Geneva, sans-serif': 'Verdana, Geneva, sans-serif',
                            'Georgia, serif': 'Georgia, serif (nichtproportionale Schrift)',
                            'Palatino Linotype, Book Antiqua, Palatino, serif': 'Palatino Linotype, Book Antiqua, Palatino, serif (nichtproportionale Schrift)',
                            'Times New Roman, Times, serif': 'Times New Roman, Times, serif (nichtproportionale Schrift)'
                        },
                        name: 'fontFamily',
                        css: {width: "50%"}

                    }, {
                        title:  Mapbender.trans('mb.digitizer.style.size'),
                        name: 'fontSize',
                        type: 'select',
                        options: {
                            "9": 9,
                            "10": 10,
                            "11": 11,
                            "12": 12,
                            "13": 13,
                            "14": 14,
                            "20": 20,
                            "24": 24
                        },
                        css: {width: "20%"}
                    },
                        {
                            title: Mapbender.trans('mb.digitizer.style.weight'),
                            name: 'fontWeight',
                            type: 'select',
                            options: {
                                'regular':  Mapbender.trans('mb.digitizer.style.regular'),
                                'bold':  Mapbender.trans('mb.digitizer.style.bold'),
                                'italic':  Mapbender.trans('mb.digitizer.style.italic')
                            },
                            css: {width: "30%"},
                        }, {
                            title:  Mapbender.trans('mb.digitizer.style.color'),
                            type: 'colorPicker',
                            name: 'fontColor',
                            // infoText: 'The font color for the label, to be provided like CSS.',
                            css: {width: "50%"}
                        }, {
                            title:  Mapbender.trans('mb.digitizer.style.opacity'),
                            name: "fontOpacity",
                            type: "slider",
                            range: "max",
                            min: 0,
                            max: 1,
                            step: 0.01,
                            css: {
                                width: '50%'
                            }
                        }
                    ]
                }]

        };


        var tabs = [];

        if (geomType !== "LineString") {
            tabs.push(fillTab);
        }

        tabs.push(strokeTab);
        tabs.push(labelTab);

        element.generateElements({
            type: "tabs",
            children: tabs
        });
        return element;
    };
    Mapbender.Digitizer.FeatureStyleEditor.prototype.openEditor = function(schema, feature, values) {
        var element = this.renderDialogContent(schema, feature)
        var editor = this;
        element.popupDialog({
            title: "Stylemanager",
            modal: true,
            width: '500px',
            classes: {
                'ui-dialog-content': 'ui-dialog-content digitizer-style-editor'
            },
            buttons: [{
                text: "Abbrechen",
                click: function (e) {
                    element.popupDialog("close");
                    return false;
                }
            }, {
                text: "Speichern",
                click: function (e) {
                    editor.submit(schema, feature, element);
                }
            }]
        });
        element.formData(Object.assign({}, this.getDefaults(schema), values));
        // Work around vis-ui formData not updating selects properly
        $('select', element).trigger('change');
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


