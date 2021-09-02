(function () {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.StyleAdapter = function(defaultStyleConfig) {
        this.defaultStyle_ = ol.style.Style.defaultFunction()[0].clone();
        this.enforceArrayColor_(this.defaultStyle_);

        var placeholderProps = this.detectDataPlaceholders_(defaultStyleConfig);
        if (placeholderProps.length) {
            throw new Error("Fallback style MUST NOT include data placeholders. Found: " + placeholderProps.join(', '));
        }
        this.resolveBaseStyle_(this.defaultStyle_, defaultStyleConfig);

        this.defaultText_ = new ol.style.Text();
        this.enforceArrayColor_(this.defaultText_);
        this.defaultText_.setOverflow(true);
    };

    Object.assign(Mapbender.Digitizer.StyleAdapter.prototype, {
        defaultStyle_: null,
        defaultText_: null,
        placeholderRx_: /\${([^}]+)}/g,
        styleFunctionFromSvgRules: function(styleConfig, dataCallback) {
            var self = this;
            var placeholderCandidates = ['fillColor', 'strokeColor', 'label', 'fontColor', 'externalGraphic'];
            return (function(styleConfig) {
                var placeholderProps = self.detectDataPlaceholders_(styleConfig, placeholderCandidates);
                var labelValue = styleConfig.label;
                var dynText = labelValue && (placeholderProps.indexOf('label') !== -1 || placeholderProps.indexOf('fontColor') !== -1);
                var dynBase = placeholderProps.indexOf('fillColor') !== -1 || placeholderProps.indexOf('strokeColor') !== -1;
                var baseStyle = self.getBaseStyleObject(styleConfig);
                var textStyle = labelValue && self.getTextStyle(styleConfig);
                var useIcon = styleConfig.externalGraphic && styleConfig.graphic !== false;
                var dynIcon = useIcon && -1 !== placeholderProps.indexOf('externalGraphic');
                var iconStyle = useIcon && !dynIcon && self.expandIconStyle_(self.getIconStyle(styleConfig));

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
                    if (dynIcon) {
                        if (resolvedStyle.externalGraphic) {
                            iconStyle = self.expandIconStyle_(self.getIconStyle(resolvedStyle), resolvedStyle);
                        } else {
                            iconStyle = null;
                        }
                    }
                    if (iconStyle) {
                        styles.push(iconStyle);
                    }
                    return styles;
                };
            })(styleConfig);
        },
        /**
         * @return {ol.style.Style}
         */
        getDefaultStyleObject: function() {
            return this.defaultStyle_.clone();
        },
        getDefaultTextStyle: function() {
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
        resolveBaseStyle_: function(targetStyle, styleConfig) {
            this.resolveColors_(targetStyle, styleConfig);
            if (typeof styleConfig.strokeWidth !== 'undefined') {
                targetStyle.getStroke().setWidth(styleConfig.strokeWidth);
            }
            if (typeof styleConfig.strokeLinecap !== 'undefined') {
                targetStyle.getStroke().setLineCap(styleConfig.strokeLinecap);
            }
            targetStyle.getStroke().setLineDash(this.dashRuleToComponents(styleConfig.strokeDashstyle));
        },
        getBaseStyleObject: function(ol2Style) {
            var newStyle = this.getDefaultStyleObject();
            this.resolveBaseStyle_(newStyle, ol2Style);

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
        getIconStyle: function(styleConfig) {
            var iconStyle = new ol.style.Icon({
                src: styleConfig.externalGraphic
            });
            if (styleConfig.graphicWidth || styleConfig.graphicHeight) {
                var onload = this.getIconScaleHandler_(iconStyle, styleConfig);
                // see https://github.com/openlayers/openlayers/blob/main/src/ol/ImageState.js
                if (iconStyle.getImageState() === 2) {
                    // already loaded
                    onload();
                } else {
                    iconStyle.listenImageChange(onload);
                }
            }
            return iconStyle;
        },
        getIconScaleHandler_: function(iconStyle, styleConfig) {
            return (function(styleConfig) {
                return function() {
                    /** @this ol.style.Image */
                    if (this.getImageState() === 2) {
                        // Now loaded
                        // see https://github.com/openlayers/openlayers/blob/main/src/ol/ImageState.js
                        var naturalSize = this.getImageSize();
                        var scale;
                        if (!styleConfig.graphicHeight) {
                            scale = styleConfig.graphicWidth / naturalSize[0];
                        } else if (!styleConfig.graphicWidth) {
                            scale = styleConfig.graphicHeight / naturalSize[1];
                        } else {
                            scale = [styleConfig.graphicWidth / naturalSize[0], styleConfig.graphicHeight / naturalSize[1]];
                        }
                        this.setScale(scale);
                    }
                }.bind(iconStyle);
            }(styleConfig));
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
                    var rgb = Mapbender.StyleUtil.parseCssColor(style[colorProp]).slice(0, 3);
                    components.splice.apply(components, [0, 3].concat(rgb));
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
                    return [3, 10];
                case 'dash':
                    return [12, 12];
                case 'longdash':
                    return [20, 12];
                case 'dashdot':
                    return [12, 12, 3, 7];
                case 'longdashdot':
                    return [20, 12, 3, 7];
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
         *
         * @param {Object} data
         * @param {Array<String>} [candidates] to limit scanning to specifically named properties (default: scan all properties)
         * @return {Array<String>}
         * @private
         */
        detectDataPlaceholders_: function(data, candidates) {
            var placeholderRx = this.placeholderRx_;
            return (candidates || Object.keys(data)).filter(function(prop) {
                // Reset global-flagged RegExp state.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test#using_test_on_a_regex_with_the_global_flag
                placeholderRx.lastIndex = 0;
                return placeholderRx.test(data[prop] || '');
            });
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
                            if (!data[dataProp] && prop === 'externalGraphic') {
                                // Empty entire output value (incomplete url expansion)
                                valuesOut[prop] = data[dataProp];
                            }
                            return data[dataProp];
                        });
                        if (resolved && valuesOut[prop]) {
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
        resolvePlaceholders: function(styleConfig, featureData) {
            var placeholderProps = this.detectDataPlaceholders_(styleConfig);
            var resolver = this.getPlaceholderResolver_(styleConfig, placeholderProps, function() {
                return featureData;
            });
            return resolver(styleConfig);
        },
        /**
         * @param {ol.style.Image} iconStyle
         * @param {Object} styleConfig
         * @return {ol.style.Style}
         * @private
         */
        expandIconStyle_: function(iconStyle, styleConfig) {
            return new ol.style.Style({
                // Icons are only rendered on point geometries.
                // => We must use a geometry function to make points out of
                // polygons and lines.
                // @see https://gis.stackexchange.com/questions/361817/openlayers-displaying-polygon-with-icon-style
                geometry: this.iconStyleGeometryFunction_,
                image: iconStyle
            });
        },
        iconStyleGeometryFunction_: function(feature) {
            var geometry = feature.getGeometry();
            switch (geometry && geometry.getType()) {
                case 'Polygon':
                    return geometry.getInteriorPoint();
                case 'MultiPolygon':
                    return geometry.getInteriorPoints();
                case 'LineString':
                    return new ol.geom.Point(geometry.getFlatMidpoint(), geometry.getLayout());
                case 'MultiLineString':
                    return new ol.geom.MultiPoint(geometry.getFlatMidpoints(), geometry.getLayout());
                default:
                    return geometry;
            }
        },
        __dummy: null
    });
})();
