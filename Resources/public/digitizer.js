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

    Mapbender.Digitizer.prototype.createScheme_ = function (rawScheme) {
        return new Mapbender.Digitizer.Scheme(rawScheme, this);
    };

    Mapbender.Digitizer.prototype.setup = function () {
        var widget = this;
        Object.getPrototypeOf(Mapbender.Digitizer.prototype).setup.apply(this, arguments);
        widget.contextMenu = new Mapbender.Digitizer.MapContextMenu(widget);

    };


})();
