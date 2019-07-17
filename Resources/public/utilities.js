(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {

        STYLE : {

            CHANGED: new ol.style.Style({

                fill: new ol.style.Fill({
                    color:  'rgba(255,209,79,0.5)',
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

})();
