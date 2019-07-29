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



    // fillColor: "#ee9900",
    //     fillOpacity: 0.4,
    //     hoverFillColor: "white",
    //     hoverFillOpacity: 0.8,
    //     strokeColor: "#ee9900",
    //     strokeOpacity: 1,
    //     strokeWidth: 1,
    //     strokeLinecap: "round",
    //     strokeDashstyle: "solid",
    //     hoverStrokeColor: "red",
    //     hoverStrokeOpacity: 1,
    //     hoverStrokeWidth: 0.2,
    //     pointRadius: 6,
    //     hoverPointRadius: 1,
    //     hoverPointUnit: "%",
    //     pointerEvents: "visiblePainted",
    //     cursor: "inherit",
    //     fontColor: "#000000",
    //     labelAlign: "cm",
    //     labelOutlineColor: "white",
    //     labelOutlineWidth: 3




    ol.style.StyleConverter = function() {
    };

    ol.style.StyleConverter.prototype.convert = function(style) {

        var newStyle = ol.style.Style.defaultFunction()[0];

        // creates 4 element array with color and opacity
        function calculateColor(color,opacity,originalColor) {
            var newColor = ol.color.asArray(color !== undefined ? color : originalColor);
            newColor[3] = opacity !== undefined ? opacity : newColor[3];

            return newColor;
        }

        newStyle.getStroke().setColor(calculateColor(style.strokeColor,style.strokeOpacity, newStyle.getStroke().getColor()));
        newStyle.getStroke().setWidth(style.strokeWidth || newStyle.getStroke().getWidth());
        newStyle.getStroke().setLineCap(style.strokeLinecap || newStyle.getStroke().getLineCap());
        newStyle.getStroke().setLineDash(style.strokeDashstyle || newStyle.getStroke().getLineDash());

        newStyle.getFill().setColor(calculateColor(style.fillColor,style.fillOpacity,newStyle.getFill().getColor()));


       //
       //  stroke.setColor(hexToRgb(style.strokeColor));
       //
       //  var fill = new ol.style.Fill();
       //
       //  var color = ol.style.StyleConverter.hexToRgb(style.fillColor,style.fillOpacity);
       //  fill.setColor(color);
       //
       //
       //  //
       //  // var circle = new ol.style.Circle({
       //  //     fill: fill,
       //  //     stroke: stroke
       //  // });
       //  //
       //  // circle.setRadius(style.pointRadius);
       //
       //
       //  newStyle.setStroke(stroke);
       //  newStyle.setFill(fill);
       // // newStyle.setImage(circle);



        return newStyle;

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
