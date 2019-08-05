(function () {
    "use strict";


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;
        var frame = menu.frame = $("<div />").addClass('frame');

        menu.appendToolset_();

        frame.append('<div style="clear:both;"/>');

        menu.appendCurrentExtentSwitch_();

        menu.generateDataTable_();

        frame.hide();
    };


    Mapbender.Digitizer.Menu.prototype = {

        appendCurrentExtentSwitch_: function () {
            var menu = this;
            var frame = menu.frame;
            var schema = menu.schema;
            if (schema.showExtendSearchSwitch) {
                var $checkbox = $("<input type='checkbox' />");
                var title = Mapbender.DigitizerTranslator.translate('toolset.current-extent');
                $checkbox.attr('title', title);
                if (schema.currentExtentSearch) {
                    $checkbox.attr("checked", "checked");
                }
                $checkbox.change(function (e) {
                    var currentExtentSearch = !!$(e.originalEvent.target).prop("checked");
                    schema.layer.getSource().dispatchEvent({type: "Digitizer.ChangeCurrentExtentSearch", currentExtentSearch: currentExtentSearch});
                });
                frame.append("<div style='clear:both'>");
                var $div = $("<div/>");
                $div.addClass("form-group checkbox onlyExtent");
                var $label = $("<label/>");
                $label.append($checkbox);
                $label.append(title);
                $div.append($label);
                frame.append($div);
            }
        },

        appendToolset_: function () {
            var menu = this;
            var frame = menu.frame;
            var schema = menu.schema;

            menu.toolSet = new Mapbender.Digitizer.Toolset(schema);


            if (schema.allowDigitize) {
                frame.append(menu.toolSet.element);
            }


        },


        generateDataTable_: function () {
            var menu = this;
            var frame = menu.frame;
            var schema = menu.schema;
            var map = schema.widget.map;

            var resultTable;


            map.on(ol.MapEventType.MOVEEND,  function (event) {
                if (resultTable.currentExtentSearch) {
                    schema.layer.getSource().getFeatures().forEach(function(feature){
                        if (ol.extent.intersects(schema.widget.map.getView().calculateExtent(), feature.getGeometry().getExtent())) {
                            resultTable.addRow(feature);
                        } else {
                            resultTable.deleteRows(function(idx, _feature,row) {
                                return _feature == feature;
                            });
                        }
                    });

                }

            });


            schema.layer.getSource().on("Digitizer.ChangeCurrentExtentSearch",function(event) {
                resultTable.currentExtentSearch = event.currentExtentSearch;
                if (event.currentExtentSearch) {
                    resultTable.deleteRows(function(idx, feature,row) {
                        return !ol.extent.intersects(schema.widget.map.getView().calculateExtent(), feature.getGeometry().getExtent())
                    });
                } else {
                    schema.layer.getSource().getFeatures().forEach(function(feature){
                        resultTable.addRow(feature);
                    });
                }
            });

            schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE,function(event) {
                var feature = event.feature;

                if(resultTable.currentExtentSearch && !ol.extent.intersects(schema.widget.map.getView().calculateExtent(), feature.getGeometry().getExtent())) {
                    return;
                }

                resultTable.addRow(feature);

                feature.on('Digitizer.HoverFeature', function (event) {

                    resultTable.hoverInResultTable(feature, event.hover);

                });

                feature.on('Digitizer.ModifyFeature',function(event) {

                    var row = resultTable.getTableRowByFeature(feature);

                    if (event.allowSaving) {
                        $(row).find('.button.save').removeAttr("disabled");
                    } else {
                        $(row).find('.button.save').attr("disabled","disabled");
                    }

                });

            });

            schema.layer.getSource().on(ol.source.VectorEventType.REMOVEFEATURE,function(event) {
                resultTable.deleteRows(function(idx, _feature,row) {
                    return _feature == event.feature;
                });
            });

            var generateResultDataTableButtons = function () {

                var buttons = [];

                if (schema.allowLocate) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
                        className: 'zoom',
                        cssClass: 'fa fa-crosshairs',
                        onClick: function (feature, ui) {
                            schema.zoomToFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData && schema.allowSaveInResultTable) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.save.title'),
                        className: 'save',
                        disabled: true,
                        onClick: function (feature, $button) {
                            schema.saveFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                        className: 'edit',
                        onClick: function (feature, ui) {
                            schema.openFeatureEditDialog(feature);
                        }
                    });
                }
                if (schema.copy && schema.copy.enable) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                        className: 'clone',
                        cssClass: ' fa fa-files-o',
                        onClick: function (feature, ui) {
                            schema.copyFeature(feature);
                        }
                    });
                }
                if (schema.allowCustomStyle) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                        className: 'style',
                        onClick: function (feature, ui) {
                            schema.openChangeStyleDialog(feature);
                        }
                    });
                }

                if (schema.allowChangeVisibility) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.visibility.toggleoff'),
                        className: 'visibility',
                        cssClass: 'eyeOff',
                        onClick: function (feature,$button) {
                            schema.layer.getSource().dispatchEvent({type: 'toggleFeatureVisibility', feature: feature });
                            if (feature.hidden) {
                                $button.addClass('eyeOn').removeClass('eyeOff');
                                $button.attr('title', Mapbender.DigitizerTranslator.translate('feature.visibility.toggleon'));
                            } else {
                                $button.addClass('eyeOff').removeClass('eyeOn');
                                $button.attr('title', Mapbender.DigitizerTranslator.translate('feature.visibility.toggleoff'));
                            }
                        }
                    });
                }

                if (schema.allowPrintMetadata) {
                    buttons.push({
                        title: 'Sachdaten drucken',
                        className: 'printmetadata',
                        onClick: function (feature, ui, b, c) {
                            if (!feature.printMetadata) {
                                feature.printMetadata = true;
                                ui.addClass("active");
                            } else {
                                feature.printMetadata = false;
                                ui.removeClass("active");
                            }
                        }
                    });
                }

                if (schema.allowDelete) {

                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate("feature.remove.title"),
                        className: 'remove',
                        cssClass: 'critical',
                        onClick: function (feature, ui) {
                            if (schema.allowDelete) {
                                schema.removeFeature(feature);
                            } else {
                                $.notify("Deletion is not allowed");
                            }
                        }
                    });
                }

                return buttons;


            };

            var generateResultDataTableColumns = function () {

                var columns = [];

                var createResultTableDataFunction = function (columnId, fieldSettings) {

                    return function (feature, type, val, meta) {

                        var data = feature.get(columnId);
                        if (typeof (data) == 'string') {
                            data = data.escapeHtml();
                        }
                        return data || '';
                    };
                };

                var getDefaultTableFields = function () {
                    var tableFields = this;
                    var schema = tableFields.schema;

                    tableFields[schema.featureType.uniqueId] = {label: 'Nr.', width: '20%'};
                    if (schema.featureType.name) {
                        tableFields[schema.featureType.name] = {label: 'Name', width: '80%'};
                    }
                    return tableFields;

                };


                $.each(schema.tableFields || getDefaultTableFields(), function (columnId, fieldSettings) {
                    fieldSettings.title = fieldSettings.label;
                    fieldSettings.data = fieldSettings.data || createResultTableDataFunction(columnId, fieldSettings);
                    columns.push(fieldSettings);
                });

                return columns;

            };


            var tableTranslation = schema.tableTranslation ? Mapbender.DigitizerTranslator.translateObject(schema.tableTranslation) : Mapbender.DigitizerTranslator.tableTranslations();

            var buttons = generateResultDataTableButtons();

            var resultTableSettings = {
                lengthChange: false,
                pageLength: schema.pageLength,
                searching: schema.inlineSearch,
                info: true,
                processing: false,
                ordering: true,
                paging: true,
                selectable: false,
                autoWidth: false,
                columns: generateResultDataTableColumns(),
                buttons: buttons,
                oLanguage: tableTranslation,
            };

            if (schema.view && schema.view.settings) {
                _.extend(resultTableSettings, schema.view.settings);
            }

            var $div = $("<div/>");
            var $table = $div.resultTable(resultTableSettings);

            resultTable = $table.resultTable("instance");


            resultTable.initializeColumnTitles();

            resultTable.initializeResultTableEvents(schema.highlightControl);


            frame.append($table);

        },


    };

})();
