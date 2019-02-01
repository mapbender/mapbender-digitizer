(function ($) {
    "use strict";

    Mapbender.layerManager = new function () {
        var layerManager = this;
        /**
         * @define {OpenLayers.Map}
         */
        var olMap;

        /**
         * Set map object to handle with
         *
         * @param {OpenLayers.Map} map
         */
        layerManager.setMap = function (map) {
            olMap = map;
            return layerManager;
        };

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

        /**
         * Get layers by layer instance ID
         *
         * @param {number|string} _layerInstanceId
         * @return {Array<OpenLayers.Layer>}
         */
        layerManager.getLayersByInstanceId = function (_layerInstanceId) {
            var layers = [];
            _.each(Mapbender.configuration.layersets, function (layerSet) {
                _.each(layerSet, function (layerCollection) {
                    _.each(layerCollection, function (layerInstanceInfo) {
                        var layerInstanceId = layerInstanceInfo.origId;
                        var layerId = layerInstanceInfo.ollid;
                        if (layerInstanceId == _layerInstanceId) {
                            var items = _.where(olMap.layers, {id: layerId});
                            layers = layers.concat(items);
                        }
                    });
                })
            });
            return layers;
        }
    };


})(jQuery);
