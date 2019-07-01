(function () {
    "use strict";


    $(document).ready(function () {
        ol.Feature.prototype.equals = function (feature) {
            return this.fid === feature.fid;
        };
        ol.Feature.prototype.isNew = false;
        ol.Feature.prototype.isChanged = false;
        ol.Feature.prototype.isCopy = false;
        ol.Feature.prototype.disabled = false;
        ol.Feature.prototype.visible = true;
        ol.Feature.prototype.cluster = false;
        ol.Feature.prototype.getClusterSize = function () {
            return this.cluster ? this.cluster.length : null;
        };



        ol.Feature.prototype.toggleVisibility = function(visible) {
            var feature = this;
            feature.visible = visible;
        };


    });

})();
