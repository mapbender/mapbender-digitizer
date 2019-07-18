(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {

        STYLE : {

            CHANGED: new ol.style.Style({

                fill: new ol.style.Fill({
                    color:  [255,209,79,0.5],//'rgba(255,209,79,0.5)',
                }),
                stroke: new ol.style.Stroke({
                    width: 3,
                    color: 'rgba(244,83,36)'
                }),
            }),
        },



        isAddingToolsetType: function(toolsetType) {

            return ['drawPoint','drawLine','drawPolygon','drawRectangle','drawCircle','drawEllipse'].includes(toolsetType);
        },

        getDefaultToolsetByGeomType: function(geomType) {

            var toolset = null;

            switch(geomType) {
                case 'point':
                    toolset = ['drawPoint','moveFeature'];
                    break;
                case 'line':
                    toolset = ['drawLine','modifyFeature','moveFeature'];
                    break;
                case 'polygon':
                    toolset = ['drawPolygon','drawRectangle','drawCircle','drawEllipse','drawDonut','modifyFeature','moveFeature'];
            }

            if (!toolset) {
                console.error("No valid geom type",geomType)
            }
            return toolset.map(function(type) { return { 'type' : type }});


        },

        getAssetsPath: function(path) {
            return Mapbender.configuration.application.urls.asset + (path || '');
        }


    }








    ol.style.StyleConverter = function() {
        this.defaultStyle = ol.style.Style.defaultFunction()[0];
    };

    ol.style.StyleConverter.prototype.convert = function(style) {

        var newStyle = new ol.style.Style();

        var stroke = new ol.style.Stroke();

        var hexToRgb = ol.style.StyleConverter.hexToRgb;

        stroke.setWidth(style.strokeWidth );
        stroke.setColor(hexToRgb(style.strokeColor));

        var fill = new ol.style.Fill();

        var color = ol.style.StyleConverter.hexToRgb(style.fillColor,style.fillOpacity);
        fill.setColor(color);


        //
        // var circle = new ol.style.Circle({
        //     fill: fill,
        //     stroke: stroke
        // });
        //
        // circle.setRadius(style.pointRadius);


        newStyle.setStroke(stroke);
        newStyle.setFill(fill);
       // newStyle.setImage(circle);

        return [newStyle];

    };

    ol.style.StyleConverter.hexToRgb = function(hex, opacity) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        if (!result) {
            return null;
        }
        var array = [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
        ];

        if (opacity) {
            return array.concat([opacity]);
        } else {
            return array;
        }

    }

//  default:
//       strokeWidth: 2
//       strokeColor: '#0e6a9e'
//       fillColor: '#ff0000'
//       fillOpacity: 1
//       fillWidth: 2
//       pointRadius: 10
//     select:
//       strokeWidth: 3
//       strokeColor: '#0e6a9e'
//       fillOpacity: 0.7
//       pointRadius: 10

})();
