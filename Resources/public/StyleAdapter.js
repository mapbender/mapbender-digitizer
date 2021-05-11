(function () {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.StyleAdapter = {
        fromSvgRules: function(ol2Style) {
            var newStyle = ol.style.Style.defaultFunction()[0].clone();

            /* creates 4 element array with color and opacity */
            var calculateColor = function (color, opacity) {
                var newColor;
                if (typeof color === 'string') {
                    newColor = Mapbender.StyleUtil.parseCssColor(color);
                } else {
                    newColor = color.slice();
                }
                newColor = newColor.slice(0, 3);
                if (typeof opacity === 'undefined') {
                    newColor.push(1.0);
                } else {
                    newColor.push(opacity);
                }
                return newColor;
            };

            var convertDashStyle = function (dashStyle) {
                switch (dashStyle) {
                    case 'solid' :
                        return [];
                    case 'dot'   :
                        return [1, 5];
                    case 'dash'      :
                        return [10, 10];
                    case 'longdash'      :
                        return [20, 20];
                    case 'dashdot'      :
                        return [5, 10, 1];
                    case 'longdashdot'      :
                        return [5, 20, 1];
                }
            };

            var getFontStyleString = function(style) {
               var fontFamily = style.fontFamily || "sans-serif";
               var fontSize = style.fontSize ? style.fontSize+"px" : "";
               var fontWeight = style.fontWeight || "";

               /** @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font */
               var str = [fontWeight,fontSize,fontFamily].join(" ");
               return str;
            };
            if (ol2Style.strokeColor || (typeof ol2Style.strokeOpacity !== 'undefined')) {
                var strokeColor = calculateColor(ol2Style.strokeColor || newStyle.getStroke().getColor(), ol2Style.strokeOpacity);
                newStyle.getStroke().setColor(strokeColor);
            }

             if (typeof ol2Style.strokeWidth !== 'undefined') {
                 newStyle.getStroke().setWidth(ol2Style.strokeWidth);
             }
             if (typeof ol2Style.strokeLinecap !== 'undefined') {
                 newStyle.getStroke().setLineCap(ol2Style.strokeLinecap);
             }
             if (typeof ol2Style.strokeDashstyle !== 'undefined') {
                 newStyle.getStroke().setLineDash(convertDashStyle(ol2Style.strokeDashstyle));
             }

            if (ol2Style.fillColor || (typeof ol2Style.fillColor !== 'undefined')) {
                var fillColor =calculateColor(ol2Style.fillColor || newStyle.getFill().getColor(), ol2Style.fillOpacity);
                newStyle.getFill().setColor(fillColor);
            }

            if (ol2Style.label) {
                newStyle.setText(new ol.style.Text({
                    text: ol2Style.label,
                    font: getFontStyleString(ol2Style),
                    overflow: true
                }));

              newStyle.getText().getFill().setColor(calculateColor(ol2Style.fontColor, ol2Style.fontOpacity));
            }

            newStyle.setZIndex(ol2Style.graphicZIndex || 0);

            var image = new ol.style.Circle({
                fill: newStyle.getFill().clone(),
                stroke: newStyle.getStroke().clone(),
                radius: ol2Style.pointRadius || newStyle.getImage().getRadius()
            });

            newStyle.setImage(image);

            return newStyle;
        }
    };
})();
