!(function () {
    "use strict";

    /**
     * Utility method to escape HTML chars
     * @param {String} text
     * @returns {string}
     * @static
     */
    function escapeHtml(text) {
        'use strict';
        return text.replace(/["&'\/<>]/g, function (a) {
            return {
                '"': '&quot;', '&': '&amp;', "'": '&#39;',
                '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
            }[a];
        });
    }

    Mapbender.DataManager = Mapbender.DataManager || {};
    /**
     * @param {*} owner owning DataManager (jQueryUI widget instance)
     * @param {String} buttonsTemplate
     * @constructor
     */
    Mapbender.DataManager.TableRenderer = function TableRenderer(owner, buttonsTemplate) {
        this.owner = owner;
        this.scope = owner.element.get(0);
        this.buttonsTemplate = buttonsTemplate;
        this.buttonMarkupCache_ = {};
    }

    Object.assign(Mapbender.DataManager.TableRenderer.prototype, {
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {jQuery}
         */
        render: function(schema) {
            var settings = this.getOptions(schema);
            // var $tableWrap = $("<div/>").resultTable(settings);
            var $table = $('<table class="table table-striped">');
            $table.DataTable(settings);
            var $tableWrap = $('<div class="mapbender-element-result-table">');
            $tableWrap.append($table.closest('.dataTables_wrapper'));
            $tableWrap.attr('data-schema-name', schema.schemaName);
            return $tableWrap;
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Array<Object>} data
         */
        replaceRows: function(schema, data) {
            var dt = this.getDatatablesInstance_(schema);
            dt.clear();
            dt.rows.add(data);
            dt.draw();
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} item
         * @param {Boolean} show to automatically update pagination
         */
        addRow: function(schema, item, show) {
            var dt = this.getDatatablesInstance_(schema);
            var tr = dt.row.add(item).node();
            if (show) {
                this.showRow(schema, tr);
            }
        },
        /**
         * Deletes the row corresponding to item from the table.
         * Will maintain current pagination if there are still items on the current page.
         * NOTE: If the current page becomes empty, dataTables will automatically switch to the previous page.
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} item
         */
        removeRow: function(schema, item) {
            var dt = this.getDatatablesInstance_(schema);
            var dtRow = dt.row(function(_, data) {
                return data === item;
            });
            dtRow.remove();
            dt.draw(false);
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} item
         * @param {Boolean} show to automatically update pagination
         */
        refreshRow: function(schema, item, show) {
            var dt = this.getDatatablesInstance_(schema);
            var dtRow = dt.row(function(_, data) {
                return data === item;
            });
            dtRow.data(item);
            if (show) {
                this.showRow(schema, dtRow.node());
            }
        },
        /**
         * Switch pagination so the given tr element is on the current page
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Element} tr
         */
        showRow: function(schema, tr) {
            var dt = this.getDatatablesInstance_(schema);
            // NOTE: current dataTables versions could just do dt.row(tr).show().draw(false)
            var rowIndex = dt.rows({order: 'current'}).nodes().indexOf(tr);
            var pageLength = dt.page.len();
            var rowPage = Math.floor(rowIndex / pageLength);
            dt.page(rowPage);
            dt.draw(false);
        },
        /**
         * Get table DOM Element for schema. Must be in current document.
         *
         * @param {DataManagerSchemaConfig} schema
         * @return {Element|null}
         */
        findElement: function(schema) {
            // NOTE: Class mapbender-element-result-table added implicitly by vis-ui resultTable
            //       data-schema-name added by us (see render)
            var $tableWrap = $('.mapbender-element-result-table[data-schema-name="' + schema.schemaName + '"]', this.scope);
            return $tableWrap.get(0) || null;
        },
        /**
         * Get native dataTables instance for schema. Must be in current document.
         * @param {DataManagerSchemaConfig} schema
         * @return {Element|null}
         * @private
         */
        getDatatablesInstance_: function(schema) {
            var element = this.findElement(schema);
            if (!element) {
                throw new Error("Cannot access dataTables instance for schema " + schema.schemaName + ". Table not in DOM?")
            }
            // This works with or without vis-ui resultTable
            return $('table:first', element).dataTable().api();
        },
        /**
         * Returns options used to initialize resultTable widget.
         * @param {DataManagerSchemaConfig} schema
         * @return {Object}
         */
        getOptions: function(schema) {
            var columnsOption = this.getColumnsOption(schema);
            var buttonColumnOptions = this.getButtonColumnOptions(schema);
            if (buttonColumnOptions) {
                columnsOption.push(buttonColumnOptions);
            }
            var settings = {
                columns: columnsOption,
                lengthChange: false,
                pageLength: (schema.table || {}).pageLength || 16,
                searching: (schema.table || {}).searching || (typeof ((schema.table || {}).searching) === 'undefined'),
                info:         true,
                processing:   false,
                ordering:     true,
                paging:       true,
                selectable:   false,
                oLanguage: this.getOLanguageOption(schema),
                autoWidth:    false
            };
            settings.createdRow = this.onRowCreation.bind(this, schema);
            return settings;
        },
        getDisabledButtonsSelector: function(itemSchema) {
            return !itemSchema.allowDelete && '.-fn-delete' || null;
        },
        onRowCreation: function(tableSchema, tr, dataItem) {
            var schema = this.owner.getItemSchema(dataItem);
            $(tr).data({
                item: dataItem,
                schema: schema
            });
            $('.-fn-edit-data', tr).attr('title', Mapbender.trans(schema.allowEdit ? 'mb.actions.edit' : 'mb.data-manager.actions.show_details'));
            $('.btn', tr).not(this.buttonMarkupCache_[schema.schemaName].enabledSelector).prop('disabled', true);
        },
        initButtonMarkupCache_: function(tableSchema) {
            var functionCoverage = {};
            var subSchemas = this.owner.expandCombination(tableSchema);
            for (var s = 0; s < subSchemas.length; ++s) {
                if (subSchemas[s] !== tableSchema) {
                    this.initButtonMarkupCache_(subSchemas[s]);
                }
                var schemaFunctions = this.owner.getEnabledSchemaFunctionCodes(subSchemas[s]);
                for (var f = 0; f < schemaFunctions.length; ++f) {
                    var schemaFunction = schemaFunctions[f];
                    functionCoverage[schemaFunction] = (functionCoverage[schemaFunction] || []).concat(subSchemas[s].schemaName);
                }
            }
            var keepFunctions = Object.keys(functionCoverage);
            // Remove buttons not present in the any subschema of the combination
            var keepSelector = keepFunctions.length && keepFunctions.map(function(code) {
                return ['.', code].join('');
            }).join(',');
            var $remaining = $($.parseHTML(this.buttonsTemplate));
            $('.btn', $remaining).not(keepSelector).remove();
            var remainingMarkup = $remaining.get().map(function(node) {
                return node.outerHTML;
            }).join('');

            this.buttonMarkupCache_[tableSchema.schemaName] = {
                html: remainingMarkup,
                // Buttons present partially in some schemas, but not all, will
                // remain (to preserve grid layout sanity), but may be disabled
                // on a row-by-row basis
                enabledSelector: keepSelector
            };
        },
        defaultColumnRenderFn_: function(cellValue, type) {
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
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Array<Object>}
         * @see https://datatables.net/reference/option/columns
         */
        getColumnsOption: function(schema) {
            var columnConfigs = this.getColumnsConfigs(schema);
            var self = this;
            function getDefaultDataFn(schema, fieldName) {
                return function(item) {
                    return self.owner._getItemData(schema, item)[fieldName];
                };
            }
            return (columnConfigs).map(function(fieldSettings) {
                var option = Object.assign({}, fieldSettings);
                option.render = option.render || self.defaultColumnRenderFn_
                if (typeof (option.data) === 'string') {
                    option.data = getDefaultDataFn(schema, option.data);
                }
                return option;
            });
        },
        getDefaultColumnConfigs: function(schema) {
            var self = this;
            return [{
                data: function(row) {
                    return self.owner._getUniqueItemId(row);
                },
                title: 'Nr.',
                width: '1%'
            }];
        },
        getColumnsConfigs: function(schema) {
            var fieldConfigs = (schema.table || {}).columns || [];
            if (!fieldConfigs.length) {
                fieldConfigs = this.getDefaultColumnConfigs(schema);
            }
            for (var i = 0; i < fieldConfigs.length; ++i) {
                if (fieldConfigs[i].label && !fieldConfigs[i].title) {
                    fieldConfigs[i].title = fieldConfigs[i].label;
                    delete fieldConfigs[i].label;
                }
            }
            return fieldConfigs;
        },
        getButtonColumnOptions: function(tableSchema) {
            if (!this.buttonMarkupCache_[tableSchema.schemaName]) {
                this.initButtonMarkupCache_(tableSchema);
            }
            return {
                targets: -1,
                width: '1%',
                orderable: false,
                searchable: false,
                className: 'interface',
                defaultContent: this.buttonMarkupCache_[tableSchema.schemaName].html
            };
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {*}
         */
        getOLanguageOption: function(schema) {
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
    });
})();
