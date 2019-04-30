(function () {
    "use strict";



    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        var frame = menu.frame = $("<div />").addClass('frame');


        var appendToolset = function () {
            var widget = schema.widget;
            var layer = schema.layer;


            var toolset = schema.toolset;

            menu.toolSet = new Mapbender.Digitizer.Toolset({
                buttons: toolset,
                schema: schema,
                layer: layer,
                geomType: schema.getGeomType(),

                injectedMethods: {

                    openFeatureEditDialog: function (feature) {

                        if (schema.openFormAfterEdit) {
                            schema.openFeatureEditDialog(feature);
                        }
                    },
                    getDefaultAttributes: function () {
                        return schema._getDefaultProperties();
                    },
                    preventModification: function () {

                        return !!schema.evaluatedHooks.onModificationStart;

                    },
                    preventMove: function () {

                        return !!schema.evaluatedHooks.onStart;

                    },
                    extendFeatureDataWhenNoPopupOpen: function (feature) {

                        if (widget.currentPopup && widget.currentPopup.data('visUiJsPopupDialog')._isOpen) {

                        } else {

                            if (schema.popup && schema.popup.remoteData) {
                                schema._getRemoteData(feature);
                            } else {
                                if (schema.openFormAfterEdit) {
                                    schema.openFeatureEditDialog(feature);
                                }
                            }
                        }
                    },


                    setModifiedState: schema.setModifiedState
                }


            });


            if (schema.allowDigitize) {
                frame.append(menu.toolSet.element);
            }


        };


        var appendGeneralDigitizerButtons = function () {

            var buttons = {};
            if (schema.showVisibilityNavigation) {

                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-eye-slash");
                $button.attr("title", Mapbender.DigitizerTranslator.translate('toolset.hideAll'));
                $button.click(function () {
                    schema.setVisibilityForAllFeaturesInLayer(false);
                });
                buttons['hideAll'] = $button;

                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-eye");
                $button.attr("title", Mapbender.DigitizerTranslator.translate('toolset.showAll'));
                $button.click(function () {
                    schema.setVisibilityForAllFeaturesInLayer(true);
                });
                buttons['showAll'] = $button;
            }
            if (schema.allowSaveAll) {

                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-floppy-o");
                $button.attr("title", Mapbender.DigitizerTranslator.translate('toolset.saveAll'));
                $button.addClass("save-all-features");
                $button.click(function () {
                    var unsavedFeatures = schema.getUnsavedFeatures();
                    _.forEach(unsavedFeatures, function (feature) {
                        schema.saveFeature(feature);
                    });
                });
                buttons['allowAll'] = $button;


            }


            var generalDigitizerButtonsDiv = $("<div/>");
            generalDigitizerButtonsDiv.addClass("general-digitizer-buttons").addClass("right");

            $.each(buttons, function (i, button) {
                generalDigitizerButtonsDiv.append(button);

            });

            frame.append(generalDigitizerButtonsDiv);

            if (schema.showExtendSearchSwitch) {
                var $checkbox = $("<input type='checkbox' />");
                var title = Mapbender.DigitizerTranslator.translate('toolset.current-extent');
                $checkbox.attr('title', title);
                if (schema.currentExtentSearch) {
                    $checkbox.attr("checked", "checked");
                }
                $checkbox.change(function (e) {
                    schema.currentExtentSearch = !!$(e.originalEvent.target).prop("checked");
                    schema.getData();
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
        };


        var generateResultDataTable = function () {

            var generateResultDataTableButtons = function () {

                var buttons = [];

                if (schema.allowLocate) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.zoomTo'),
                        className: 'zoom',
                        cssClass: 'fa fa-crosshairs',
                        onClick: function (olFeature, ui) {
                            schema.zoomToJsonFeature(olFeature);
                        }
                    });
                }

                if (schema.allowEditData && schema.allowSave) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.save.title'),
                        className: 'save',
                        cssClass: ' fa fa-floppy-o',
                        disabled: true,
                        onClick: function (olFeature, ui) {
                            schema.saveFeature(olFeature);
                        }
                    });
                }

                if (schema.allowEditData) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                        className: 'edit',
                        onClick: function (olFeature, ui) {
                            schema.openFeatureEditDialog(olFeature);
                        }
                    });
                }
                if (schema.copy.enable) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                        className: 'clone',
                        cssClass: ' fa fa-files-o',
                        // TODO this might be still a bug
                        onClick: function (olFeature, ui) {
                            schema.copyFeature(olFeature);
                        }
                    });
                }
                if (schema.allowCustomerStyle) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                        className: 'style',
                        onClick: function (olFeature, ui) {
                            schema.openChangeStyleDialog(olFeature);
                        }
                    });
                }

                if (schema.allowChangeVisibility) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.visibility.toggleoff'),
                        className: 'visibility',
                        onClick: function (olFeature) {
                            schema.toggleFeatureVisibility(olFeature);
                        }
                    });
                }

                if (schema.allowPrintMetadata) {
                    buttons.push({
                        title: 'Sachdaten drucken',
                        className: 'printmetadata',
                        onClick: function (olFeature, ui, b, c) {
                            if (!olFeature.printMetadata) {
                                olFeature.printMetadata = true;
                                ui.addClass("active");
                            } else {
                                olFeature.printMetadata = false;
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
                        onClick: function (olFeature, ui) {
                            if (schema.getSchemaByFeature(olFeature).allowDelete) {
                                schema.removeFeature(olFeature);
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

                var createResultTableDataFunction = function(columnId) {

                    return function (row, type, val, meta) {
                        var data = row.data[columnId];
                        if (typeof (data) == 'string') {
                            data = data.escapeHtml();
                        }
                        return data;
                    };
                };


                $.each(schema.tableFields, function (fieldName, fieldSettings) {
                    fieldSettings.title = fieldSettings.label;
                    fieldSettings.data = fieldSettings.data || createResultTableDataFunction(fieldName);
                    if (fieldSettings.render) {
                        eval('fieldSettings.render = ' + fieldSettings.render);
                    }
                    columns.push(fieldSettings);
                });

                return columns;

            };


            var tableTranslation = schema.tableTranslation ? Mapbender.DigitizerTranslator.translateObject(schema.tableTranslation) : Mapbender.DigitizerTranslator.tableTranslations();

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
                buttons: generateResultDataTableButtons(),
                oLanguage: tableTranslation,
                drawCallback: function (settings) {
                    this.api().rows(function (idx, feature, row) {
                        if (feature.visible) {
                            $(row).removeClass('invisible-feature');
                            $(row).find(".icon-visibility").attr('title',Mapbender.DigitizerTranslator.translate('feature.visibility.toggleoff'));
                        } else {
                            $(row).addClass('invisible-feature');
                            $(row).find(".icon-visibility").attr('title',Mapbender.DigitizerTranslator.translate('feature.visibility.toggleon'));
                        }

                    });


                }

            };

            if (schema.view.settings) {
                _.extend(resultTableSettings, schema.view.settings);
            }

            var $div = $("<div/>");
            var $table = $div.resultTable(resultTableSettings);
            menu.resultTable = $table.resultTable("instance");

            menu.resultTable.initializeColumnTitles();


            frame.append($table);

        };


        var generateSearchForm = function () {

            var onSchemaSearchForm = function () {

                var widget = schema.widget;
                var searchForm = $('form.search', frame);

                var foreachItemTree = function (items, callback) {
                    _.each(items, function (item) {
                        callback(item);
                        if (item.children && $.isArray(item.children)) {
                            foreachItemTree(item.children, callback);
                        }
                    })
                };
                var elementUrl = widget.elementUrl;


                foreachItemTree(schema.search.form, function (item) {

                    if (item.type && item.type === 'select') {
                        if (item.ajax) {

                            // Hack to get display results as an HTML
                            item.escapeMarkup = function (m) {
                                return m;
                            };
                            // Replace auto-complete results with required key word
                            item.templateResult = function (d, selectDom, c) {
                                var html = d && (d.text || '');
                                if (d && d.id && d.text) {
                                    // Highlight results
                                    html = d.text.replace(new RegExp(ajax.lastTerm, "gmi"), '<span style="background-color: #fffb67;">\$&</span>');
                                }
                                return html;
                            };
                            var ajax = item.ajax;
                            ajax.dataType = 'json';
                            ajax.url = elementUrl + 'form/select';
                            ajax.data = function (params) {
                                if (params && params.term) {
                                    // Save last given term to get highlighted in templateResult
                                    ajax.lastTerm = params.term;
                                }
                                return {
                                    schema: schema.schemaName,
                                    item: item,
                                    form: searchForm.formData(),
                                    params: params
                                };
                            };

                        }
                    }
                });
                frame.generateElements({
                    type: 'form',
                    cssClass: 'search',
                    children: schema.search.form
                });
            };

            var onSchemaSearch = function () {
                var widget = schema.widget;
                var searchForm = $('form.search', frame);

                var onSubmitSearch = function (e) {
                    schema.search.request = searchForm.formData();
                    var xhr = schema.getData();

                    xhr.done(function () {
                        var olMap = widget.map;
                        olMap.zoomToExtent(layer.getDataExtent());
                        if (schema.search.zoomScale) {
                            olMap.zoomToScale(schema.search.zoomScale, true);
                        }
                    });

                    return false;
                };

                searchForm
                    .on('submit', onSubmitSearch)
                    .find(' :input')
                    .on('change', onSubmitSearch);
            };

            // If searching defined, then try to generate a form
            if (schema.search) {
                if (schema.search.form) {
                    onSchemaSearchForm();
                }
                onSchemaSearch();
            }

        };

        appendToolset();

        appendGeneralDigitizerButtons();

        generateSearchForm();

        frame.append('<div style="clear:both;"/>');

        generateResultDataTable();

        frame.hide();
    };


    Mapbender.Digitizer.Menu.prototype = {

        deactivateControls: function() {
            var menu = this;

            menu.toolSet.activeControl && menu.toolSet.activeControl.deactivate();

        }


    };

})();