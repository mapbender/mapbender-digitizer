(function () {
    "use strict";

    Mapbender.Digitizer.FormItemFile = {

        process: function(feature) {
            var item = this.clone();
            var schema = this.schema;

            item.uploadHanderUrl = schema.widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + feature.fid + "&field=" + item.name;
            if (item.hasOwnProperty("name") && feature.data[item.name]) {
                item.dbSrc = feature.data[item.name];
                if (schema.featureType.files) {
                    schema.featureType.files.forEach( function (fileInfo) {
                        if (fileInfo.field === item.name) {
                            if (fileInfo.formats) {
                                item.accept = fileInfo.formats;
                            }
                        }
                    });
                }
            }

            return item;

        }
    };

    Object.setPrototypeOf(Mapbender.Digitizer.FormItemFile, Mapbender.Digitizer.FormItem);

})();
