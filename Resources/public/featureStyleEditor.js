(function () {
    "use strict";

    Mapbender.Digitizer.FeatureStyleEditor = function (feature, schema, options) {

        var editor = this;

        editor.feature = feature;
        editor.schema = schema;

        var defaultOptions = {

            asPopup: true,
            data: {
                'id': null,
                'borderSize': 1
            },
            customColors: {
                '#777777': '#777777',
                '#337ab7': '#337ab7',
                '#5cb85c': '#5cb85c',
                '#5bc0de': '#5bc0de',
                '#f0ad4e': '#f0ad4e',
                '#d9534f': '#d9534f'
            },
            commonTab: true,
            fillTab: true
        };

        options = $.extend(defaultOptions, options);

        if (schema.getGeomType()=="LineString") {
            options.fillTab = false;
        }


        var element = $("<div/>");
        var customColors = options.customColors;
        var fillTab = {
            title: "Füllung",
            type: "form",
            children: [{
                type: 'fieldSet',
                children: [{
                    title: "Farbe",
                    type: "colorPicker",
                    name: "fillColor",
                    value: "#ff0000",
                    mandatory: "/^#{1,1}[abcdefABCDEF0-9]{6,6}$/",
                    mandatoryText: "Bitte Farbwähler nutzen",
                    colorSelectors: customColors,
                    css: {width: "30%"}
                }, {
                    title: "Deckkraft",
                    name: "fillOpacity",
                    type: "slider",
                    range: "max",
                    min: 0.1,
                    max: 1,
                    value: 1,
                    step: 0.1,
                    css: {width: "35%"}

                }, {
                    title: "Punkt Radius",
                    name: "pointRadius",
                    type: "slider",
                    mandatory: "/^\\d+$/",
                    mandatoryText: "Bitte nur Zahlen verwenden",
                    range: "max",
                    min: 0,
                    max: 20,
                    value: 0,
                    css: {
                        width: "35%",
                        visibility: schema.getGeomType() == "Point" ? "visible" : "hidden"
                    }

                }, {
                    title: "Aktivieren",
                    type: "checkbox",
                    checked: true,
                    name: "fill",
                    value: '1'
                }]
            }]
        };
        var strokeTab = {
            title: "Rand",
            type: "form",
            children: [{
                type: 'fieldSet',
                children: [{
                    title: "Farbe",
                    type: "colorPicker",
                    name: "strokeColor",
                    value: "#ffffff",
                    horizontal: true,
                    mandatory: "/^\#[A-F0-9]{6}$/i",
                    mandatoryText: "Bitte Farbwähler nutzen",
                    css: {width: "30%"}

                }, {
                    title: "Deckkraft",
                    name: "strokeOpacity",
                    type: "slider",
                    range: "max",
                    min: 0.1,
                    max: 1,
                    value: 1,
                    step: 0.1,
                    css: {width: "35%"}

                }, {
                    title: "Breite",
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
                    title: "Glättung",
                    name: "strokeLinecap",
                    type: "select",
                    options: {
                        round: "abgerundet",
                        square: "eckig",
                        butt: "bündig"
                    },
                    value: "round",
                    css: {width: "50%"}
                }, {
                    title: "Style",
                    name: "strokeDashstyle",
                    type: "select",
                    options: {
                        solid: 'Durchgezogen',
                        dot: 'Gepunktet',
                        dash: 'Gestrichelt',
                        longdash: 'Gestrichelt, lang',
                        dashdot: 'Strichpunkt',
                        longdashdot: 'Strichpunktpunkt'
                    },
                    value: "solid",
                    css: {width: "50%"}

                }]
            }, {
                title: "Aktivieren",
                type: "checkbox",
                checked: true,
                name: "stroke",
                value: '1'
            }]
        };

        var labelTab = {

            title: 'Beschriftung',
            type: 'form',
            children: [
                {
                    type: 'textArea',
                    css: {width: "100 %"},
                    name: 'label',
                    infoText: 'The text for an optional label.  For browsers that use the canvas renderer, this requires either fillText or mozDrawText to be available.'
                }, {
                    type: 'fieldSet',
                    children: [{
                        title: 'Fontname',
                        type: 'select',
                        value: 'Arial, Helvetica, sans-serif',
                        options: {
                            'Arial, Helvetica, sans-serif': 'Arial, Helvetica, sans-serif',
                            '"Arial Black", Gadget, sans-serif': 'Arial Black, Gadget, sans-serif',
                            '"Comic Sans MS", cursive, sans-serif': 'Comic Sans MS, cursive, sans-serif',
                            'Impact, Charcoal, sans-serif': 'Impact, Charcoal, sans-serif',
                            '"Lucida Sans Unicode", "Lucida Grande", sans-serif': 'Lucida Sans Unicode, Lucida Grande, sans-serif',
                            'Tahoma, Geneva, sans-serif': 'Tahoma, Geneva, sans-serif',
                            '"Trebuchet MS", Helvetica, sans-serif': 'Trebuchet MS, Helvetica, sans-serif',
                            'Verdana, Geneva, sans-serif': 'Verdana, Geneva, sans-serif',
                            'Georgia, serif': 'Georgia, serif (nichtproportionale Schrift)',
                            '"Palatino Linotype", "Book Antiqua", Palatino, serif': 'Palatino Linotype, "Book Antiqua", Palatino, serif (nichtproportionale Schrift)',
                            '"Times New Roman", Times, serif': 'Times New Roman, Times, serif (nichtproportionale Schrift)'
                        },
                        name: 'fontFamily',
                        infoText: 'The font family for the label, to be provided like in CSS.',
                        css: {width: "50%"}

                    }, {
                        title: 'Grösse',
                        name: 'fontSize',
                        type: 'select',
                        value: 11,
                        options: {
                            "9": 9,
                            "10": 10,
                            "11": 11,
                            "12": 12,
                            "13": 13,
                            "14": 14
                        },
                        css: {width: "20%"},
                        infoText: 'The font size for the label, to be provided like in CSS'
                    },
                        {
                            title: 'Art',
                            name: 'fontWeight',
                            type: 'select',
                            value: 'regular',
                            options: {
                                'regular': 'Normal',
                                'bold': 'Fett',
                                'italic': 'Kursiv'
                            },
                            css: {width: "30%"},
                            infoText: 'The font weight for the label, to be provided like in CSS.'
                        }, {
                            title: 'Farbe',
                            type: 'colorPicker',
                            name: 'fontColor',
                            // infoText: 'The font color for the label, to be provided like CSS.',
                            css: {width: "50%"}
                        }, {
                            title: "Deckkraft",
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

        if (options.fillTab) {
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


