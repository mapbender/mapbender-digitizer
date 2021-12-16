(function () {
    "use strict";

    /**
     * @param {String} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return str.replace(/["&'\/<>]/g, function (a) {
            return {
                '"': '&quot;',
                '&': '&amp;',
                "'": '&#39;',
                '/': '&#47;',
                '<': '&lt;',
                '>': '&gt;'
            }[a];
        });
    }

    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;
        var frame = menu.frame = $("<div />").addClass('frame').addClass('schema-'+schema.schemaName);
        this.appendToolset();
        this.appendGeneralDigitizerButtons();
        frame.append('<div style="clear:both;"/>');
        this.generateResultDataTable();
        frame.hide();
    };
    Object.assign(Mapbender.Digitizer.Menu.prototype, {
        appendToolset: function () {
            var menu = this;
            var schema = this.schema;
            var layer = schema.layer;

            var toolset = schema.toolset;

            menu.toolSet = new Mapbender.Digitizer.Toolset({
                buttons: toolset,
                schema: schema,
                layer: layer,
                geomType: schema.getGeomType()
            });

            if (schema.allowDigitize) {
                this.frame.append(this.toolSet.element);
            }
        },
        appendGeneralDigitizerButtons: function () {
            var schema = this.schema;
            var frame = this.frame;
            var buttons = {};

            if (schema.allowRefresh) {
                var $button = $("<button class='button' type='button'/>");
                $button.addClass("fa fa-refresh");
                $button.attr("title", Mapbender.trans('mb.digitizer.refresh'));
                $button.click(function () {
                    schema.widget.reloadData(schema);
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
                    schema.widget.reloadData(schema);
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
        redrawTable: function() {
            this.tableApi.rows().invalidate();
            this.tableApi.draw({paging: 'page'});
        },
        renderTableButtons: function(schema) {
            var $btn0 = $('<button type="button" class="button">');
            var $icon0 = $(document.createElement('i'));
            var buttons = [];
            if (schema.allowLocate) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.zoomTo'))
                    .addClass('-fn-zoom')
                    .append($icon0.clone().addClass('fa fas fa-crosshairs'))
                );
            }
            if (schema.allowEditData && schema.allowSaveInResultTable) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.save.title'))
                    .addClass('-fn-save')
                    .append($icon0.clone().addClass('fa fa-floppy-o'))
                );
            }
            if (schema.allowEditData) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.edit'))
                    .addClass('-fn-edit')
                    .append($icon0.clone().addClass('fa far fa-edit'))
                );
            }
            if (schema.allowEditData && schema.copy.enable) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.clone.title'))
                    .addClass('-fn-clone')
                    .append($icon0.clone().addClass('fa fa-files-o'))
                );
            }
            if (schema.allowCustomStyle) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.style.change'))
                    .addClass('-fn-edit-style')
                    .append($icon0.clone().addClass('fa fas fa-eyedropper'))
                );
            }
            if (schema.allowChangeVisibility) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'))
                    .addClass('-fn-toggle-visibility')
                    .append($icon0.clone().addClass('fa far fa-eye-slash'))
                );
            }
            if (schema.allowPrintMetadata) {
                buttons.push($btn0.clone()
                    .attr('title', 'Sachdaten drucken') // @todo: translations
                    .addClass('printmetadata')
                    .append($icon0.clone().addClass('fa fas fa-print'))
                );
            }
            if (schema.allowDelete) {
                buttons.push($btn0.clone()
                    .attr('title', Mapbender.trans('mb.digitizer.feature.remove.title'))
                    .addClass('-fn-delete critical')
                    .append($icon0.clone().addClass('fa fas fa-times'))
                );
            }
            for (var i = 0; i < buttons.length; ++i) {
                buttons[i].append($(document.createElement('span')).addClass('sr-only').text(buttons[i].attr('title')));
            }
            return $(document.createElement('div')).append(buttons).html();
        },
        generateResultDataTableColumns: function () {
            var schema = this.schema;
                var columns = [];

                var createResultTableDataFunction = function (columnId,fieldSettings) {
                    return function (feature, type, val, meta) {
                        var data = feature.data[columnId];
                        if (typeof (data) == 'string') {
                            data = escapeHtml(data);
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
        },
        generateResultDataTable: function () {
            var menu = this;
            var frame = this.frame;
            var schema = this.schema;
            var tableTranslation = Mapbender.DigitizerTranslator.tableTranslations(schema.tableTranslation);

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
                columns: this.generateResultDataTableColumns(),
                oLanguage: tableTranslation,
                createdRow: function(tr, feature) {
                    /** @see https://datatables.net/reference/option/createdRow */
                    var $tr = $(tr);
                    feature.__tr__ = tr;
                    $tr.data('feature', feature);
                    menu.initRow($tr, feature);
                },
                drawCallback: function() {
                    this.api().rows().every(function() {
                        menu.updateRow($(this.node()), this.data());
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

            var filterPlaceholder = this.getFilterPlaceholder(resultTableSettings.columns);
            // Add buttons column
            resultTableSettings.columnDefs = [{
                targets: -1,
                width: '1%',
                orderable: false,
                searchable: false,
                className: 'interactions text-nowrap text-right',
                defaultContent: this.renderTableButtons(schema)
            }];
            resultTableSettings.columns.push({
                data: null,
                title: ''
            });
            var $tableWrap = $(document.createElement('div')).addClass('mapbender-element-result-table');
            this.$table = $(document.createElement('table')).addClass('table table-striped table-hover');
            $tableWrap.append(this.$table);
            this.$table.dataTable(resultTableSettings);
            this.tableApi = menu.$table.dataTable().api();
            $('.dataTables_filter input', $tableWrap).attr('placeholder', filterPlaceholder);
            frame.append($tableWrap);
        },
        getFilterPlaceholder: function(columnsOptions) {
            var titles = [];
            for (var i = 0; i < columnsOptions.length; ++i) {
                var columnOptions = columnsOptions[i];
                if (columnOptions.title && columnOptions.searchable || typeof columnOptions.searchable === 'undefined') {
                    titles.push(columnOptions.title);
                }
            }
            return titles.join(', ');
        },
        deactivateControls: function () {
            var menu = this;

            menu.toolSet.activeControl && menu.toolSet.activeControl.deactivate();

        },

        initRow: function($tr, feature) {
            var schema = this.schema.widget.getSchemaByName(feature.attributes.schemaName);
            $tr.data('schema', schema);
            if (!schema.allowPrintMetadata) {
                $('.printmetadata', $tr).remove();
            }
            if (!schema.allowDelete) {
                $('.-fn-delete', $tr).remove();
            }

            $('.-fn-edit', $tr).prop('disabled', !schema.allowEditData || schema.disableAggregation);
            $('.-fn-clone', $tr).prop('disabled', !schema.allowEditData || !schema.copy.enable);
            $('.-fn-delete', $tr).prop('disabled', !schema.allowEditData || !schema.allowDelete);
            $('.-fn-edit-style', $tr).prop('disabled', !schema.allowCustomStyle || schema.disableAggregation);
            this.updateRow($tr, feature);
        },
        updateRow: function($tr, feature) {
            var $displayToggle = $('.-fn-toggle-visibility', $tr).closest('button');
            var schema = this.schema.widget.getSchemaByName(feature.attributes.schemaName);
            if (feature.visible) {
                $displayToggle.attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'));
            } else {
                $displayToggle.attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleon'));
            }
            $('.-fn-save', $tr).prop('disabled', !feature.isChanged || schema.disableAggregation);
            if (schema.disableAggregation) {
                $('.-fn-clone, .-fn-delete, .-fn-edit-style', $tr).prop('disabled', true);
            }
            $('.printmetadata', $tr).toggleClass('active', !!feature.printMetadata);
            $tr.toggleClass('invisible-feature', !feature.visible);
            $('> i', $displayToggle)
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
        replaceTableRows: function(features) {
            this.tableApi.clear();
            this.tableApi.rows.add(features);
            this.tableApi.draw();
        },
        removeTableRow: function(feature) {
            if (feature && feature.__tr__) {
                this.tableApi.row(feature.__tr__).remove().draw();
            }
        },
        initializeTableEvents: function(schema) {
            var menu = this;
            this.$table.on('mouseenter', '> tbody > tr', function() {
                var $tr = $(this);
                var feature = $tr.data('feature');
                if (feature) {
                    $tr.addClass('hover');
                    feature.isHighlighted = true;
                    if (feature.layer) {
                        feature.layer.drawFeature(feature);
                    }
                }
            });
            this.$table.on('mouseleave', '> tbody > tr', function() {
                var $tr = $(this);
                var feature = $tr.data('feature');
                $tr.removeClass('hover');
                if (feature) {
                    feature.isHighlighted = false;
                    if (feature.layer) {
                        feature.layer.drawFeature(feature);
                    }
                }
            });
            this.$table.on('click', '> tbody > tr', function(evt) {
                if ($(evt.target).closest('button', this).length) {
                    // Click bubbled from (disabled) button => ignore
                    return false;
                }
                var feature = $(this).data('feature');
                if (schema.selectControl) {
                    schema.selectControl.highlight(feature, true);
                    if (feature) {
                        schema.doDefaultClickAction(feature);
                    }
                }
            });
            this.$table.on('click', 'tbody .-fn-zoom', function() {
                var feature = $(this).closest('tr').data('feature');
                schema.zoomToFeature(feature);
                return false;
            });
            this.$table.on('click', 'tbody .-fn-save', function() {
                var feature = $(this).closest('tr').data('feature');
                schema.saveFeature(feature);
                return false;
            });
            this.$table.on('click', 'tbody .-fn-edit', function() {
                var feature = $(this).closest('tr').data('feature');
                schema.openFeatureEditDialog(feature);
                return false;
            });

            this.$table.on('click', 'tbody .-fn-clone', function() {
                var feature = $(this).closest('tr').data('feature');
                schema.copyFeature(feature);
                return false;
            });
            this.$table.on('click', 'tbody .-fn-edit-style', function() {
                var feature = $(this).closest('tr').data('feature');
                schema.openChangeStyleDialog(feature);
                return false;
            });
            this.$table.on('click', 'tbody .-fn-toggle-visibility', function() {
                var $row = $(this).closest('tr');
                var feature = $row.data('feature');
                feature.visible = !feature.visible;
                schema.layer.drawFeature(feature);
                menu.updateRow($row, feature);
                return false;
            });
            this.$table.on('click', 'tbody .printmetadata', function() {
                var $btn = $(this);
                var feature = $btn.closest('tr').data('feature');
                feature.printMetadata = !feature.printMetadata;
                $btn.toggleClass('active', feature.printMetadata);
                return false;
            });
            this.$table.on('click', 'tbody .-fn-delete', function() {
                var feature = $(this).closest('tr').data('feature');
                schema.widget.deleteFeature(feature);
                return false;
            });
        }
    });
})();
