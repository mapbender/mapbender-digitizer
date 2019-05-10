(function () {
    "use strict";


    $(document).ready(function () {
        OpenLayers.Feature.prototype.equals = function (feature) {
            return this.fid === feature.fid;
        };
        OpenLayers.Feature.prototype.isNew = false;
        OpenLayers.Feature.prototype.isChanged = false;
        OpenLayers.Feature.prototype.isCopy = false;
        OpenLayers.Feature.prototype.disabled = false;
        OpenLayers.Feature.prototype.visible = true;
        OpenLayers.Feature.prototype.cluster = false;
        OpenLayers.Feature.prototype.getClusterSize = function () {
            return this.cluster ? this.cluster.length : null;
        };


        // Prevent adding of clustering features themselves to cluster
        var addToCluster = OpenLayers.Strategy.Cluster.prototype.addToCluster;
        OpenLayers.Strategy.Cluster.prototype.addToCluster = function(cluster, feature) {
           if (!feature.fid) {
               return;
           }
           addToCluster.apply(this,[cluster,feature]);
        };


    });

})();