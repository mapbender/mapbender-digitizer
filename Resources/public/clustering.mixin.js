(function() {
    "use strict";

    Mapbender.Digitizer.ClusteringSchemeMixin = function () { // Function instead of static object to guarantee uniqueness

        return {


            initializeClustering: function () {
                var schema = this;

                var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
                var strategies = [clusterStrategy];
                schema.layer.strategies = strategies;
                clusterStrategy.layer = schema.layer;
                schema.clusterStrategy = clusterStrategy;

                schema.updateClusterStrategy();
            },


            updateClusterStrategy: function () {

                var schema = this;
                var clusterSettings = null, closestClusterSettings = null;
                var widget = schema.widget;
                var scale = Math.round(widget.map.getScale());

                $.each(schema.clustering, function (y, _clusterSettings) {
                    if (_clusterSettings.scale === scale) {
                        clusterSettings = _clusterSettings;
                        return false;
                    }

                    if (_clusterSettings.scale < scale) {
                        if (closestClusterSettings && _clusterSettings.scale > closestClusterSettings.scale) {
                            closestClusterSettings = _clusterSettings;
                        } else {
                            closestClusterSettings =  closestClusterSettings || _clusterSettings
                        }
                    }
                });

                clusterSettings = clusterSettings || closestClusterSettings;

                if (clusterSettings) {

                    if (clusterSettings.hasOwnProperty('disable') && clusterSettings.disable) {
                        schema.clusterStrategy.distance = -1;
                        schema.reloadFeatures();
                        schema.clusterStrategy.deactivate();
                        schema.isClustered = false;
                        schema.reloadFeatures();

                    } else {
                        schema.clusterStrategy.activate();
                        schema.isClustered = true;
                    }

                    if (clusterSettings.hasOwnProperty('distance')) {
                        schema.clusterStrategy.distance = clusterSettings.distance;
                    }

                }
            },


            getData: function (zoom) {
                var schema = this;
                return Mapbender.Digitizer.Scheme.prototype.getData.apply(schema,[ function() {
                    if (zoom) {
                        schema.updateClusterStrategy();
                    }
                }]);
            },

            getFeatureAsList: function (feature) {
                return feature.cluster || [feature];
            },

            processFeature: function (feature, callback) {
                var schema = this;
                var features = schema.getFeatureAsList(feature);
                _.each(features, function (feature) {
                    callback(feature);
                });
            },

            // TODO this is weird. if this function is applied, only cluster features get loaded
            // getLayerFeatures: function() {
            //     var schema = this;
            //     var layer = schema.layer;
            //
            //     return layer.features.filter(function(feature) { return !!feature.cluster; });
            // },

            openFeatureEditDialog: function (feature) {
                var schema = this;
                return Mapbender.Digitizer.Scheme.prototype.openFeatureEditDialog.apply(schema, [schema.getFeatureAsList(feature)[0]]);
            },


        }

    };

})();

