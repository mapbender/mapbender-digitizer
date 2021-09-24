;!(function() {
    "use strict";

    Object.assign(Mapbender.Digitizer.FeatureRenderer.prototype, {
        initializeGlobalStyles_: function() {
            return {
                invisible: new OpenLayers.Style({
                    fillOpacity: 0,
                    strokeOpacity: 0,
                    fontOpacity: 0,
                    label: null
                }),
                editing: this.createEditingStyle_()
            };
        },
        createEditingStyle_: function() {
            // @todo: nice editing style?
            return new OpenLayers.Style(OpenLayers.Feature.Vector.style.temporary);
        },
        __dummy__: null
    });

}());
