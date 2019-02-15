(function($) {

    Mapbender.DigitizerTranslator = {

        /**
         * Regular Expression to get checked if string should be translated
         *
         * @type {RegExp}
         */
        translationReg: /^trans:\w+\.(\w|-|\.{1}\w+)+\w+$/,

        translate: function (title, withoutSuffix) {
            return Mapbender.trans(withoutSuffix ? title : "mb.digitizer." + title);
        },

        translateObject: function (items) {
            for (var k in items) {
                var item = items[k];
                if (typeof item === "string" && item.match(this.translationReg)) {
                    items[k] = Mapbender.DigitizerTranslator.translate(item.split(':')[1], true);
                } else if (typeof item === "object") {
                    this.translateObject(item);
                }
            }
            return item;
        },


        /**
         * Check and replace values recursive if they should be translated.
         * For checking used "translationReg" variable
         *
         *
         * @param items
         */
        translateStructure: function (items) {
            var isArray = items instanceof Array;
            for (var k in items) {
                if (isArray || k === "children") {
                    this.translateStructure(items[k]);
                } else {
                    if (typeof items[k] == "string" && items[k].match(this.translationReg)) {
                        items[k] = Mapbender.DigitizerTranslator.translate(items[k].split(':')[1], true);
                    }
                }
            }

            return items;
        },

        tableTranslations: {
            sSearch: Mapbender.DigitizerTranslator.translate("search.title") + ':',
            sEmptyTable: Mapbender.DigitizerTranslator.translate("search.table.empty"),
            sZeroRecords: Mapbender.DigitizerTranslator.translate("search.table.zerorecords"),
            sInfo: Mapbender.DigitizerTranslator.translate("search.table.info.status"),
            sInfoEmpty: Mapbender.DigitizerTranslator.translate("search.table.info.empty"),
            sInfoFiltered: Mapbender.DigitizerTranslator.translate("search.table.info.filtered")
        }


    };
})(jQuery);