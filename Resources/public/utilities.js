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

            if (item.type === "resultTable" && item.editable && !item.isProcessed && item.dataManagerLink) {
                var onCreateClick;
                var onEditClick;
                var onRemoveClick;

                    var fieldName = item.dataManagerLink.fieldName;
                    var schemaName = item.dataManagerLink.schema;

                    var getRowId = function (tableApi, rowData) {
                        var rowId = null;

                        tableApi.rows(function (idx, data) {
                            if (data == rowData) {
                                rowId = idx;
                            }
                        });

                        if (rowId == null) {
                            throw new Error();
                        }
                        return rowId;
                    };


                    onCreateClick = function (e) {
                        e.preventDefault && e.preventDefault();
                        var table = $(this).siblings(".mapbender-element-result-table");
                        var tableApi = table.resultTable('getApi');


                        var dm = widget.getConnectedDataManager();
                        var dataItem = dm.getSchemaByName(schemaName).create();
                        dataItem[fieldName] = feature.fid;
                        var dialog = dm._openEditDialog(dataItem);
                        dialog.parentTable = table;
                        $(dialog).find("select[name=" + fieldName + "]").attr("disabled", "true");
                        $(dialog).bind('data.manager.item.saved', function (event, data) {
                            tableApi.rows.add([data.item]);
                            tableApi.draw();
                            dm._getData();

                        });

                        return false;
                    };

                    onEditClick = function (rowData, button, e) {
                        e.defaultPrevented && e.defaultPrevented();
                        e.preventDefault && e.preventDefault();
                        var table = button.parents('.mapbender-element-result-table');
                        var tableApi = table.resultTable('getApi');


                        var dm = widget.getConnectedDataManager();
                        var dialog = dm._openEditDialog(rowData);
                        dialog.parentTable = table;

                        var rowId = getRowId(tableApi, rowData);

                        $(dialog).find("select[name=" + fieldName + "]").attr("disabled", "true");
                        $(dialog).bind('data.manager.item.saved', function (event, data) {
                            tableApi.row(rowId).data(data.item);
                            tableApi.draw();
                            dm._getData();

                        });

                        return false;
                    };


                    onRemoveClick = function (rowData, button, e) {
                        e.defaultPrevented && e.defaultPrevented();
                        e.preventDefault && e.preventDefault();
                        var table = button.parents('.mapbender-element-result-table');
                        var tableApi = table.resultTable('getApi');


                        var rowId = getRowId(tableApi, rowData);

                        var dm = widget.getConnectedDataManager();

                        dm.removeData(rowData, function () {
                            tableApi.row(rowId).remove();
                            tableApi.draw();
                            dm._getData();


                        });

                        return false;


                    }



                var cloneItem = $.extend({}, item);
                cloneItem.isProcessed = true;
                item.type = "container";
                var button = {
                    type: "button",
                    title: "",
                    hover: Mapbender.DigitizerTranslator.translate('feature.create'),
                    cssClass: "icon-create",
                    click: onCreateClick
                };

                item.children = [button, cloneItem];

                var buttons = [];

                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                    className: 'edit',
                    onClick: onEditClick
                });

                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                    className: 'remove',
                    onClick: onRemoveClick
                });

                cloneItem.buttons = buttons;

            }


            if (item.type === "select" && !item.isProcessed && (item.dataManagerLink)) {
                var onCreateClick;
                var onEditClick;

                var schemaName = item.dataManagerLink.schema;
                var schemaFieldName = item.dataManagerLink.schemaFieldName;

                onCreateClick = function (e) {
                    e.preventDefault && e.preventDefault();

                    var dm = widget.getConnectedDataManager();
                    dm.withSchema(schemaName, function (schema) {
                        dm._openEditDialog(schema.create());

                    });
                    $(dm.element).on('data.manager.item.saved', function (event, eventData) {
                        var uniqueIdKey = eventData.uniqueIdKey;
                        var text = item.itemPattern.replace('{id}', eventData.item[uniqueIdKey]).replace('{name}', eventData.item[item.itemName]);
                        var $option = $('<option />').val(eventData.item[uniqueIdKey]).text(text);
                        var $select = $('select[name=' + item.name + ']').append($option);
                        $select.val(eventData.item[uniqueIdKey]);
                    });
                    return false;
                };

                onEditClick = function (e) {
                    e.preventDefault && e.preventDefault();

                    var val = $(this).siblings().find('select').val();
                    var dm = widget.getConnectedDataManager();
                    dm.withSchema(schemaName, function (schema) {
                        var dataItem = _.find(schema.dataItems, function (d) {
                            return d[schemaFieldName].toString() === val;
                        });
                        var dialog = dm._openEditDialog(dataItem);

                    });

                    return false;
                };


                var cloneItem = $.extend({}, item);
                cloneItem.isProcessed = true;
                item.type = "fieldSet";
                item.title = undefined;
                item.children = [
                    cloneItem,
                    {
                        type: "button",
                        title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                        cssClass: 'edit',
                        click: onEditClick
                    },
                    {
                        type: "button",
                        title: "",
                        hover: Mapbender.DigitizerTranslator.translate('feature.create'),
                        cssClass: "icon-create",
                        click: onCreateClick
                    }
                ];
            }

            if (item.type === "file") {
                item.uploadHanderUrl = widget.elementUrl + "file/upload?schema=" + schema.schemaName + "&fid=" + feature.fid + "&field=" + item.name;
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
                definition.forEach(function (item) {
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
