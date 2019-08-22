(function () {
    "use strict";

    Mapbender.Digitizer.FeatureStyleEditor = function (feature, schema, options) {

        var editor = this;

        editor.feature = feature;
        editor.schema = schema;

        var defaultOptions = {
        };

        options = $.extend(defaultOptions, options);

        var geomType = feature.getGeometry().getType();

        var element = $("<div/>");
        var customColors = options.customColors;
        var fillTab = {
            title: Mapbender.DataManager.Translator.translate('style.filling'),
            type: "form",
            children: [{
                type: 'fieldSet',
                children: [{
                    title: Mapbender.DataManager.Translator.translate('style.color'),
                    type: "colorPicker",
                    name: "fillColor",
                    value: "#ff0000",
                    mandatory: "/^#{1,1}[abcdefABCDEF0-9]{6,6}$/",
                    mandatoryText: Mapbender.DataManager.Translator.translate('style.chooseColorPicker'),
                    colorSelectors: customColors,
                    css: {width: "30%"}
                }, {
                    title: Mapbender.DataManager.Translator.translate('style.opacity'),
                    name: "fillOpacity",
                    type: "slider",
                    range: "max",
                    min: 0.1,
                    max: 1,
                    value: 1,
                    step: 0.1,
                    css: {width: "35%"}

                }, {
                    title: Mapbender.DataManager.Translator.translate('style.radius'),
                    name: "pointRadius",
                    type: "slider",
                    mandatory: "/^\\d+$/",
                    mandatoryText: Mapbender.DataManager.Translator.translate('style.onlyNumbers'),
                    range: "max",
                    min: 0,
                    max: 20,
                    value: 0,
                    css: {
                        width: "35%",
                        visibility: geomType == "Point" ? "visible" : "hidden"
                    }

                }, {
                    title: Mapbender.DataManager.Translator.translate('style.activate'),
                    type: "checkbox",
                    checked: true,
                    name: "fill",
                    value: '1'
                }]
            }]
        };
        var strokeTab = {
            title: Mapbender.DataManager.Translator.translate('style.stroke'),
            type: "form",
            children: [{
                type: 'fieldSet',
                children: [{
                    title: Mapbender.DataManager.Translator.translate('style.color'),
                    type: "colorPicker",
                    name: "strokeColor",
                    value: "#ffffff",
                    horizontal: true,
                    mandatory: "/^\#[A-F0-9]{6}$/i",
                    mandatoryText: Mapbender.DataManager.Translator.translate('style.chooseColorPicker'),
                    css: {width: "30%"}

                }, {
                    title: Mapbender.DataManager.Translator.translate('style.opacity'),
                    name: "strokeOpacity",
                    type: "slider",
                    range: "max",
                    min: 0.1,
                    max: 1,
                    value: 1,
                    step: 0.1,
                    css: {width: "35%"}

                }, {
                    title: Mapbender.DataManager.Translator.translate('style.width'),
                    type: "slider",
                    name: "strokeWidth",
                    min: 0,
                    max: 10,
                    step: 1,
                    value: 1,
                    css: {width: "35%"}
                }]
            }, {
                type: 'fieldSet',
                children: [{
                    title: Mapbender.DataManager.Translator.translate('style.lineCap'),
                    name: "strokeLinecap",
                    type: "select",
                    options: {
                        round: Mapbender.DataManager.Translator.translate('style.round'),
                        square: Mapbender.DataManager.Translator.translate('style.square'),
                        butt: Mapbender.DataManager.Translator.translate('style.butt')
                    },
                    value: "round",
                    css: {width: "50%"}
                }, {
                    title: Mapbender.DataManager.Translator.translate('style.style'),
                    name: "strokeDashstyle",
                    type: "select",
                    options: {
                        solid: Mapbender.DataManager.Translator.translate('style.solid'),
                        dot: Mapbender.DataManager.Translator.translate('style.dot'),
                        dash: Mapbender.DataManager.Translator.translate('style.dash'),
                        longdash: Mapbender.DataManager.Translator.translate('style.longdash'),
                        dashdot: Mapbender.DataManager.Translator.translate('style.dashdot'),
                        longdashdot: Mapbender.DataManager.Translator.translate('style.longdashdot')
                    },
                    value: "solid",
                    css: {width: "50%"}

                }]
            }, {
                title: Mapbender.DataManager.Translator.translate('style.activate'),
                type: "checkbox",
                checked: true,
                name: "stroke",
                value: '1'
            }]
        };

        var labelTab = {

            title: Mapbender.DataManager.Translator.translate('style.caption'),
            type: 'form',
            children: [
                {
                    type: 'textArea',
                    css: {width: "100 %"},
                    name: 'label',
                    infoText: Mapbender.DataManager.Translator.translate('style.captionInfoText')
                }, {
                    type: 'fieldSet',
                    children: [{
                        title: Mapbender.DataManager.Translator.translate('style.fontname'),
                        type: 'select',
                        value: 'Arial, Helvetica, sans-serif',
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
                        infoText:  Mapbender.DataManager.Translator.translate('style.fontnameInfoText'),
                        css: {width: "50%"}

                    }, {
                        title:  Mapbender.DataManager.Translator.translate('style.fontsize'),
                        name: 'fontSize',
                        type: 'select',
                        value: 11,
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
                        css: {width: "20%"},
                        infoText:  Mapbender.DataManager.Translator.translate('style.fontsizeInfoText'),
                    },
                        {
                            title: 'Art',
                            name: Mapbender.DataManager.Translator.translate('style.fontweight'),
                            type: 'select',
                            value: 'regular',
                            options: {
                                'regular':  Mapbender.DataManager.Translator.translate('style.regular'),
                                'bold':  Mapbender.DataManager.Translator.translate('style.bold'),
                                'italic':  Mapbender.DataManager.Translator.translate('style.italic')
                            },
                            css: {width: "30%"},
                            infoText:  Mapbender.DataManager.Translator.translate('style.fontweightInfoText')
                        }, {
                            title:  Mapbender.DataManager.Translator.translate('style.color'),
                            type: 'colorPicker',
                            name: 'fontColor',
                            // infoText: 'The font color for the label, to be provided like CSS.',
                            css: {width: "50%"}
                        }, {
                            title:  Mapbender.DataManager.Translator.translate('style.opacity'),
                            name: "fontOpacity",
                            type: "slider",
                            range: "max",
                            min: 0,
                            max: 1,
                            value: 1,
                            step: 0.01,
                            css: {
                                width: '50%'
                            }
                        }
                    ]
                }]

        };


        var tabs = [];

        if (geomType!="LineString") {
            tabs.push(fillTab);
        }

        tabs.push(strokeTab);
        tabs.push(labelTab);

        element.generateElements({
            type: "tabs",
            children: tabs
        });

        element.popupDialog({
            title: "Stylemanager",
            modal: true,
            width: '500px',
            buttons: [{
                text: "Abbrechen",
                click: function (e) {
                    editor.close();
                    return false;
                }
            }, {
                text: "Speichern",
                click: function (e) {
                    editor.submit();
                }
            }]
        });

        // Unfortunately, vis-ui demands it like this
        window.setTimeout(function(){
            element.formData(options.data);
        },0);

        editor.element = element;

    };

    Mapbender.Digitizer.FeatureStyleEditor.prototype = {


        close: function () {
            var featureStyleEditor = this;
            featureStyleEditor.element.popupDialog("close");
        },

        submit: function () {
            var featureStyleEditor = this;
            var schema = featureStyleEditor.schema;
            var feature = featureStyleEditor.feature;
            var styleData = featureStyleEditor.element.formData();
            featureStyleEditor.element.disableForm();

            console.assert(!!schema.featureType.styleField,"Style Field in Feature Type is not specified");

            var formData = {};
            formData[schema.featureType.styleField] = JSON.stringify(styleData);
            // TODO enable defered saving
            schema.saveFeature(feature,formData);
            featureStyleEditor.close();

        },


    };

})();


