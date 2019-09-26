(function () {
    "use strict";

    Mapbender.Digitizer.PopupConfiguration = function (configuration, schema) {
        var popupConfiguration = this;
        popupConfiguration.schema = schema;

        $.extend(popupConfiguration, configuration);

        var augmentFeatureEditDialogButtonsWithCustomButtons = function () {
            // Initialize custom button events
            var newButtons = {};
            _.each(configuration.buttons, function (button) {
                newButtons[button.text] = _.clone(button);
                if (button.click) {
                    console.error("Using Javascript code in the configuration is deprecated");

                    newButtons[button.text].createClick = function (feature, dialog) {

                        return function (e) {
                            var _widget = schema.widget;
                            var el = $(this);
                            var form = dialog;
                            var data = feature.data;

                            eval(button.click);
                            e.preventDefault();
                            return false;
                        }
                    }
                }

            });

            return newButtons;
        };

        var createButtons = function () {
            var widget = schema.widget;


            var createButton = function (title, click) {
                return {
                    text: Mapbender.DigitizerTranslator.translate(title),
                    createClick: function (feature, dialog) {
                        return function () {
                            click(feature, dialog);
                        };
                    }
                }
            };

            var buttons = {};

            if (schema.printable) {
                buttons.printButton = createButton('feature.print', function (feature) {
                    var featureSchema = schema.getSchemaByFeature(feature);
                    widget.printClient.printDigitizerFeature(featureSchema.schemaName, feature.fid).then(function(){ // On Finish, on Close
                    });

                });
            }
            if (schema.copy.enable) {
                buttons.copyButton = createButton('feature.clone.title', function (feature) {
                    schema.copyFeature(feature);

                });

            }
            if (schema.allowCustomStyle) {
                buttons.styleButton = createButton('feature.style.change', function (feature) {
                    schema.openChangeStyleDialog(feature);
                });
            }
            if (schema.allowEditData && schema.allowSave) {
                buttons.saveButton = createButton('feature.save.title', function (feature, dialog) {
                    var formData = dialog.$popup.formData();

                    // TODO this is not nice. Find a better solution
                    var errorInputs = $(".has-error", dialog.$popup);
                    if (errorInputs.length > 0) {
                        console.warn("Error", errorInputs);
                        return;
                    }

                    dialog.$popup.disableForm();
                    schema.saveFeature(feature, formData).then(function (response) {
                        if (response.hasOwnProperty('errors')) {
                            dialog.$popup.enableForm();
                            return;
                        }

                        dialog.$popup.popupDialog('close');

                    });
                });
            }
            if (schema.allowDelete) {
                buttons.deleteButton = createButton('feature.remove.title', function (feature, dialog) {
                    schema.removeFeature(feature);
                    dialog.$popup.popupDialog('close');
                });
            }
            if (schema.allowCancelButton) {
                buttons.cancelButton = createButton('cancel', function (feature, dialog) {
                    dialog.$popup.popupDialog('close');
                });
            }

            return buttons;

        };

        popupConfiguration.buttons = augmentFeatureEditDialogButtonsWithCustomButtons();
        $.extend(popupConfiguration.buttons, createButtons());

        popupConfiguration.getSchema = function (feature) {
            var scheme = schema.getSchemaByFeature(feature);
            return scheme;
        };


        Object.freeze(popupConfiguration.buttons);

    };

    Mapbender.Digitizer.PopupConfiguration.prototype = {
        remoteData: false,


        addFeatureAndDialog: function (feature, dialog) {

            _.each(this.buttons, function (button) {
                button.click = button.createClick(feature, dialog);
            });

            // buttons are deep copied! Should be moved to button constructing function though
            if (feature.isNew) {
                //delete this.buttons.styleButton;
                delete this.buttons.copyButton;
            }
        },

        clone: function () {
            return $.extend(true, {}, this)
        },


        createFeatureEditDialog: function (feature, schema) {
            return new FeatureEditDialog(feature, schema)
        },

        // This can be overridden
        augment: function(feature, $popup) {

        }
    };



    // TODO - - Carefully separate Feature Scheme and Loading Scheme in order to, for example, enable buttons of other schemes in allscheme!

    var FeatureEditDialog = function (feature, schema) {

        var dialog = this;

        var widget = schema.widget;
        var $popup = dialog.$popup = $("<div/>");

        dialog.feature = feature;

        var configuration = schema.popup.clone();

        configuration.addFeatureAndDialog(feature, dialog);


        dialog.schema = schema;
        configuration.title = schema.getSchemaByFeature(feature).popup.title;
        configuration.width = schema.getSchemaByFeature(feature).popup.with;


        var doFeatureEditDialogBindings = function () {
            var feature = dialog.feature;

            $popup.bind('popupdialogclose', function () {

                if (feature.isNew && schema.allowDeleteByCancelNewGeometry) {
                    schema.removeFeature(feature);
                } else if ((feature.isChanged || feature.isNew) && schema.getSchemaByFeature(feature).revertChangedGeometryOnCancel) {

                    schema.layer.renderer.eraseGeometry(feature.geometry);
                    feature.geometry = feature.oldGeometry;
                    feature.isChanged = false;
                    schema.layer.drawFeature(feature);
                    schema.unsetModifiedState(feature);

                }
                if (configuration.modal) {
                    widget.currentPopup = null;
                }


            });

        };



        widget.currentPopup = $popup;


        $popup.data('feature', feature);

        var processedFormItems = dialog.processFormItems(feature);

        $popup.generateElements({children: processedFormItems});


        $popup.popupDialog(configuration);


        doFeatureEditDialogBindings();

        dialog.initResultTables(feature);

        configuration.augment(feature, $popup);

        /** This is evil, but filling of input fields currently relies on that (see select field) **/
        setTimeout(function () {
            $popup.formData(feature.data);
        },0);

    };

    FeatureEditDialog.prototype.initResultTables = function(feature) {
        var dialog = this;
        var $popup = dialog.$popup;
        var widget = dialog.schema.widget;

        var tables = $popup.find(".mapbender-element-result-table");
        _.each(tables, function (table, index) {

            var item = $(table).data('item');
            $(table).data('olFeature', feature);
            if (item.editable) {
                item.columns.pop();
            }

            var dataStoreLinkName = item.dataStoreLink.name;
            if (dataStoreLinkName) {
                var requestData = {
                    dataStoreLinkName: dataStoreLinkName,
                    fid: feature.fid,
                    fieldName: item.dataStoreLink.fieldName
                };

                widget.query('dataStore/get', requestData).done(function (data) {
                    var dataItems = [];

                    if (Object.prototype.toString.call(data) === '[object Array]') {
                        _.each(data, function (el, i) {
                            el.attributes.item = item;
                            dataItems.push(el.attributes)

                        });

                    } else {
                        console.error("invalid return",data);
                        // data.item = item;
                        // data = [data];
                    }

                    var tableApi = $(table).resultTable('getApi');
                    tableApi.clear();
                    tableApi.rows.add(dataItems);
                    tableApi.draw();

                });
            }

        });

    };


    FeatureEditDialog.prototype.processFormItems = function(feature) {

        var dialog = this;
        var schema = dialog.schema;
        var widget = schema.widget;

        var formItems = JSON.parse(JSON.stringify(schema.formItems)); // Deep clone hack!

        DataUtil.eachItem(formItems, function (item) {

                if (item.type === "resultTable" && item.editable && !item.isProcessed) {
                    var onCreateClick;
                    var onEditClick;

                    if (!item.hasOwnProperty('dataManagerLink')) {
                        onCreateClick = function (e) {
                            e.preventDefault();
                            var item = $(this).next().data("item");
                            var table = $(this).siblings(".mapbender-element-result-table")

                            var feature = table.data('olFeature');
                            var data = {};

                            item.allowRemove = false;
                            data[item.dataStoreLink.fieldName] = data['linkId'] = feature.attributes[item.dataStoreLink.uniqueId];
                            data[item.dataStore.uniqueId] = null;
                            data.item = item;
                            var foreignEditDialog = new Mapbender.Digitizer.ForeignEditDialog(data,item,table,schema);
                            return false;
                        };

                        onEditClick = function (rowData, ui, e) {
                            e.defaultPrevented && e.defaultPrevented();
                            e.preventDefault && e.preventDefault();

                            var table = ui.parents('.mapbender-element-result-table');
                            var item = table.data('item');

                            item.allowRemove = true;
                            rowData.externalId = rowData[item.dataStoreLink.uniqueId];//feature.attributes[item.dataStoreLink.uniqueId];

                            var foreignEditDialog = new Mapbender.Digitizer.ForeignEditDialog(rowData,item,table,schema);

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
    }


})();
