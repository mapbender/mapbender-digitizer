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



    };

    var RBushUpdateOrig = ol.structs.RBush.prototype.update;

    ol.structs.RBush.prototype.update = function () {
        try {
            RBushUpdateOrig.apply(this, arguments);
        } catch (e) {
        }
    };



})();
