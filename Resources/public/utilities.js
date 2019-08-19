(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {

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



})();
