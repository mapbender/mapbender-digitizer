(function () {
    "use strict";


    Mapbender.Digitizer.Utilities = {


        isAddingToolsetType: function(toolsetType) {

            return ['drawPoint','drawLine','drawPolygon','drawRectangle','drawCircle','drawEllipse'].includes(toolsetType);
        },

        getDefaultToolsetByGeomType: function(geomType) {

            var toolset = null;

            switch(geomType) {
                case 'point':
                    toolset = ['drawPoint','moveFeature'];
                    break;
                case 'line':
                    toolset = ['drawLine','modifyFeature','moveFeature'];
                    break;
                case 'polygon':
                    toolset = ['drawPolygon','drawRectangle','drawCircle','drawEllipse','drawDonut','modifyFeature','moveFeature'];
            }

            if (!toolset) {
                console.error("No valid geom type",geomType)
            }
            return toolset.map(function(type) { return { 'type' : type }});


        },

        getAssetsPath: function(path) {
            return Mapbender.configuration.application.urls.asset + (path || '');
        },



        processFormItems: function(feature,formItems,dialog) {

            var schema = dialog.schema;
            var widget = schema.widget;

            DataUtil.eachItem(formItems, function (item) {

                if (item.type === "resultTable" && item.editable && !item.isProcessed) {
                    var onCreateClick;
                    var onEditClick;
                    var onRemoveClick;

                    if (!item.hasOwnProperty('dataManagerLink')) {
                        onCreateClick = function (e) {
                            e.preventDefault();
                            var table = $(this).siblings(".mapbender-element-result-table");
                            var formItem = table.data('item');

                            var rowData = {};

                            formItem.allowRemove = false;
                            rowData[formItem.dataStoreLink.fieldName] = rowData['linkId'] = feature.attributes[formItem.dataStoreLink.uniqueId];
                            rowData[formItem.dataStore.uniqueId] = null;
                            rowData.item = formItem;

                            var foreignEditDialog = new Mapbender.Digitizer.ForeignEditDialog(rowData,formItem,table,dialog);
                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var table = ui.parents('.mapbender-element-result-table');
                            var formItem = table.data('item');

                            formItem.allowRemove = true;
                            //rowData.externalId = rowData[formItem.dataStoreLink.uniqueId];//feature.attributes[formItem.dataStoreLink.uniqueId];

                            var foreignEditDialog = new Mapbender.Digitizer.ForeignEditDialog(rowData,formItem,table,dialog);

                            return false;
                        };

                        onRemoveClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var table = ui.parents('.mapbender-element-result-table');
                            var formItem = table.data('item');

                            Mapbender.confirmDialog({

                                html: Mapbender.DigitizerTranslator.translate("feature.remove.from.database"),
                                onSuccess: function () {

                                    var uniqueIdKey = formItem.dataStore.uniqueId;
                                    widget.query('datastore/remove', {
                                        schema: formItem.dataStoreLink.name,
                                        dataItemId: rowData[uniqueIdKey],
                                        dataStoreLinkFieldName: formItem.dataStoreLink.fieldName,
                                        linkId: rowData[rowData.item.dataStoreLink.fieldName]

                                    }).done(function (response) {

                                        if (response.processedItem.hasOwnProperty('errors')) {
                                            $.each(response.errors, function (i, error) {
                                                $.notify(error.message, {
                                                    title: 'API Error',
                                                    autoHide: false,
                                                    className: 'error'
                                                });
                                                console.error(error.message);
                                            });
                                            return;
                                        }

                                        var tableApi = table.resultTable('getApi');
                                        var processedData = [];

                                        if (Array.isArray(response.dataItems)) {
                                            $.each(response.dataItems, function (i,e) {
                                                if (e.hasOwnProperty('attributes')) {
                                                    e.attributes.item = dialog.formItem;
                                                    processedData.push(e.attributes);
                                                }
                                            });

                                        } else {
                                            if (response.dataItems.hasOwnProperty('attributes')) {
                                                response.dataItems.attributes.item = dialog.formItem;
                                                processedData = [response.dataItems.attributes];

                                            }
                                        }
                                        tableApi.clear();
                                        tableApi.rows.add(processedData);
                                        tableApi.draw();

                                        $.notify(Mapbender.DigitizerTranslator.translate("feature.remove.successfully", false), 'info');

                                    });

                                }
                            });



                            return false;
                        };
                    } else if (item.hasOwnProperty('dataManagerLink')) {
                        var schemaName = item.dataManagerLink.schema;
                        var fieldName = item.dataManagerLink.fieldName;
                        var schemaFieldName = item.dataManagerLink.schemaFieldName;

                        onCreateClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            dm.withSchema(schemaName, function (schema) {
                                dm._openEditDialog(schema.create());
                            });

                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];

                            dm.withSchema(schemaName, function (schema) {
                                var dataItem = _.find(schema.dataItems, function (d) {
                                    return d[schemaFieldName] === rowData[fieldName];
                                });
                                dm._openEditDialog(dataItem);
                            });

                            return false;
                        };
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


                // if(item.type === 'coordinates'){
                //     var children = [];
                //     var mapProjection = widget.getMap().getProjectionObject().projCode;
                //     var epsgCodes = item.epsgCodes;
                //
                //     // Add Map Projection to EPSG codes, only if it is not already there
                //     var mapProjectionInEpsgCodes = false;
                //     epsgCodes.forEach(function(code){
                //         if (code[0]===mapProjection) {
                //             mapProjectionInEpsgCodes = true;
                //         }
                //     });
                //     if (!mapProjectionInEpsgCodes) {
                //         epsgCodes.unshift([mapProjection,mapProjection]);
                //     }
                //
                //     var EPSGSelection = {
                //         title: item.title_epsg || 'EPSG:',
                //         type: 'select',
                //         options: epsgCodes,
                //         value: mapProjection,
                //         css : { width: '33.33%' },
                //         cssClass: '-fn-active-epsgCode',
                //         change: function(event){
                //
                //             var oldEpsgCode = $('.-fn-coordinates-container').data('activeEpsgCode');
                //             var oldProjection;
                //             if (oldEpsgCode) {
                //                 oldProjection = new OpenLayers.Projection(oldEpsgCode);
                //             }
                //             var activeProj =  oldProjection || widget.getMap().getProjectionObject();
                //             var epsgCode = $(event.currentTarget).find('select').val();
                //             var inputX = $('.-fn-coordinates.x > input', widget.currentPopup);
                //             var inputY = $('.-fn-coordinates.y > input', widget.currentPopup);
                //             var x = Mapbender.Transformation.isDegree(inputX.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputX.val()) : inputX.val();
                //             var y = Mapbender.Transformation.isDegree(inputY.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputY.val()) : inputY.val();
                //
                //             var projectionToTransform = new OpenLayers.Projection(epsgCode);
                //             var lonlat = Mapbender.Transformation.transFromFromTo(new OpenLayers.LonLat(x, y),activeProj, projectionToTransform);
                //             inputX.val(lonlat.x || '');
                //             inputY.val(lonlat.y || '');
                //             $('.-fn-coordinates-container').data('activeEpsgCode',epsgCode);
                //
                //         }
                //     };
                //
                //     var input = {
                //         type : 'input',
                //         label: '',
                //         css : { width: '33.33%' },
                //
                //     };
                //
                //     // set default ordering, if the coordinatesFieldsOrder is not set in the digitizer YML
                //     if (!item.coordinatesFieldsOrder) {
                //         item.coordinatesFieldsOrder = ['x','y','epsg'];
                //     }
                //     _.each(item.coordinatesFieldsOrder, function(direction,i){
                //         if (direction != 'epsg') {
                //             var child  = {
                //                 cssClass : '-fn-coordinates ' + direction,
                //                 tile: direction + ': ',
                //                 title: (direction==='x' ? item.title_longitude || 'longitude' : item.title_latitude || 'latitude' ) + ': ',
                //                 name: direction,
                //                 css: " { width: 33%; }",
                //                 change : function(){
                //
                //                     var dialog = widget.currentPopup;
                //                     var feature = dialog.data('feature');
                //                     var layer = widget.currentSettings.layer;
                //
                //                     var inputX = $('.-fn-coordinates.x > input', widget.currentPopup);
                //                     var inputY = $('.-fn-coordinates.y > input', widget.currentPopup);
                //                     var x = Mapbender.Transformation.isDegree(inputX.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputX.val()) : inputX.val();
                //                     var y = Mapbender.Transformation.isDegree(inputY.val()) ? Mapbender.Transformation.transformDegreeToDecimal(inputY.val()) : inputY.val();
                //
                //                     var activeProjection = $('.-fn-active-epsgCode', widget.currentPopup).find('select').val();
                //
                //                     var projection = Mapbender.Transformation.transformToMapProj(x,y,activeProjection);
                //
                //                     var oldGeometry = feature.geometry;
                //                     feature.geometry = new OpenLayers.Geometry.Point(projection.x,projection.y);
                //
                //                     //var currentBounds = widget.map.calculateBounds();
                //                     //if (currentBounds.contains(projection.x,projection.y)) {
                //
                //                     if (oldGeometry.x && oldGeometry.y) {
                //                         layer.renderer.eraseGeometry(oldGeometry);
                //                     }
                //                     layer.drawFeature(feature);
                //                     widget._getData(widget.currentSettings); // Triggered in order to have new Feature in resultTable
                //                     // } else {
                //                     //
                //                     //     var transformedGeometry = Mapbender.Transformation.transformFromMapProj(oldGeometry.x, oldGeometry.y, activeProjection);
                //                     //     $('.-fn-coordinates.x > input', widget.currentPopup).val(transformedGeometry.x || '');
                //                     //     $('.-fn-coordinates.y > input', widget.currentPopup).val(transformedGeometry.y || '');
                //                     //
                //                     //     feature.geometry = oldGeometry;
                //                     //
                //                     //     $.notify('Coordinates are not in current viewport. Please zoom to a greater extent.');
                //                     // }
                //
                //                 }
                //             };
                //             children.push($.extend(child,input));
                //         } else {
                //             children.push(EPSGSelection);
                //         }
                //     });
                //     item.type = "fieldSet";
                //     item.children=  children;
                //     item.cssClass =  '-fn-coordinates-container coordinates-container';
                //
                // }
                if (item.type === "select" && !item.isProcessed && ((item.dataStore && item.dataStore.editable && item.dataStore.popupItems) || item.dataManagerLink)) {
                    var onCreateClick;
                    var onEditClick;

                    if (item.dataManagerLink) {
                        var schemaName = item.dataManagerLink.schema;
                        var schemaFieldName = item.dataManagerLink.schemaFieldName;

                        onCreateClick = function (e) {
                            e.preventDefault && e.preventDefault();

                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
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
                            var dm = Mapbender.elementRegistry.listWidgets()['mapbenderMbDataManager'];
                            dm.withSchema(schemaName, function (schema) {
                                var dataItem = _.find(schema.dataItems, function (d) {
                                    return d[schemaFieldName].toString() === val;
                                });
                                var dialog = dm._openEditDialog(dataItem);

                            });

                            return false;
                        };
                    } else {
                        onCreateClick = function () {
                            var dataItemId = $(this).siblings().find('select').val();
                            var selectRef = $(this).siblings().find('select');

                            var dataStoreId = item.dataStore.id;
                            widget.query("datastore/get", {
                                schema: schema.schemaName,
                                id: dataStoreId,
                                dataItemId: dataItemId
                            }).done(function (data) {
                                widget._openEditDialog(data, item.dataStore.popupItems, item, selectRef);

                            });

                            return false;
                        };

                        onEditClick = function () {
                            var selectRef = $(this).siblings().find('select');
                            widget._openEditDialog({}, item.dataStore.popupItems, item, selectRef);

                            return false;
                        };
                    }

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
            });



            return formItems;
        },


        createHeadlessFormData: function (feature,formItems) {
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
