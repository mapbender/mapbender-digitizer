(function () {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.StyleAdapter = {
        defaultStyle_: null,
        defaultText_: null,
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
        getBaseStyleObject: function(ol2Style) {
            var newStyle = this.getDefaultStyleObject();

            if (ol2Style.fillColor || (typeof ol2Style.fillOpacity !== 'undefined')) {
                newStyle.getFill().setColor(this.parseSvgColor(ol2Style, 'fillColor', 'fillOpacity', newStyle.getFill().getColor()));
            }
            if (ol2Style.strokeColor || (typeof ol2Style.strokeOpacity !== 'undefined')) {
                newStyle.getStroke().setColor(this.parseSvgColor(ol2Style, 'strokeColor', 'strokeOpacity', newStyle.getStroke().getColor()));
            }

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
        fromSvgRules: function(ol2Style) {
            var newStyle = this.getBaseStyleObject(ol2Style);

            if (ol2Style.label) {
                newStyle.setText(this.getTextStyle_(ol2Style));
            }
            return newStyle;
        },
        getTextStyle_: function (ol2Style) {
            var textStyle = this.getDefaultTextStyle();
            textStyle.setFont(this.canvasFontRuleFromSvg(ol2Style));
            textStyle.setText(ol2Style.label);
            if (ol2Style.fontColor || (typeof ol2Style.fontOpacity !== 'undefined')) {
                textStyle.getFill().setColor(this.parseSvgColor(ol2Style, 'fontColor', 'fontOpacity', textStyle.getFill().getColor()));
            }
            return textStyle;
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
