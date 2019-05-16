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


        OpenLayers.Feature.prototype.setRenderIntent = function () {
            var feature = this;

            feature.renderIntent = "default";

            if (feature.isChanged || feature.isNew) {
                feature.renderIntent = 'unsaved';
            }

            if (feature.isCopy) {
                feature.renderIntent = 'copy';
            }

            if (!feature.visible) {
                feature.renderIntent = 'invisible';
            }


        };

        OpenLayers.Feature.prototype.toggleVisibility = function(visible) {
            var feature = this;
            if (!visible && feature.visible) { //Switch off
                feature.deactivatedStyle = feature.style;
                feature.style = null;
            } else
            if (visible && !feature.visible) {  //Switch on
                feature.style = feature.deactivatedStyle;
                feature.deactivatedStyle = null;
            }

            feature.visible = visible;

        };


    });

})();