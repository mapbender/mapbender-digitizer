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
                        return schema.getDefaultProperties();
                    },
                    preventModification: function (feature) {

                        return schema.evaluatedHooksForControlPrevention.onModificationStart && schema.evaluatedHooksForControlPrevention.onModificationStart(feature);

                    },
                    preventMove: function (feature) {

                        return schema.evaluatedHooksForControlPrevention.onStart && schema.evaluatedHooksForControlPrevention.onStart(feature);

                    },
                    extendFeatureDataWhenNoPopupOpen: function (feature) {


                        if (schema.openFormAfterEdit) {
                            schema.openFeatureEditDialog(feature);
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
            if (schema.showVisibilityNavigation && schema.allowChangeVisibility) {

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
                        onClick: function (feature, ui) {
                            schema.zoomToJsonFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData && schema.allowSaveInResultTable) {
                    buttons.push({
                        title: Mapbender.DigitizerTranslator.translate('feature.save.title'),
                        className: 'save',
                        cssClass: ' fa fa-floppy-o',
                        disabled: true,
                        onClick: function (feature, ui) {
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
                if (schema.copy.enable) {
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
                        onClick: function (feature) {
                            schema.toggleFeatureVisibility(feature);
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
                            if (schema.getSchemaByFeature(feature).allowDelete) {
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

                var createResultTableDataFunction = function (columnId,fieldSettings) {

                    return function (feature, type, val, meta) {

                        var data = feature.data[columnId];
                        if (typeof (data) == 'string') {
                            data = data.escapeHtml();
                        }
                        return data || '';
                    };
                };


                $.each(schema.tableFields, function (columnId, fieldSettings) {
                    fieldSettings.title = fieldSettings.label;
                    fieldSettings.data = fieldSettings.data || createResultTableDataFunction(columnId,fieldSettings);
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
                            $(row).find(".icon-visibility").attr('title', Mapbender.DigitizerTranslator.translate('feature.visibility.toggleoff'));
                        } else {
                            $(row).addClass('invisible-feature');
                            $(row).find(".icon-visibility").attr('title', Mapbender.DigitizerTranslator.translate('feature.visibility.toggleon'));
                        }

                    });


                },
                // This may be needed to prevent autocomplete in search field / [google chrome]
                initComplete: function () {
                    //$(this.api().table().container()).find('input').parent().wrap('<form>').parent().attr('autocomplete', 'off');

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


            frame.generateElements({
                type: 'form',
                cssClass: 'search',
                children: schema.search.form
            });


        };

        appendToolset();

        appendGeneralDigitizerButtons();


        if (schema.search && schema.search.form) {
            generateSearchForm();
        }

        frame.append('<div style="clear:both;"/>');

        generateResultDataTable();

        frame.hide();
    };


    Mapbender.Digitizer.Menu.prototype = {

        deactivateControls: function () {
            var menu = this;

            menu.toolSet.activeControl && menu.toolSet.activeControl.deactivate();

        },

        getSearchData: function() {
            var menu = this;
            return  $('form.search', menu.frame).length > 0 ? $('form.search', menu.frame).formData() : void 0;
        }


    };

})();