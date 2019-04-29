(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {


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
                console.warn("No valid geom type",geomType)
            }
            return toolset.map(function(type) { return { 'type' : type }});


        }
    }

})();