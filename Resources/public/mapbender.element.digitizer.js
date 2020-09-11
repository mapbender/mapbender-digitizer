(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';

    $.widget("mapbender.mbDigitizer", $.mapbender.mbDataManager, {

        options: {
            classes: {},
            create: null,
            debug: false,
            fileURI: "uploads/featureTypes",
            schemes: {},
            target: null
        },
        mbMap: null,
        active: false,


        _create: function () {
            var widget = this;
            var target = this.options.target;
            Mapbender.elementRegistry.waitReady(target).then(function(mbMap) {
                // Call DataManager constructor (ends with triggering ready...)
                widget._super();
                widget.widget = new Mapbender.Digitizer(widget.element, widget.options);
                if (widget.options.displayOnInactive) {
                    widget.activate();
                }
            }, function() {
                Mapbender.checkTarget("mbDigitizer", target);
            });
        },
        reveal: function() {
            this.activate();
        },
        hide: function() {
            this.deactivate();
        },
        activate: function() {
            if (!this.active) {
                this.widget.getCurrentSchema().activateSchema(true);
                this.active = true;
            }
        },
        deactivate: function() {
            this.widget.getCurrentSchema().deactivateSchema(true);
            this.active = false;
        },

        __formatting_dummy: null
    });

})(jQuery);
