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
                this.activateSchema(this.widget.getCurrentSchema());
                this.active = true;
            }
        },
        deactivate: function() {
            var schema = this.widget.getCurrentSchema();
            if (schema) {
                this.deactivateSchema(schema);
            }
            this.active = false;
        },
        _activateSchema: function(schema) {
            this._super(schema);
            var schema_ = this.widget.createScheme_(schema);
            schema_.activateSchema(); // triggers schema event
            this._toggleSchemaInteractions(schema_, true);
            schema_.layer.setVisible(true);
        },
        _deactivateSchema: function(schema) {
            this._super(schema);
            var schema_ = this.widget.createScheme_(schema);
            schema_.deactivateSchema();    // triggers schema event
            this._toggleSchemaInteractions(schema_, false);
            if (!(this.options.displayOnInactive || !schema_.displayPermanent)) {
                schema_.layer.setVisible(false);
            }
        },
        _toggleSchemaInteractions: function(schema, state) {
            if (schema.menu.toolSet.activeInteraction) {
                schema.menu.toolSet.activeInteraction.setActive(state);
            }
            schema.highlightControl.setActive(state);
            schema.selectControl.setActive(state);
        },

        _buildTableRowButtons: function(schema) {
            var schema_ = this.widget.createScheme_(schema);
            var menu = schema_.menu;
            return menu.generateResultDataTableButtons();
        },


        __formatting_dummy: null
    });

})(jQuery);
