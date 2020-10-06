(function () {
    "use strict";

    Mapbender.Digitizer = function ($element, options) {
        var widget  = this;

        $.extend(widget, options);
    };

    Mapbender.Digitizer.prototype.isInExtent = function(feature) {
        var widget = this;
        return ol.extent.intersects(widget.map.getView().calculateExtent(), feature.getGeometry().getExtent());
    };

})();
