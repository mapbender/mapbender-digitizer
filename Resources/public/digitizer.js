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

    // @todo: salvage this
    //        Modifying Digitizer A should NOT call into other Digitizer code
    //        Other Digitizer should REACT to a change event
    //        For this to work, the event must be listenable (=triggered on DOM, not on completely internal objects)
    Mapbender.Digitizer.prototype.refreshConnectedDigitizerFeatures = function(schemaName){
        $(".mb-element-digitizer").not(".mb-element-data-manager").each(function(index,element){
            var foreignDigitizer = $(element).data("mapbenderMbDigitizer");

            try {
                foreignDigitizer.schemes[schemaName].layer.getSource().refresh();
            } catch(e) {
                console.error("No active Digitizer Scheme '"+schemaName+"'",e);
            }
        });


    };
})();
