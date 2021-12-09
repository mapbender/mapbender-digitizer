(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {


        isAddingToolsetType: function (toolsetType) {

            return ['drawPoint', 'drawLine', 'drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse'].includes(toolsetType);
        },

        getDefaultToolsetByGeomType: function (geomType) {

            var toolset = null;

            switch (geomType) {
                case 'point':
                    toolset = ['drawPoint', 'moveFeature'];
                    break;
                case 'line':
                    toolset = ['drawLine', 'modifyFeature', 'moveFeature'];
                    break;
                case 'polygon':
                    toolset = ['drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut', 'modifyFeature', 'moveFeature'];
            }

            if (!toolset) {
                console.error("No valid geom type", geomType)
            }
            return toolset.map(function (type) {
                return {'type': type}
            });


        },

        getAssetsPath: function (path) {
            return Mapbender.configuration.application.urls.asset + (path || '');
        },


        processFormItem: function (feature, item, dialog) {

            var schema = dialog.schema;
            var widget = schema.widget;

            if (item.type === "file") {
                item.uploadHanderUrl = widget.getElementURL() + "file-upload?schema=" + schema.schemaName + "&fid=" + feature.fid + "&field=" + item.name;
                if (item.hasOwnProperty("name") && feature.data.hasOwnProperty(item.name) && feature.data[item.name]) {
                    item.dbSrc = feature.data[item.name];
                    if (schema.featureType.files) {
                        $.each(schema.featureType.files, function (k, fileInfo) {
                            if (fileInfo.field && fileInfo.field === item.name) {
                                if (fileInfo.formats) {
                                    item.accept = fileInfo.formats;
                                }
                            }
                        });
                    }
                }

            }

            if (item.type === 'image') {

                if (!item.origSrc) {
                    item.origSrc = item.src;
                }

                if (item.hasOwnProperty("name") && feature.data.hasOwnProperty(item.name) && feature.data[item.name]) {
                    item.dbSrc = feature.data[item.name];
                    if (schema.featureType.files) {
                        $.each(schema.featureType.files, function (k, fileInfo) {
                            if (fileInfo.field && fileInfo.field == item.name) {

                                if (fileInfo.uri) {
                                    item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                } else {
                                    item.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + item.name + "/" + item.dbSrc;
                                }
                            }
                        });
                    }
                }

                var src = item.dbSrc ? item.dbSrc : item.origSrc;
                if (!item.hasOwnProperty('relative') && !item.relative) {
                    item.src = src;
                } else {
                    item.src = Mapbender.configuration.application.urls.asset + src;
                }
            }
        },


        processFormItems: function (feature, formItems, dialog) {

            DataUtil.eachItem(formItems, function (item) {
                Mapbender.Digitizer.Utilities.processFormItem(feature, item, dialog);
            });

            return formItems;
        },


        createHeadlessFormData: function (feature, formItems) {
            var formData = {};

            var extractFormData = function (definition) {
                (definition || []).forEach(function (item) {
                    if (_.isArray(item)) {
                        // recurse into lists
                        extractFormData(item);
                    } else if (item.name) {
                        var currentValue = (feature.data || {})[item.name];
                        // keep empty string, but replace undefined => null
                        if (typeof (currentValue) === 'undefined') {
                            currentValue = null;
                        }
                        formData[item.name] = currentValue;
                    } else if (item.children) {
                        // recurse into child property (should be a list)
                        extractFormData(item.children);
                    }
                });
            };

            extractFormData(formItems);
            return formData;
        }


    }

})();
