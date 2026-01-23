(function () {
    "use strict";

    /**
     * Utility method to escape HTML chars
     * @param {String} text
     * @returns {string}
     * @static
     */
    function escapeHtml(text) {
        return text.replace(/["&'\/<>]/g, function (a) {
            return {
                '"': '&quot;', '&': '&amp;', "'": '&#39;',
                '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
            }[a];
        });
    }

    Mapbender.DataManager = Mapbender.DataManager || {};

    /**
     * Table renderer class for rendering data tables
     */
    class TableRenderer {
        /**
         * @param {*} owner owning DataManager (jQueryUI widget instance)
         * @param {String} buttonsTemplate
         */
        constructor(owner, buttonsTemplate) {
            this.owner = owner;
            this.scope = owner.$element.get(0);
            this.buttonsTemplate = buttonsTemplate;
            this.buttonMarkupCache_ = {};
            this.editableFieldsCache_ = {};
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {jQuery}
         */
        render(schema) {
            const settings = this.getOptions(schema);
            const $table = $('<table class="table table-striped table-hover -js-items">');
            $table.on('draw.dt', function () {
                $('ul.pagination').addClass('pagination-sm');
            }).DataTable(settings);
            const $tableWrap = $('<div class="mapbender-element-result-table">');
            $tableWrap.append($table.closest('.dataTables_wrapper'));
            $tableWrap.attr('data-schema-name', schema.schemaName);
            return $tableWrap;
        }

        /**
         * @param {Array<Object>} data
         */
        replaceRows(data) {
            const dt = this.getDatatablesInstance_();
            dt.clear();
            dt.rows.add(data);
            dt.draw();
        }

        /**
         * @param {Object} item
         * @param {Boolean} show to automatically update pagination
         */
        addRow(item, show) {
            const dt = this.getDatatablesInstance_();
            const tr = dt.row.add(item).node();
            if (show) {
                this.showRow(tr);
            }
        }

        /**
         * Deletes the row corresponding to item from the table.
         * Will maintain current pagination if there are still items on the current page.
         * NOTE: If the current page becomes empty, dataTables will automatically switch to the previous page.
         *
         * @param {Object} item
         */
        removeRow(item) {
            const dt = this.getDatatablesInstance_();
            const dtRow = dt.row(function(_, data) {
                return data === item;
            });
            dtRow.remove();
            dt.draw(false);
        }

        /**
         * @param {Object} item
         * @param {Boolean} show to automatically update pagination
         */
        refreshRow(item, show) {
            const dt = this.getDatatablesInstance_();
            const dtRow = dt.row(function(_, data) {
                return data === item;
            });
            dtRow.data(item);
            if (show) {
                this.showRow(dtRow.node());
            }
        }

        /**
         * @param {Object} item
         * @param {Boolean} show to automatically update pagination
         */
        addOrRefreshRow(item, show) {
            const dt = this.getDatatablesInstance_();

            const rowExists = dt.rows(function(_, data) {
                return data === item;
            }).count() > 0;

            if (rowExists) {
                this.refreshRow(item, show);
            } else {
                this.addRow(item, show);
            }
        }

        /**
         * Switch pagination so the given tr element is on the current page
         *
         * @param {Element} tr
         */
        showRow(tr) {
            const dt = this.getDatatablesInstance_();
            // NOTE: current dataTables versions could just do dt.row(tr).show().draw(false)
            const rowIndex = dt.rows({order: 'current'}).nodes().indexOf(tr);
            const pageLength = dt.page.len();
            const rowPage = Math.floor(rowIndex / pageLength);
            dt.page(rowPage);
            dt.draw(false);
        }

        /**
         * Get dataTables api instance
         * @return {Element|null}
         * @private
         */
        getDatatablesInstance_() {
            return $('table.-js-items:first', this.scope).dataTable().api();
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Object}
         */
        getOptions(schema) {
            const columnsOption = this.getColumnsOption(schema);
            const buttonColumnOptions = this.getButtonColumnOptions(schema);
            if (buttonColumnOptions) {
                columnsOption.push(buttonColumnOptions);
            }

            const settings = {
                columns: columnsOption,
                lengthChange: false,
                pageLength: schema.pageLength || 16,
                searching: schema.inlineSearch ?? true,
                info:         true,
                processing:   false,
                ordering:     true,
                paging:       schema.paging ?? true,
                selectable:   false,
                oLanguage: this.getOLanguageOption(schema),
                autoWidth:    false,
                language: {
                    paginate: {
                        previous: '<<',
                        next: '>>'
                    }
                }
            };
            settings.createdRow = this.onRowCreation.bind(this, schema);
            return settings;
        }

        /**
         * @param {Object} itemSchema
         * @return {String|null}
         */
        getDisabledButtonsSelector(itemSchema) {
            return !itemSchema.allowDelete && '.-fn-delete' || null;
        }

        /**
         * @param {Object} tableSchema
         * @param {Element} tr
         * @param {Object} dataItem
         */
        onRowCreation(tableSchema, tr, dataItem) {
            const schema = this.owner.getItemSchema(dataItem);
            $(tr).data({
                item: dataItem,
                schema: schema
            });
            
            // Use cached value for whether form has editable fields
            const hasEditableFields = this.editableFieldsCache_[schema.schemaName];
            const $editButton = $('.-fn-edit-data', tr);
            const $icon = $('i', $editButton);
            
            // Set icon and tooltip based on whether form is editable
            if (hasEditableFields && schema.allowEdit) {
                $editButton.attr('title', Mapbender.trans('mb.actions.edit'));
                $icon.removeClass('fa-search').addClass('fa-edit fa-pen');
            } else {
                $editButton.attr('title', Mapbender.trans('mb.data-manager.actions.show_details'));
                $icon.removeClass('fa-edit fa-pen').addClass('fa-search');
            }
            $('.btn', tr).not(this.buttonMarkupCache_[schema.schemaName].enabledSelector).prop('disabled', true);
        }

        /**
         * @param {Object} tableSchema
         * @private
         */
        initButtonMarkupCache_(tableSchema) {
            const functionCoverage = {};
            const subSchemas = this.owner.expandCombination(tableSchema);
            for (let s = 0; s < subSchemas.length; ++s) {
                if (subSchemas[s] !== tableSchema) {
                    this.initButtonMarkupCache_(subSchemas[s]);
                }
                const schemaFunctions = this.owner.getEnabledSchemaFunctionCodes(subSchemas[s]);
                for (let f = 0; f < schemaFunctions.length; ++f) {
                    const schemaFunction = schemaFunctions[f];
                    functionCoverage[schemaFunction] = (functionCoverage[schemaFunction] || []).concat(subSchemas[s].schemaName);
                }
            }
            const keepFunctions = Object.keys(functionCoverage);
            // Remove buttons not present in any subschema of the combination
            const keepSelector = keepFunctions.length && keepFunctions.map(function(code) {
                return ['.', code].join('');
            }).join(',');
            const $remaining = $($.parseHTML(this.buttonsTemplate));
            $('.btn', $remaining).not(keepSelector).remove();
            const remainingMarkup = $remaining.get().map(function(node) {
                return node.outerHTML;
            }).join('');

            this.buttonMarkupCache_[tableSchema.schemaName] = {
                html: remainingMarkup,
                // Buttons present partially in some schemas, but not all, will
                // remain (to preserve grid layout sanity), but may be disabled
                // on a row-by-row basis
                enabledSelector: keepSelector
            };
            
            // Cache whether this schema has editable fields (calculated once per schema)
            this.editableFieldsCache_[tableSchema.schemaName] = this.owner.formRenderer_.hasEditableFields(tableSchema.formItems || []);
        }

        /**
         * @param {*} cellValue
         * @param {String} type
         * @return {*}
         * @private
         */
        defaultColumnRenderFn_(cellValue, type) {
            switch (type) {
                case 'sort':
                case 'type':
                default:
                    return cellValue;
                case 'filter':
                    return ('' + cellValue) || '';
                case 'display':
                    return cellValue !== null ? escapeHtml('' + cellValue) : '';
            }
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Array<Object>}
         * @see https://datatables.net/reference/option/columns
         */
        getColumnsOption(schema) {
            const columnConfigs = this.getColumnsConfigs(schema);
            const self = this;
            function getDefaultDataFn(schema, fieldName) {
                return function(item) {
                    return self.owner._getItemData(item)[fieldName];
                };
            }
            return (columnConfigs).map(function(fieldSettings) {
                const option = Object.assign({}, fieldSettings);
                option.render = option.render || self.defaultColumnRenderFn_
                if (typeof (option.data) === 'string') {
                    option.data = getDefaultDataFn(schema, option.data);
                }
                return option;
            });
        }

        /**
         * @param {Object} schema
         * @return {Array<Object>}
         */
        getDefaultColumnConfigs(schema) {
            const self = this;
            if (schema.combine) {
                let commonDataNames = [];
                const subSchemas = this.owner.expandCombination(schema);
                for (let s = 0; s < subSchemas.length; ++s) {
                    const subschemaColumns = this.getColumnsConfigs(subSchemas[s]);
                    const dataNames = subschemaColumns.map(function(c) {
                        return c.data;
                    });
                    if (s === 0) {
                        commonDataNames = dataNames.slice();
                    } else {
                        commonDataNames = commonDataNames.filter(function(name) {
                            return -1 !== dataNames.indexOf(name);
                        });
                    }
                }
                return this.getColumnsConfigs(subSchemas[0]).filter(function(c) {
                    return -1 !== commonDataNames.indexOf(c.data);
                });
            }
            return [{
                data: function(row) {
                    return self.owner._getUniqueItemId(row);
                },
                title: 'Nr.',
                width: '1%',
                className: 'text-right no-clip'
            }];
        }

        /**
         * @param {Object} schema
         * @return {Array<Object>}
         */
        getColumnsConfigs(schema) {
            const fieldConfigs = (schema.table || {}).columns || [];
            if (!fieldConfigs.length) {
                return this.getDefaultColumnConfigs(schema);
            }
            for (let i = 0; i < fieldConfigs.length; ++i) {
                if (fieldConfigs[i].label && !fieldConfigs[i].title) {
                    fieldConfigs[i].title = fieldConfigs[i].label;
                    delete fieldConfigs[i].label;
                }
            }
            return fieldConfigs;
        }

        /**
         * @param {Object} tableSchema
         * @return {Object}
         */
        getButtonColumnOptions(tableSchema) {
            if (!this.buttonMarkupCache_[tableSchema.schemaName]) {
                this.initButtonMarkupCache_(tableSchema);
            }
            return {
                targets: -1,
                width: '1%',
                orderable: false,
                searchable: false,
                className: 'interface no-clip',
                defaultContent: this.buttonMarkupCache_[tableSchema.schemaName].html
            };
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {*}
         */
        getOLanguageOption(schema) {
            return {
                // @see https://legacy.datatables.net/usage/i18n
                sSearch: Mapbender.trans('mb.data-manager.table.filter') + ':',
                sEmptyTable: Mapbender.trans('mb.data-manager.table.empty'),
                sZeroRecords: Mapbender.trans('mb.data-manager.table.empty_after_filtering'),
                sInfoEmpty: Mapbender.trans('mb.data-manager.table.empty'),
                sInfo: Mapbender.trans('mb.data-manager.table.from_to_total'),
                sInfoFiltered: Mapbender.trans('mb.data-manager.table.out_of')
            };
        }
    }

    Mapbender.DataManager.TableRenderer = TableRenderer;
})();
