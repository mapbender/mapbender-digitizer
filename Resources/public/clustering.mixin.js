var schemaClustering = {


    updateClusterStrategy: function () {
        var schema = this;
        var clusterSettings = null, closestClusterSettings = null;
        var widget = schema.widget;
        var scale = Math.round(widget.map.getScale());

        $.each(schema.clustering, function (y, _clusterSettings) {
            if (_clusterSettings.scale == scale) {
                clusterSettings = _clusterSettings;
                return false;
            }

            if (_clusterSettings.scale < scale) {
                if (closestClusterSettings && _clusterSettings.scale > closestClusterSettings.scale) {
                    closestClusterSettings = _clusterSettings;
                } else {
                    if (!closestClusterSettings) {
                        closestClusterSettings = _clusterSettings;
                    }
                }
            }
        });

        if (!clusterSettings && closestClusterSettings) {
            clusterSettings = closestClusterSettings
        }

        if (clusterSettings) {

            if (clusterSettings.hasOwnProperty('disable') && clusterSettings.disable) {
                schema.clusterStrategy.distance = -1;
                var features = schema.layer.features;
                schema.reloadFeatures([]);
                schema.clusterStrategy.deactivate();
                //schema.layer.redraw();
                schema.isClustered = false;
                schema.reloadFeatures(features);

            } else {
                schema.clusterStrategy.activate();
                schema.isClustered = true;
            }
            if (clusterSettings.hasOwnProperty('distance')) {
                schema.clusterStrategy.distance = clusterSettings.distance;
            }

        } else {
            //schema.clusterStrategy.deactivate();
        }
    },


    getData: function(zoom) {
        var schema = this;
        Scheme.prototype.getData();
        // TODO  Das ist ziemlich sicher falsch, da das Updaten der Cluster Strategy im Callback von GetData erfolgen muss
        if (zoom) {
            schema.updateClusterStrategies();
        };

    }
};
