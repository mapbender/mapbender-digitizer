(function ($) {
    "use strict";

    Mapbender.layerManager = new function () {
        var layerManager = this;

        /**
         * Refresh layer. Only if visible.
         *
         * @see http://osgeo-org.1560.x6.nabble.com/layer-WMS-don-t-redraw-td5086852.html
         * @see http://dev.openlayers.org/apidocs/files/OpenLayers/Layer-js.html#OpenLayers.Layer.redraw
         * @see https://gis.stackexchange.com/questions/36741/how-to-update-a-vector-layer-with-wfs-protocol-after-updating-the-filter
         * @param {(OpenLayers.Layer | OpenLayers.Layer.Vector)} layer
         * @return {OpenLayers.Layer}
         */
        layerManager.refreshLayer = function (layer) {
            // @todo: NONE of this works with Openlayers > 2
            if (!layer.getVisibility()) {
                return layer;
            }

            layer.setVisibility(false);
            layer.setVisibility(true);

            if (layer.redraw) {
                layer.redraw(true);
            }

            if (layer.refresh) {
                layer.refresh({force: true});
            }
            return layer;
        };
    };


})(jQuery);
