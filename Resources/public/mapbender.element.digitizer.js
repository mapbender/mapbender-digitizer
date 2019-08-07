(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';


    $.widget("mapbender.mbDigitizer", {

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

            this._trigger('ready');

        },


        reveal: function() {
            this.widget.activate(true);
        },

        hide: function() {
            this.widget.deactivate();
        },




    });

})(jQuery);
