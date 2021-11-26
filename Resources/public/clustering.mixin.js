(function() {
    "use strict";

    Mapbender.Digitizer.ClusteringSchemeMixin = function () { // Function instead of static object to guarantee uniqueness

        return {

            clusteringLabel: true,


            getExtendedStyle: function(label) {
                var schema = this;
                var style = schema.styles[label] || {};
                if (schema.clusteringLabel) {
                    style.label = '${label}';
                }
                return style;
            },

            getStyleLabel: function(feature) {
                var schema = this;
                var parentMethod = Mapbender.Digitizer.Scheme.prototype.getStyleLabel.bind(schema);
                var clusterSize = feature.getClusterSize();
                return clusterSize > 1 ? clusterSize : parentMethod(clusterSize === 1 ? feature.cluster[0] : feature);
            },

            initializeClustering: function () {
                var schema = this;

                var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
                var strategies = [clusterStrategy];
                schema.layer.strategies = strategies;
                clusterStrategy.layer = schema.layer;
                schema.clusterStrategy = clusterStrategy;

                schema.updateClusterStrategy();


            },

            getClusterSettingByScale: function(scale) {
                var schema = this;
                var hits = schema.clustering.filter(function(clusterSetting) {
                    return clusterSetting.scale <= scale;
                }).sort(function(a,b){
                    return b.scale - a.scale;
                });
                return hits[0];
            },


            updateClusterStrategy: function () {

                var schema = this;
                var widget = schema.widget;
                var scale = Math.round(widget.map.getScale());

                var clusterSetting =  schema.getClusterSettingByScale(scale);

                if (clusterSetting) {

                    if (clusterSetting.disable) {
                        schema.clusterStrategy.distance = -1;
                        schema.clusterStrategy.deactivate();
                        schema.reloadFeatures();
                    } else {
                        schema.clusterStrategy.activate();
                    }

                    if (clusterSetting.distance) {
                        schema.clusterStrategy.distance = clusterSetting.distance;
                    }

                }
            },


            getData: function (options) {
                var schema = this;
                return Mapbender.Digitizer.Scheme.prototype.getData.apply(schema,[ { callback: function() {
                    if (options && options.zoom) {
                        schema.updateClusterStrategy();
                    }
                }}]);
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

            openFeatureEditDialog: function (feature) {
                var schema = this;
                return Mapbender.Digitizer.Scheme.prototype.openFeatureEditDialog.apply(schema, [schema.getFeatureAsList(feature)[0]]);
            },


        }

    };

})();

