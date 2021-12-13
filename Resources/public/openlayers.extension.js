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
    });

})();
