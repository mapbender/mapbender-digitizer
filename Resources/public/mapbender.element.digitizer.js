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
            target: null,
        },


        _create: function () {

            if (!Mapbender.checkTarget("mbDigitizer", this.options.target)) {
                return;
            }

            this.widget = new Mapbender.Digitizer(this.element,this.options);
            Mapbender.elementRegistry.waitReady(widget.options.target).then(widget.setup.bind(widget));
            this._trigger('ready');

        },




    });

})(jQuery);
