(function () {
    "use strict";

    Mapbender.Digitizer.FormItemImage = {

        type: "image",
        CLASS_NAME: "FormItemImage",

        process: function(feature) {
            var item = this.clone();
            var schema = item.schema;
            var widget = schema.widget;

            if (!item.origSrc) {
                item.origSrc = item.src;
            }

            if (item.name && feature.data[item.name]) {
                item.dbSrc = feature.data[item.name];
                if (schema.featureType.files) {
                    schema.featureType.files.forEach(function (fileInfo) {
                        if (fileInfo.field === item.name) {
                            if (fileInfo.uri) {
                                item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                            } else {
                                item.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + item.name + "/" + item.dbSrc;
                            }
                        }
                    });
                }
            }

            var src = item.dbSrc || item.origSrc;
            item.src = item.relative ? Mapbender.Digitizer.Utilities.getAssetsPath(src) : src;
            return item;
        }

    };

    Object.setPrototypeOf(Mapbender.Digitizer.FormItemImage, Mapbender.Digitizer.FormItem);

})();
