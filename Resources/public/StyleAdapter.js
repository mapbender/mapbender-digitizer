(function () {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.StyleAdapter = {
        defaultStyle_: null,
        defaultText_: null,
        placeholderRx_: /\${([^}]+)}/g,
        styleFunctionFromSvgRules: function(styleConfig, dataCallback) {
            var self = this;
            var placeholderRx = this.placeholderRx_;
            var placeholderCandidates = ['fillColor', 'strokeColor', 'label', 'fontColor'];
            return (function(styleConfig) {
                var placeholderProps = placeholderCandidates.filter(function(prop) {
                    placeholderRx.lastIndex = 0;    // Reset. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test#using_test_on_a_regex_with_the_global_flag
                    return placeholderRx.test(styleConfig[prop] || '');
                });
                var labelValue = styleConfig.label;
                var dynText = labelValue && (placeholderProps.indexOf('label') !== -1 || placeholderProps.indexOf('fontColor') !== -1);
                var dynBase = placeholderProps.indexOf('fillColor') !== -1 || placeholderProps.indexOf('strokeColor') !== -1;
                var baseStyle = self.getBaseStyleObject(styleConfig);
                var textStyle = labelValue && self.getTextStyle(styleConfig);

                var resolvePlaceholders = self.getPlaceholderResolver_(styleConfig, placeholderProps, dataCallback);
                return function(feature) {
                    var styles = [baseStyle];
                    var resolvedStyle = resolvePlaceholders(styleConfig, feature);
                    if (dynBase) {
                        styles[0] = baseStyle.clone();
                        self.resolveColors_(styles[0], resolvedStyle);
                    }
                    if (labelValue) {
                        var labelStyle = new ol.style.Style();
                        if (dynText) {
                            labelStyle.setText(textStyle.clone());
                            self.resolveTextStyle_(labelStyle.getText(), resolvedStyle);
                        } else {
                            labelStyle.setText(textStyle);
                        }
                        styles.push(labelStyle);
                    }
                    return styles;
                };
            })(styleConfig);
        },
        /**
         * @return {ol.style.Style}
         */
        getDefaultStyleObject: function() {
            if (!this.defaultStyle_) {
                this.defaultStyle_ = ol.style.Style.defaultFunction()[0].clone();
                this.enforceArrayColor_(this.defaultStyle_);
            }
            return this.defaultStyle_.clone();
        },
        getDefaultTextStyle: function() {
            if (!this.defaultText_) {
                this.defaultText_ = new ol.style.Text();
                this.enforceArrayColor_(this.defaultText_);
                this.defaultText_.setOverflow(true);
            }
            return this.defaultText_.clone();
        },
        /**
         * @param {ol.style.Style} targetStyle
         * @param {Object} styleConfig
         * @private
         */
        resolveColors_: function(targetStyle, styleConfig) {
            if (styleConfig.fillColor || (typeof styleConfig.fillOpacity !== 'undefined')) {
                targetStyle.getFill().setColor(this.parseSvgColor(styleConfig, 'fillColor', 'fillOpacity', targetStyle.getFill().getColor()));
            }
            if (styleConfig.strokeColor || (typeof styleConfig.strokeOpacity !== 'undefined')) {
                targetStyle.getStroke().setColor(this.parseSvgColor(styleConfig, 'strokeColor', 'strokeOpacity', targetStyle.getStroke().getColor()));
            }
        },
        getBaseStyleObject: function(ol2Style) {
            var newStyle = this.getDefaultStyleObject();
            this.resolveColors_(newStyle, ol2Style);

             if (typeof ol2Style.strokeWidth !== 'undefined') {
                 newStyle.getStroke().setWidth(ol2Style.strokeWidth);
             }
             if (typeof ol2Style.strokeLinecap !== 'undefined') {
                 newStyle.getStroke().setLineCap(ol2Style.strokeLinecap);
             }
             newStyle.getStroke().setLineDash(this.dashRuleToComponents(ol2Style.strokeDashstyle));

            newStyle.setZIndex(ol2Style.graphicZIndex || 0);

            var image = new ol.style.Circle({
                fill: newStyle.getFill().clone(),
                stroke: newStyle.getStroke().clone(),
                radius: ol2Style.pointRadius || newStyle.getImage().getRadius()
            });

            newStyle.setImage(image);
            return newStyle;
        },
        getTextStyle: function (ol2Style) {
            var textStyle = this.getDefaultTextStyle();
            textStyle.setFont(this.canvasFontRuleFromSvg(ol2Style));
            this.resolveTextStyle_(textStyle, ol2Style);
            return textStyle;
        },
        /**
         * @param {ol.style.Text} targetStyle
         * @param {Object} styleConfig
         * @private
         */
        resolveTextStyle_: function(targetStyle, styleConfig) {
            targetStyle.setText(styleConfig.label);
            if (styleConfig.fontColor || (typeof styleConfig.fontOpacity !== 'undefined')) {
                targetStyle.getFill().setColor(this.parseSvgColor(styleConfig, 'fontColor', 'fontOpacity', targetStyle.getFill().getColor()));
            }
        },
        /**
         * @param {Object} style
         * @param {string} colorProp
         * @param {string} opacityProp
         * @param {Array<Number>} defaults
         * @return {Array<Number>}
         */
        parseSvgColor: function(style, colorProp, opacityProp, defaults) {
            // Unlinke Mapbender.StyleUtil.parseSvgColor, fill in missing properties using native OL6 defaults, instead of
            // OL2 SVG defaults
            var components = defaults.slice();
            if (style[colorProp]) {
                try {
                    components.splice.apply(components, [0, 3].concat(Mapbender.StyleUtil.parseCssColor(style[colorProp])));
                } catch (e) {
                    // ignore; keep defaults
                }
            }
            if (style[opacityProp] || style[opacityProp] === 0) {
                var opacity = parseFloat(style[opacityProp]);
                if (!isNaN(opacity)) {
                    components[3] = opacity;
                }
            }
            return components;
        },
        /**
         * @param {Object} style
         * @param {String} [style.fontFamily]
         * @param {Number} [style.fontSize]
         * @param {String} [style.fontWeight]
         * @return {string}
         */
        canvasFontRuleFromSvg: function(style) {
            var fontFamily = style.fontFamily || "sans-serif";
            var fontSize = style.fontSize && ([style.fontSize, 'px'].join('')) || '';
            var fontWeight = style.fontWeight || "";

            /** @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font */
            return [fontWeight, fontSize, fontFamily].join(" ");
        },
        /**
         * @param {String} dashStyle
         * @return {null|number[]}
         */
        dashRuleToComponents: function(dashStyle) {
            switch (dashStyle) {
                default:
                case 'solid':
                    return null;
                case 'dot':
                    return [1, 5];
                case 'dash':
                    return [10, 10];
                case 'longdash':
                    return [20, 20];
                case 'dashdot':
                    return [5, 10, 1];
                case 'longdashdot':
                    return [5, 20, 1];
            }
        },
        /**
         * @param {ol.style.Style|ol.style.Text} styleComponent
         */
        enforceArrayColor_: function(styleComponent) {
            // Enforce Array types for fill and stroke colors, to support amending missing props with array slices
            if (styleComponent.getStroke() && (typeof (styleComponent.getStroke().getColor()) === 'string')) {
                styleComponent.getStroke().setColor(Mapbender.StyleUtil.parseCssColor(styleComponent.getStroke().getColor()));
            }
            if (styleComponent.getFill() && (typeof (styleComponent.getFill().getColor()) === 'string')) {
                styleComponent.getFill().setColor(Mapbender.StyleUtil.parseCssColor(styleComponent.getFill().getColor()));
            }
        },
        /**
         * @param {Object} original
         * @param {Array<String>} propertyNames
         * @param {function} dataCallback
         * @return {function}
         * @private
         */
        getPlaceholderResolver_: function(original, propertyNames, dataCallback) {
            if (propertyNames.length) {
                var placeholderRx = this.placeholderRx_;
                return function(styleConfig, feature) {
                    var valuesOut = Object.assign({}, styleConfig);
                    var data = dataCallback(feature);
                    propertyNames.forEach(function(prop) {
                        var resolved = styleConfig[prop].replace(placeholderRx, function(match, dataProp) {
                            return data[dataProp];
                        });
                        if (resolved) {
                            valuesOut[prop] = resolved;
                        }
                    });
                    return valuesOut;
                }
            } else {
                return function(original) {
                    return original;
                }
            }
        },

        __dummy: null
    };
})();
