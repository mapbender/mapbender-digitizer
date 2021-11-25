(function () {
    "use strict";


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;
        var frame = menu.frame = $("<div />").addClass('frame').addClass('schema-'+schema.schemaName);


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


                    updateOnMove: function(feature,px)  {
                        return schema.updateOnMove(feature,px);
                    },

                    // Override
                    updateAfterMove: function(feature) {
                        return schema.updateAfterMove(feature);
                    },

                    onFeatureChange: schema.onFeatureChange.bind(schema),

                    getDefaultAttributes: function () {
                        return schema.getDefaultProperties();
                    },
                    preventModification: function (feature) {

                        var preventedByHooks = schema.evaluatedHooksForControlPrevention.onModificationStart && schema.evaluatedHooksForControlPrevention.onModificationStart(feature);
                        return preventedByHooks || !schema.getSchemaByFeature(feature).allowEditData;

                    },
                    preventMove: function (feature) {
                        var preventedByHooks =  schema.evaluatedHooksForControlPrevention.onStart && schema.evaluatedHooksForControlPrevention.onStart(feature);
                        return preventedByHooks || !schema.getSchemaByFeature(feature).allowEditData;
                    },

                    introduceFeature: schema.introduceFeature.bind(schema),

                    setModifiedState: schema.setModifiedState.bind(schema)
                }


            });


            if (schema.allowDigitize) {
                frame.append(menu.toolSet.element);
            }


        };


        var appendGeneralDigitizerButtons = function () {

            var buttons = {};

            if (schema.allowRefresh) {
                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-refresh");
                $button.attr("title", Mapbender.trans('mb.digitizer.refresh'));
                $button.click(function () {
                    var widget = schema.widget;
                    var dataManager = widget.getConnectedDataManager();
                    if (dataManager) {
                        $.each(dataManager.options.schemes, function (schemaName, scheme) {
                            dataManager._getData(scheme);
                        });
                    }
                    $.each(widget.schemes,function(schemaName,scheme){
                        scheme.lastRequest = null; // force reload
                        scheme.getData();
                    });
                    $.each(Mapbender.Model.map.olMap.layers.filter(function(layer) { return layer.mbConfig && layer.mbConfig.type === "wms"; }), function(id,layer)  {
                        layer.redraw(true);
                    });
                });
                buttons['refresh'] = $button;
            }
            if (schema.showVisibilityNavigation && schema.allowChangeVisibility) {

                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-eye-slash");
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.hideAll'));
                $button.click(function () {
                    schema.featureVisibility = false;
                    schema.setVisibilityForAllFeaturesInLayer();
                });
                buttons['hideAll'] = $button;

                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-eye");
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.showAll'));
                $button.click(function () {
                    schema.featureVisibility = true;
                    schema.setVisibilityForAllFeaturesInLayer();
                });
                buttons['showAll'] = $button;
            }
            if (schema.allowSaveAll) {

                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-floppy-o");
                $button.attr("title", Mapbender.trans('mb.digitizer.toolset.saveAll'));
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
                var title = Mapbender.trans('mb.digitizer.toolset.current-extent');
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
                        title: Mapbender.trans('mb.digitizer.feature.zoomTo'),
                        className: '--zoom',
                        cssClass: 'fa fas fa-crosshairs',
                        onClick: function (feature, ui) {
                            schema.zoomToFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData && schema.allowSaveInResultTable) {
                    buttons.push({
                        title: Mapbender.trans('mb.digitizer.feature.save.title'),
                        className: '--save',
                        cssClass: ' fa fa-floppy-o',
                        disabled: true,
                        onClick: function (feature, ui) {
                            schema.saveFeature(feature);
                        }
                    });
                }

                if (schema.allowEditData) {
                    buttons.push({
                        title: Mapbender.trans('mb.digitizer.feature.edit'),
                        className: '--edit',
                        cssClass: 'fa far fa-edit',
                        onClick: function (feature, ui) {
                            schema.openFeatureEditDialog(feature);
                        }
                    });
                }
                if (schema.allowEditData && schema.copy.enable) {
                    buttons.push({
                        title: Mapbender.trans('mb.digitizer.feature.clone.title'),
                        className: 'clone',
                        cssClass: ' fa fa-files-o',
                        onClick: function (feature, ui) {
                            schema.copyFeature(feature);
                        }
                    });
                }
                if (schema.allowCustomStyle) {
                    buttons.push({
                        title: Mapbender.trans('mb.digitizer.feature.style.change'),
                        className: '--style',
                        cssClass: 'fa fas fa-eyedropper',
                        onClick: function (feature, ui) {
                            schema.openChangeStyleDialog(feature);
                        }
                    });
                }

                if (schema.allowChangeVisibility) {
                    buttons.push({
                        title: Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'),
                        className: 'visibility',
                        cssClass: 'fa far fa-eye-slash',
                        onClick: function (feature, $btn) {
                            feature.visible = !feature.visible;
                            schema.layer.drawFeature(feature);
                            menu.updateRow($btn.closest('tr'), feature);
                        }
                    });
                }

                if (schema.allowPrintMetadata) {
                    buttons.push({
                        title: 'Sachdaten drucken',
                        className: 'printmetadata',
                        cssClass: 'fa fas fa-print',
                        onClick: function (feature, ui, b, c) {
                            if (!schema.getSchemaByFeature(feature).allowPrintMetadata) {
                                $.notify("Der Druck von Detailinformationen ist für Features dieses Schemas deaktiviert");
                                return;
                            }
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
                        title: Mapbender.trans('mb.digitizer.feature.remove.title'),
                        className: '--remove',
                        cssClass: 'critical fa fas fa-times',
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


            var tableTranslation = Mapbender.DigitizerTranslator.tableTranslations(schema.tableTranslation);

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
                createdRow: function(tr, feature) {
                    /** @see https://datatables.net/reference/option/createdRow */
                    var $tr = $(tr);
                    feature.__tr__ = tr;
                    $tr.data('feature', feature);
                    menu.initRow($tr, feature);
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
            menu.tableApi = $('table:first', $table).dataTable().api();

            menu.resultTable.initializeColumnTitles();


            frame.append($table);

        };


        appendToolset();

        appendGeneralDigitizerButtons();

        menu.generateSearchForm();

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
            return $('form.search', menu.frame).length > 0 ? $('form.search', menu.frame).formData() : void 0;
        },
        initRow: function($tr, feature) {
            var schema = this.schema.widget.getSchemaByName(feature.attributes.schemaName);
            $('.edit', $tr).prop('disabled', !schema.allowEditData);
            $('.clone', $tr).prop('disabled', !schema.allowEditData || !schema.copy.enable);
            $('.remove', $tr).prop('disabled', !schema.allowEditData || !schema.allowDelete);
            $('.style', $tr).prop('disabled', !schema.allowCustomStyle);
            this.updateRow($tr, feature);
        },
        updateRow: function($tr, feature) {
            // @todo: find interaction button by function, not by icon / exact markup
            var $displayToggle = $('.icon-visibility', $tr).closest('button');
            if (feature.visible) {
                $displayToggle.attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'));
            } else {
                $displayToggle.attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleon'));
            }
            $('.--save', $tr).prop('disabled', !feature.isChanged);
            $('.printmetadata', $tr).toggleClass('active', !!feature.printMetadata);
            $tr.toggleClass('invisible-feature', !feature.visible);
            $('.visibility', $tr)
                .toggleClass('fa-eye', !feature.visible)
                .toggleClass('fa-eye-slash', !!feature.visible)
            ;
        },
        pageToRow: function(tr) {
            var rowsOnOnePage = this.tableApi.page.len();

            var nodePosition = this.tableApi.rows({order: 'current'}).nodes().indexOf(tr);
            var pageNumber = Math.floor(nodePosition / rowsOnOnePage);
            this.tableApi.page(pageNumber).draw(false);
        },
        generateSearchForm: function () {
            var menu = this;
            var schema = menu.schema;
            if (schema.search.form) {
                menu.frame.generateElements({
                    type: 'form',
                    cssClass: 'search',
                    children: schema.search.form,
                });
            }
        },




    };



})();
