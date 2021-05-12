(function () {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.StyleAdapter = {
        defaultStyle_: null,
        defaultText_: null,
        placeholderPattern_: /\${([^}]+)}/g,
        styleFunctionFromSvgRules: function(styleConfig, dataCallback) {
            var self = this;
            var labelPattern = this.placeholderPattern_;
            return (function() {
                var baseStyle = self.getBaseStyleObject(styleConfig);
                var labelValue = styleConfig.label;
                var textStyle = labelValue && self.getTextStyle(styleConfig);
                return function(feature) {
                    var styles = [baseStyle];
                    if (labelValue) {
                        var labelStyle = new ol.style.Style();
                        if (labelPattern.test(labelValue || '')) {
                            var attributes = dataCallback(feature) || {};
                            var label = labelValue.replace(labelPattern, function(match, attributeName) {
                                return attributes[attributeName] || '';
                            });
                            labelStyle.setText(textStyle.clone());
                            labelStyle.getText().setText(label);
                        } else {
                            textStyle.setText(labelValue);
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
         * @param {Array<Number>} [defaults]
         * @return {Array<Number>}
         */
        parseSvgColor: function(style, colorProp, opacityProp, defaults) {
            var color = Mapbender.StyleUtil.parseSvgColor(style, colorProp, opacityProp);
            // Unlinke Mapbender.StyleUtil, fill in missing properties using native OL6 defaults, instead of
            // OL2 SVG defaults
            if (!style[colorProp] && defaults) {
                Array.prototype.splice.apply(color, [0, 3].concat(defaults.slice(0, 3)));
            }
            if (!style[opacityProp] && defaults) {
                color.splice(3, 1, defaults[3]);
            }
            return color;
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
        }
    };
})();
