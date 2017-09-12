(function($) {

    /**
     * Style manager widget
     */
    $.widget('mapbender.featureStyleEditor', {
        options: {
            asPopup:      true,
            data:         {
                'id':         null,
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
            commonTab:    true,
            fillTab: true
        },

        /**
         * Generate StyleManagerForm
         */
        _create: function() {
            var widget = this;
            var element = $(widget.element);
            var options = widget.options;
            var commonTab = {
                title:    "Allgemein",
                type:     "form",
                children: [{
                    type:      'input',
                    name:      'name',
                    title:     'Name',
                    mandatoryText: "Bitte einen Namen eintrag                                                                                                                                                                                                                                                                       en.",
                    infoText:  'Die Name erscheint in der Auswahlliste.',
                    mandatory: true
                }]
            };
            var customColors = options.customColors;
            var fillTab = {
                title:    "Füllung",
                type:     "form",
                children: [{
                    type:     'fieldSet',
                    children: [{
                        title:          "Farbe",
                        type:           "colorPicker",
                        name:           "fillColor",
                        value:          "#ff0000",
                        mandatory:      "/^#{1,1}[abcdefABCDEF0-9]{6,6}$/",
                        mandatoryText:  "Bitte Farbwähler nutzen",
                        colorSelectors: customColors,
                        css:            {width: "30%"}
                    }, {
                        title: "Deckkraft",
                        name:  "fillOpacity",
                        type:  "slider",
                        range: "max",
                        min:   0.1,
                        max:   1,
                        value: 1,
                        step:  0.1,
                        css:   {width: "35%"}

                    }, {
                        title:         "Punkt Radius",
                        name:          "pointRadius",
                        type:          "slider",
                        mandatory:     "/^\\d+$/",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        range:         "max",
                        min:           0,
                        max:           20,
                        value:         0,
                        css:   {width: "35%"}

                    },{
                        title:   "Aktivieren",
                        type:    "checkbox",
                        checked: true,
                        name:    "fill",
                        value:   '1'
                    }]
                }]
            };
            var backGroundTab = {
                title:    "Hintegrund",
                type:     "form",
                children: [{
                    type:     'fieldSet',
                    children: [{
                        title:         "Breite",
                        infoText:      "Die Breite der Hintergrund-Breite.  Wenn nicht angegeben, wird die graphicWidth verwendet.",
                        type:          "input",
                        name:          "backgroundWidth",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        css:           {width: '50%'}

                    }, {
                        title:         "Höhe",
                        infoText:      "Die Breite der Hintergrund-Höhe.  Wenn nicht angegeben, wird die graphicHeight verwendet.",
                        type:          "input",
                        name:          "backgroundHeight",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        css:           {width: '50%'}
                    }]
                }, {
                    type:     'fieldSet',
                    children: [{
                        title: "X-Offset", // infoText:  "The x offset (in pixels) for the background graphic.",
                        name:  "backgroundXOffset",
                        type:  "slider",
                        range: "max",
                        min:   0,
                        max:   100,
                        value: 0,
                        step:  1,
                        css:   {
                            width: '33%'
                        }
                    }, {
                        title: "Y-Offset",
                        type:  "slider",
                        name:  "backgroundYOffset",
                        range: "max",
                        min:   0,
                        max:   100,
                        value: 0,
                        step:  1,
                        css:   {
                            width: '33%'
                        }
                    }, {
                        title: "Z-Index",
                        type:  "slider",
                        name:  "backgroundGraphicZIndex", // infoText:  "The integer z-index value to use in rendering the background graphic.",
                        range: "max",
                        min:   0,
                        max:   100,
                        value: 0,
                        step:  1,
                        css:   {
                            width: '34%'
                        }
                    }]
                }, {
                    title:       "Bild URL",
                    infoText:    "Url to a graphic to be used as the background under an externalGraphic.",
                    type:        "input",
                    name:        "backgroundGraphic",
                    value:       "",
                    placeholder: "URL"
                }]
            };
            var strokeTab = {
                title:    "Rand",
                type:     "form",
                children: [{
                    type:     'fieldSet',
                    children: [{
                        title:         "Farbe",
                        type:          "colorPicker",
                        name:          "strokeColor",
                        value:         "#ffffff",
                        horizontal:    true,
                        mandatory:     "/^\#[A-F0-9]{6}$/i",
                        mandatoryText: "Bitte Farbwähler nutzen",
                        css:           {width: "30%"}

                    }, {
                        title: "Deckkraft",
                        name:  "strokeOpacity",
                        type:  "slider",
                        range: "max",
                        min:   0.1,
                        max:   1,
                        value: 1,
                        step:  0.1,
                        css:   {width: "35%"}

                    }, {
                        title: "Breite",
                        type:  "slider",
                        name:  "strokeWidth",
                        min:   0,
                        max:   10,
                        step:  1,
                        value: 1,
                        css:   {width: "35%"}
                    }]
                }, {
                    type:     'fieldSet',
                    children: [{
                        title:   "Glättung",
                        name:    "strokeLinecap",
                        type:    "select",
                        options: {
                            round:  "abgerundet",
                            square: "eckig",
                            butt:   "bündig"
                        },
                        value:   "round",
                        css:     {width: "50%"}
                    }, {
                        title:   "Style",
                        name:    "strokeDashstyle",
                        type:    "select",
                        //  strokeDashstyle	{String} Stroke dash style.
                        // Default is “solid”.  [dot | dash | dashdot | longdash | longdashdot | solid]
                        options: {
                            solid:           'Durchgezogen',
                            // shortdash:       'Kurze Striche',
                            // shortdot:        'Kleine Punkte',
                            // shortdashdot:    'Strichpunkt, kurz',
                            // shortdashdotdot: 'Strichpunktpunkt, kurz',
                            dot:             'Punktiert',
                            dash:            'Gestrichelt',
                            longdash:        'Gestrichelt, lang',
                            dashdot:         'Strichpunkt',
                            longdashdot:     'Strichpunktpunkt'
                            // longdashdotdot:  'Strichpunktpunkt, lang'
                        },
                        value:   "solid",
                        css:     {width: "50%"}

                    }]
                }, {
                    title:   "Aktivieren",
                    type:    "checkbox",
                    checked: true,
                    name:    "stroke",
                    value:   '1'
                }]
            };
            var imageTab = {
                title:    "Bild",
                type:     "form",
                children: [{
                    title:    "Name",
                    type:     "input",
                    name:     "graphicName",
                    infoText: "Named graphic to use when rendering points.  Supported values include “circle” (default), “square”, “star”, “x”, “cross”, “triangle”."
                }, {
                    type:     'fieldSet',
                    children: [{
                        title:         "Breite",
                        type:          "input",
                        name:          "graphicWidth",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        css:           {width: '50%'}
                    }, {
                        title:         "Höhe",
                        type:          "input",
                        name:          "graphicHeight",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        css:           {width: '50%'}
                    }]
                }, {
                    type:     'fieldSet',
                    children: [{
                        title:         "X-Offset",
                        name:          "graphicXOffset",
                        type:          "slider",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        range:         "max",
                        min:           0,
                        max:           100,
                        value:         0,
                        step:          1,
                        css:           {
                            width: '33%'
                        }
                    }, {
                        title:         "Y-Offset",
                        type:          "slider",
                        name:          "graphicYOffset",
                        mandatoryText: "Bitte nur Zahlen verwenden",
                        range:         "max",
                        min:           0,
                        max:           100,
                        value:         0,
                        step:          1,
                        css:           {
                            width: '33%'
                        }
                    }, {
                        title: "Deckkraft",
                        name:  "graphicOpacity",
                        type:  "slider",
                        range: "max",
                        min:   0,
                        max:   1,
                        value: 1,
                        step:  0.01,
                        css:   {
                            width: '34%'
                        }
                    }]
                }, {
                    title:       "URL",
                    type:        "input",
                    name:        "graphicUrl",
                    value:       "",
                    placeholder: "URL"
                }]
            };
            var labelTab = {

                title:    'Beschriftung',
                type:     'form',
                children: [// labelAlign	{String} Label alignment.  This specifies the insertion point relative to the text.  It is a string composed of two characters.  The first character is for the horizontal alignment, the second for the vertical alignment.  Valid values for horizontal alignment: “l”=left, “c”=center, “r”=right.  Valid values for vertical alignment: “t”=top, “m”=middle, “b”=bottom.  Example values: “lt”, “cm”, “rb”.  Default is “cm”.
                    // labelXOffset	{Number} Pixel offset along the positive x axis for displacing the label.  Not supported by the canvas renderer.
                    // labelYOffset	{Number} Pixel offset along the positive y axis for displacing the label.  Not supported by the canvas renderer.
                    // labelOutlineColor	{String} The color of the label outline.  Default is ‘white’.  Only supported by the canvas & SVG renderers.
                    // labelOutlineWidth	{Number} The width of the label outline.  Default is 3, set to 0 or null to disable.  Only supported by the SVG renderers.
                    // labelOutlineOpacity	{Number} The opacity (0-1) of the label outline.  Default is fontOpacity.  Only supported by the canvas & SVG renderers.
                    {
                        type:     'textArea',
                        css:      {width: "100 %"},
                        name:     'label',
                        infoText: 'The text for an optional label.  For browsers that use the canvas renderer, this requires either fillText or mozDrawText to be available.'
                    }, {
                        type:     'fieldSet',
                        children: [{
                            title:   'Fontname',
                            type:    'select',
                            value:   'Arial, Helvetica, sans-serif',
                            options: {
                                'Arial, Helvetica, sans-serif':                         'Arial, Helvetica, sans-serif',
                                '"Arial Black", Gadget, sans-serif':                    'Arial Black, Gadget, sans-serif',
                                '"Comic Sans MS", cursive, sans-serif':                 'Comic Sans MS, cursive, sans-serif',
                                'Impact, Charcoal, sans-serif':                         'Impact, Charcoal, sans-serif',
                                '"Lucida Sans Unicode", "Lucida Grande", sans-serif':   'Lucida Sans Unicode, Lucida Grande, sans-serif',
                                'Tahoma, Geneva, sans-serif':                           'Tahoma, Geneva, sans-serif',
                                '"Trebuchet MS", Helvetica, sans-serif':                'Trebuchet MS, Helvetica, sans-serif',
                                'Verdana, Geneva, sans-serif':                          'Verdana, Geneva, sans-serif',
                                'Georgia, serif':                                       'Georgia, serif (nichtproportionale Schrift)',
                                '"Palatino Linotype", "Book Antiqua", Palatino, serif': 'Palatino Linotype, "Book Antiqua", Palatino, serif (nichtproportionale Schrift)',
                                '"Times New Roman", Times, serif':                      'Times New Roman, Times, serif (nichtproportionale Schrift)'
                            },
                            name:     'fontFamily',
                            infoText: 'The font family for the label, to be provided like in CSS.',
                            css:      {width: "50%"}

                        }, {
                            title:   'Grösse',
                            name:    'fontSize',
                            type:    'select',
                            value:   11,
                            options: {
                                "9":  9,
                                "10": 10,
                                "11": 11,
                                "12": 12,
                                "13": 13,
                                "14": 14
                            },
                            css:      {width: "20%"},
                            infoText: 'The font size for the label, to be provided like in CSS'
                        }, //     {
                            //     title:    'Style',
                            //     type:     'input',
                            //     name:     'fontStyle',
                            //     infoText: 'The font style for the label, to be provided like in CSS'
                            // },

                            {
                                title:    'Art',
                                name:     'fontWeight',
                                type:     'select',
                                value:    'regular',
                                options:  {
                                    'regular': 'Normal',
                                    'bold':    'Fett',
                                    'italic':  'Kursive'
                                },
                                css:      {width: "30%"},
                                infoText: 'The font weight for the label, to be provided like in CSS.'
                            }, {
                                title:    'Farbe',
                                type:     'colorPicker',
                                name:     'fontColor',
                                // infoText: 'The font color for the label, to be provided like CSS.',
                                css:      {width: "50%"}
                            }, {
                                title: "Deckkraft",
                                name:  "fontOpacity",
                                type:  "slider",
                                range: "max",
                                min:   0,
                                max:   1,
                                value: 1,
                                step:  0.01,
                                css:   {
                                    width: '50%'
                                }
                            }
                            // ,
                            // {
                            //     title:    "Selektierbar?",
                            //     type:     "checkbox",
                            //     checked:  false,
                            //     name:     "labelSelect",
                            //     infoText: 'If set to true, labels will be selectable using SelectFeature or similar controls.  Default is false.',
                            //     value:    'true',
                            //     css:      {
                            //         width: '30%'
                            //     }
                            // }
                            ]
                    }]

            };
            var miscTab = {
                title:    "Verschiedenes",
                type:     "form",
                children: [{
                    title:   "Zeigersymbol",
                    name:    "cursor",
                    type:    "select",
                    options: {
                        auto:        'Automatisch',
                        'default':   'Vorgabe',
                        crosshair:   'Kreuz',
                        pointer:     'Hand',
                        move:        'Verschieben',
                        // 'n-resize':  'n-resize',
                        // 'ne-resize': 'ne-resize',
                        // 'e-resize':  'e-resize',
                        // 'se-resize': 'se-resize',
                        // 's-resize':  's-resize',
                        // 'sw-resize': 'sw-resize',
                        // 'w-resize':  'w-resize',
                        // 'nw-resize': 'nw-resize',
                        text:        'Textauswahl',
                        wait:        'Warten',
                        help:        'Hilfe'
                    },
                    value:   "pointer"
                }, {
                    title:     "Rotation (°)",
                    name:      "rotation",
                    type:      "slider",
                    mandatory: "/^\\d+$/",
                    range:     "max",
                    min:       0,
                    max:       360,
                    value:     0,
                    step:      1
                }, {
                    title:   "Anzeige",
                    name:    "display",
                    type:    "select",
                    options: {
                        inline:         "inline",
                        "inline-block": "inline-block",
                        block:          "block",
                        none:           "none"
                    },
                    value:   "block"
                }]
            };

            var tabs = [];

            if(options.commonTab) {
                tabs.push(commonTab);
            }

            if(options.fillTab){
                tabs.push(fillTab);
            }

            tabs.push(strokeTab);
            tabs.push(labelTab);
            // tabs.push(imageTab);
            // tabs.push(backGroundTab);
            // tabs.push(miscTab);

            element.generateElements({
                type:     "tabs",
                children: tabs
            });

            window.setTimeout(function() {
                element.formData(options.data);
            }, 100);

            if(options.asPopup) {
                widget.popup();
            }

            return widget;
        },

        popup: function() {
            var widget = this;
            var element = $(widget.element);
            element.popupDialog({
                title:   "Stylemanager",
                modal:   true,
                width:   '500px',
                buttons: [{
                    text:  "Abbrechen",
                    click: function(e) {
                        widget.close();
                        return false;
                    }
                }, {
                    text:  "Speichern",
                    click: function(e) {
                        var form = $(e.currentTarget).closest(".ui-dialog");
                        widget._trigger('submit', null, {
                            form:   form,
                            widget: widget
                        });
                    }
                }]
            });
        },

        /**
         *
         * @private
         */
        close: function() {
            var widget = this;
            var element = $(widget.element);
            var options = widget.options;

            if(options.asPopup) {
                element.popupDialog("close");
            } else {
                widget.element.remove();
            }
        }
    });

})(jQuery);
