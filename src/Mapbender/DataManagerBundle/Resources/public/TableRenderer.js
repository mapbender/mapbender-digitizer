!(function () {
    "use strict";
    Mapbender.DataManager = Mapbender.DataManager || {};
    /**
     * @param {*} owner owning DataManager (jQueryUI widget instance)
     * @param {Element|jQuery} [scope]
     * @constructor
     */
    Mapbender.DataManager.TableRenderer = function TableRenderer(owner, scope) {
        this.owner = owner;
        this.scope = scope || owner.element.get(0);
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
                pageLength: schema.table.pageLength,
                searching: schema.table.searching,
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
        onRowCreation: function(schema, tr, dataItem) {
            $(tr).data({
                item: dataItem,
                schema: schema
            });
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Array<Object>}
         */
        getButtonsOption: function(schema) {
            var buttons = [];
            // NOTE: "edit" interaction is always added even with "allowEdit" schema config false. Without "allowEdit",
            //       the dialog will not have a save button, but it will still function as an attribute data viewer.
            buttons.push({
                title: Mapbender.trans(schema && schema.allowEdit ? 'mb.actions.edit' : 'mb.data-manager.actions.show_details'),
                cssClass: 'fa fa-edit -fn-edit-data btn-default'
            });

            if (schema.allowDelete) {
                buttons.push({
                    title: Mapbender.trans('mb.actions.delete'),
                    cssClass: 'critical fa fa-times -fn-delete btn-danger'
                });
            }
            return buttons;
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Array<Object>}
         * @see https://datatables.net/reference/option/columns
         */
        getColumnsOption: function(schema) {
            var columnConfigs = this.getColumnsConfigs(schema);
            var escapeHtml = this.escapeHtml;
            var self = this;
            return (columnConfigs).map(function(fieldSettings) {
                return $.extend({}, fieldSettings, {
                    fieldName: fieldSettings.data,  // why?
                    render: function(data, type, row) {
                        var rowData = self.owner._getItemData(schema, row);
                        var cellValue = rowData[fieldSettings.data];
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
                });
            });
        },
        renderButtonColumnContent: function(schema) {
            var rowButtons = this.renderRowButtons(schema);
            if (rowButtons.length) {
                return $('<div class="btn-group">')
                    .append(rowButtons)
                    .get(0)
                ;
            } else {
                return null;
            }
        },
        renderRowButtons: function(schema) {
            var buttonConfigs = this.getButtonsOption(schema);
            return buttonConfigs.map(function(buttonConfig) {
                var allClasses = (buttonConfig.cssClass || '').split(/\s+/);
                var buttonClasses = allClasses.filter(function(cls) {
                    return cls && !(/^(icon|fa)/.test(cls));
                });
                var iconClasses = allClasses.filter(function(cls) {
                    return cls && (/^(icon|fa)/.test(cls));
                });
                var $icon = $(document.createElement('i'))
                    .addClass(iconClasses.join(' '))
                ;
                var $button = $(document.createElement('button'))
                    .attr({
                        type: 'button',
                        title: buttonConfig.title
                    })
                    .addClass(buttonClasses.join(' '))
                    .addClass('btn')
                    .append($icon)
                ;
                var colorClasses = buttonClasses.filter(function(cls) {
                    return /^(btn-)/.test(cls);
                });
                if (!colorClasses.length) {
                    $button.addClass('btn-default');
                }
                return $button.get(0);
            });
        },
        getDefaultColumnConfigs: function(schema) {
            var tableFields = [];

            tableFields.push({
                data: this.owner._getUniqueItemIdProperty(schema),
                title: 'Nr.',
                width: '20%'
            });
            return tableFields;
        },
        getColumnsConfigs: function(schema) {
            var fieldConfigs = (schema.table || {}).columns || [];
            if (!fieldConfigs.length) {
                fieldConfigs = this.getDefaultColumnConfigs(schema);
            }
            return fieldConfigs;
        },
        getButtonColumnOptions: function(schema) {
            var interfaceElement = this.renderButtonColumnContent(schema).outerHTML;
            return interfaceElement && {
                className: 'interface',
                render: function(val, type) {
                    if (type === 'display') {
                        return interfaceElement;
                    } else {
                        return null;
                    }
                },
                sortable: false
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
        },
        /**
         * Utility method to escape HTML chars
         * @param {String} text
         * @returns {string}
         * @static
         * @todo: eliminate duplicated code (extra utility namespace?)
         */
        escapeHtml: function escapeHtml(text) {
            'use strict';
            return text.replace(/["&'\/<>]/g, function (a) {
                return {
                    '"': '&quot;', '&': '&amp;', "'": '&#39;',
                    '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
                }[a];
            });
        }
    });
})();
