(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {

        deepFreeze: function (o) {
            Object.freeze(o);
            if (o === undefined) {
                return o;
            }

            Object.getOwnPropertyNames(o).forEach(function (prop) {
                if (o[prop] !== null
                    && (typeof o[prop] === "object" || typeof o[prop] === "function")
                    && !Object.isFrozen(o[prop])) {
                    Mapbender.Digitizer.Utilities.deepFreeze(o[prop]);
                }
            });

            return o;
        },

        getDefaultToolsetByGeomType: function (geomType) {

            var toolset = null;

            switch (geomType) {
                case 'point':
                    toolset = ['drawPoint', 'moveFeature'];
                    break;
                case 'line':
                    toolset = ['drawLine', 'modifyFeature', 'moveFeature'];
                    break;
                case 'polygon':
                    toolset = ['drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut', 'modifyFeature', 'moveFeature'];
            }

            if (!toolset) {
                console.error("No valid geom type", geomType)
            }
            return toolset.map(function (type) {
                return {'type': type}
            });


        },

        getAssetsPath: function (path) {
            return Mapbender.configuration.application.urls.asset + (path || '');
        },

        scaleToResolution: function (scale) {
            $.notify("minscale / maxscale is not implemented yet");
            return scale;
        }


    };

    ol.format.GeoJSONWithSeperateData = function () {
        ol.format.GeoJSON.apply(this, arguments);
    };

    ol.inherits(ol.format.GeoJSONWithSeperateData, ol.format.GeoJSON);

    ol.format.GeoJSONWithSeperateData.prototype.readFeatureFromObject = function (object, opt_options) {
        var feature = ol.format.GeoJSON.prototype.readFeatureFromObject.apply(this, arguments);
        /**
         * @type {GeoJSONFeature}
         */
        var geoJSONFeature = null;
        if (object.type === 'Feature') {
            geoJSONFeature = /** @type {GeoJSONFeature} */ (object);
        } else {
            geoJSONFeature = /** @type {GeoJSONFeature} */ ({
                type: 'Feature',
                geometry: /** @type {GeoJSONGeometry|GeoJSONGeometryCollection} */ (object)
            });
        }

        var geometry = ol.format.GeoJSON.readGeometry_(geoJSONFeature.geometry, opt_options);
        var feature = new ol.Feature();
        if (this.geometryName_) {
            feature.setGeometryName(this.geometryName_);
        } else if (this.extractGeometryName_ && geoJSONFeature.geometry_name !== undefined) {
            feature.setGeometryName(geoJSONFeature.geometry_name);
        }
        feature.setGeometry(geometry);
        if (geoJSONFeature.id !== undefined) {
            feature.setId(geoJSONFeature.id);
        }

        var props = geoJSONFeature.properties;

        if (props) {

            props.get = function (key) {
                return this[key]
            };
            props.set = function (key, value) {
                this[key] = value;
            };


            feature.setProperties({
                data: props
            });
        }
        return feature;

    };

    ol.style.StyleConverter = ol.style.StyleConverter || {};

    ol.style.StyleConverter.convertToOL4Style = function (ol2Style) {

        var newStyle = ol.style.Style.defaultFunction()[0].clone();

        /* creates 4 element array with color and opacity */
        var calculateColor = function (color, opacity, originalColor) {
            var newColor = ol.color.asArray(color !== undefined ? color : originalColor).slice(); // it is necessary to clone via slice to prevent unpredictable behaviour
            newColor[3] = opacity !== undefined ? opacity : newColor[3];
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

           var str = [fontSize,fontWeight,fontFamily].join(" ");
           return str;
        };

        newStyle.getStroke().setColor(calculateColor(ol2Style.strokeColor, ol2Style.strokeOpacity, newStyle.getStroke().getColor()));
        newStyle.getStroke().setWidth(ol2Style.strokeWidth || newStyle.getStroke().getWidth());
        newStyle.getStroke().setLineCap(ol2Style.strokeLinecap || newStyle.getStroke().getLineCap());
        newStyle.getStroke().setLineDash(convertDashStyle(ol2Style.strokeDashstyle) || newStyle.getStroke().getLineDash());

        newStyle.getFill().setColor(calculateColor(ol2Style.fillColor, ol2Style.fillOpacity, newStyle.getFill().getColor()));

        if (ol2Style.label) {

            newStyle.setText(new ol.style.Text({
                text: ol2Style.label || newStyle.getText().getText(),
                font: getFontStyleString(ol2Style),
                overflow: true,
            }));

          newStyle.getText().getFill().setColor(calculateColor(ol2Style.fontColor, ol2Style.fontOpacity, newStyle.getText().getFill().getColor()));
        }


        var image = new ol.style.Circle({
            fill: newStyle.getFill().clone(),
            stroke: newStyle.getStroke().clone(),
            radius: ol2Style.pointRadius || newStyle.getImage().getRadius()
        });

        newStyle.setImage(image);

        Object.freeze(newStyle);

        return newStyle;

    };


})();
