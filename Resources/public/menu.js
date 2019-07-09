(function () {
    "use strict";


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;
        var frame = menu.frame = $("<div />").addClass('frame');


        menu.appendToolset_();

        menu.augment();

        frame.append('<div style="clear:both;"/>');

        frame.hide();
    };


    Mapbender.Digitizer.Menu.prototype = {

        /** Override **/
        augment: function () {

        },


        appendToolset_: function () {
            var menu = this;
            var frame = menu.frame;
            var schema = menu.schema;
            var widget = schema.widget;
            var layer = schema.layer;


            var toolset = schema.toolset;

            menu.toolSet = new Mapbender.Digitizer.Toolset({
                buttons: toolset,
                schema: schema,
                layer: layer,
                geomType: schema.getGeomType(),

                injectedMethods: {

                    removeInteraction: function (control) {
                        schema.widget.map.removeInteraction(control);
                    },


                    openFeatureEditDialog: function (feature, type) {

                        console.assert(type === "add" || type === "donut" || type === "modify" || type === "move", "Type " + type + " is wrong in 'openFeatureEditDialog'");

                        if (type === 'add' && schema.openFormAfterEdit) {
                            schema.openFeatureEditDialog(feature);
                        } else if (schema.openFormAfterModification) {
                            schema.openFeatureEditDialog(feature);
                        }

                    },
                    getDefaultAttributes: function () {
                        return schema.getDefaultProperties();
                    },
                    preventModification: function (feature) {

                        return schema.evaluatedHooksForControlPrevention.onModificationStart && schema.evaluatedHooksForControlPrevention.onModificationStart(feature);

                    },
                    preventMove: function (feature) {

                        return schema.evaluatedHooksForControlPrevention.onStart && schema.evaluatedHooksForControlPrevention.onStart(feature);

                    },

                }


            });


            if (schema.allowDigitize) {
                frame.append(menu.toolSet.element);
            }


        },


        deactivateControls: function () {
            var menu = this;

            menu.toolSet.activeControl && menu.toolSet.activeControl.setActive(false);

        },


    };

})();
