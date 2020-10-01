(function () {
    "use strict";

    Mapbender.Digitizer = function ($element, options) {
        var widget  = this;

        $.extend(widget, options);

        widget.id = $element.attr("id");
    };

    Mapbender.Digitizer.prototype.TYPE = "Digitizer";

    Mapbender.Digitizer.prototype.setup = function () {
        var widget = this;

        var rawSchemes = widget.schemes;
        widget.schemes = {};
        $.each(rawSchemes, function (schemaName,options) {
            options.schemaName = schemaName;
            var schema = widget.schemes[schemaName] = widget.createScheme_(options);
        });
        Object.freeze(widget.schemes);
    };

    Mapbender.Digitizer.prototype.isInExtent = function(feature) {
        var widget = this;
        return ol.extent.intersects(widget.map.getView().calculateExtent(), feature.getGeometry().getExtent());
    };

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

    Mapbender.Digitizer.prototype.getProjectionCode = function() {
        var widget = this;
        return widget.map.getView().getProjection().getCode().split(':').pop();
    };
})();
