(function () {
    "use strict";

    Mapbender.Digitizer = function ($element, options) {

        var widget = this;

        Mapbender.DataManager.apply(this, [$element, options]);

        Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
            widget.printClient = printClient;
            $.extend(widget.printClient, Mapbender.Digitizer.printPlugin);
        });

    };


    Mapbender.Digitizer.prototype = Object.create(Mapbender.DataManager.prototype);
    Mapbender.Digitizer.prototype.constructor = Mapbender.DataManager;

    Mapbender.Digitizer.prototype.TYPE = "Digitizer";

    Mapbender.Digitizer.prototype.createScheme_ = function (rawScheme) {
        return new Mapbender.Digitizer.Scheme(rawScheme, this);
    };

    Mapbender.Digitizer.prototype.setup = function () {
        var widget = this;
        Object.getPrototypeOf(Mapbender.Digitizer.prototype).setup.apply(this, arguments);
        widget.contextMenu = new Mapbender.Digitizer.MapContextMenu(widget);

    };

    Mapbender.Digitizer.prototype.recalculateLayerVisibility_ = function (activateWidget) {
        var widget = this;

        $.each(widget.schemes, function (schemaName, schema) {
            if (activateWidget) {
                if (schema === widget.getCurrentSchema() || schema.displayPermanent) {
                    schema.layer.setVisible(true);
                }
            } else {
                if (!widget.displayOnInactive) {
                    schema.layer.setVisible(false);
                }
            }
        });

    };

    Mapbender.Digitizer.prototype.isInExtent = function(feature) {
        var widget = this;
        return ol.extent.intersects(widget.map.getView().calculateExtent(), feature.getGeometry().getExtent());
    };


})();
