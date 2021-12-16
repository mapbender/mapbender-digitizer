(function () {
    "use strict";
    Mapbender.Digitizer.AllScheme = function (rawScheme, widget) {


        var allowCustomStyle = false;
         _.each(widget.getBasicSchemes(), function (scheme) {
            allowCustomStyle = scheme.allowCustomStyle || allowCustomStyle;
        });

        this.allowCustomStyle = allowCustomStyle;
        this.isAllScheme = true;

        Mapbender.Digitizer.Scheme.apply(this, arguments);

        this.schemaName = 'all';

    };


    Mapbender.Digitizer.AllScheme.prototype = {

        featureType: {

            geomType: '-',
            fields: [],
        },


        getGeomType: function() {
            return 'all';
        },
        createToolset: function () {
            var schema = this;
            var widget = schema.widget;
            var toolset = [];
            _.each(widget.getBasicSchemes(), function (scheme) {
                $.each(scheme.toolset, function (i, rawButton) {

                    if (scheme.disableAggregation) {
                        return;
                    }
                    // Avoid duplicates, i.e. elements with same 'type' property
                    if (toolset.filter(function (t) {
                        return t.type === rawButton.type && !Mapbender.Digitizer.Utilities.isAddingToolsetType(t.type);
                    }).length === 0) {
                        rawButton.schema = scheme; // This is necessary for some Client configurations
                        toolset.push(rawButton);
                    }

                });

            });

           schema.sortToolSet(toolset);

            return toolset;
        },

        /**
         * Override
         */
        sortToolSet: function(toolset) {
           return toolset;
        },


        /**
         * It is highly recommended to overwrite this method in a custom digitizer bundle,
         * since it is not possible to generalize table fields available to the aggregating scheme
         */

        getDefaultTableFields: function () {

            var schemes = this.widget.schemes;
            return schemes[Object.keys(schemes)[0]].tableFields; // TODO Only solvable when Data of different Features is already aggregated in the database query


        },


        getSchemaByFeature: function (feature) {
            var schema = this;
            var widget = schema.widget;
            var scheme = widget.getSchemaByName(feature.attributes.schemaName);
            return scheme;

        }
    };


    Object.setPrototypeOf(Mapbender.Digitizer.AllScheme.prototype, Mapbender.Digitizer.Scheme.prototype);

})();
