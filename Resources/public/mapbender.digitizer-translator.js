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
                    items[k] = Mapbender.trans(item.split(':')[1]);
                } else if (typeof item === "object") {
                    this.translateObject(item);
                }
            }
            return item;
        },


        tableTranslations: function(overrides) {
            return Object.assign({
                sSearch: Mapbender.trans("mb.digitizer.search.title") + ':',
                sEmptyTable: Mapbender.trans("mb.digitizer.search.table.empty"),
                sZeroRecords: Mapbender.trans("mb.digitizer.search.table.zerorecords"),
                sInfo: Mapbender.trans("mb.digitizer.search.table.info.status"),
                sInfoEmpty: Mapbender.trans("mb.digitizer.search.table.info.empty"),
                sInfoFiltered: Mapbender.trans("mb.digitizer.search.table.info.filtered")
            }, this.translateObject(overrides || {}));
        }
    };
})(jQuery);
