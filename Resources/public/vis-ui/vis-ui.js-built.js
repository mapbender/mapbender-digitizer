/**
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 25.08.2015 by WhereGroup GmbH & Co. KG
 */

window.DataUtil = new function() {

    var self = this;

    /**
     * Check and replace values recursive if they should be translated.
     * For checking used "translationReg" variable
     *
     *
     * @param items
     */
    self.eachItem = function(items, callback) {
        var isArray = items instanceof Array;
        if(isArray) {
            for (var k in items) {
                self.eachItem(items[k], callback);
            }
        } else {
            if(typeof items["type"] !== 'undefined') {
                callback(items);
            }
            if(typeof items["children"] !== 'undefined') {
                self.eachItem(items["children"], callback);
            }
        }
    };

    /**
     * Check if object has a key
     *
     * @param obj
     * @param key
     * @returns {boolean}
     */
    self.has = function(obj, key) {
        return typeof obj[key] !== 'undefined';
    };

    /**
     * Get value from object by the key or return default given.
     *
     * @param obj
     * @param key
     * @param defaultValue
     * @returns {*}
     */
    self.getVal = function(obj, key, defaultValue) {
        return has(obj, key) ? obj[key] : defaultValue;
    }
};
/**
 * String Helper library
 *
 * Using example:
 *      StringHelper.parseHttpRequest( location.href.split('#')[1] );
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 27.01.2015 by WhereGroup GmbH & Co. KG
 */
window.StringHelper = new function() {

    var self = this;
    var reKeys = /[^\[\]]+/g;
    var reTiles = /[^=\?\&]+/g;

    /**
     * Get matched groups by RegExp
     *
     * @param reg
     * @param text
     * @return {Array}
     */
    self.matchGroups = function(reg, text) {
        var match;
        var result = [];
        while (match = reg.exec(text)) {
            result.push(match[0]);
        }
        return result;
    };

    /**
     * Cast string value to native type
     *
     * @param val
     * @return {*}
     */
    self.castValue = function(val) {
        var r;
        if(val == "false") {
            r = false;
        } else if(val == "true") {
            r = true;
        } else if(!isNaN(val)) {
            r = parseInt(val);
        } else {
            r = val;
        }
        return r;
    };

    /**
     * Parse and return HTTP request as an object
     *
     * @param url
     * @return {{}}
     */
    self.parseHttpRequest = function(uri) {
        var matches = uri ? self.matchGroups(reTiles, uri) : {};
        var len = matches.length;
        var result = {};
        var key, keyLength, subResult, keys, value, z, i;

        for (i = 0; i < len; i += 2) {
            keys = self.matchGroups(reKeys, matches[i]);
            value = self.castValue(matches[i + 1]);
            subResult = result;
            keyLength = keys.length;
            for (z = 0; z < keyLength; z++) {
                key = keys[z];
                if(z == keyLength - 1) {
                    subResult[key] = value;
                } else if(!subResult.hasOwnProperty(key)) {
                    subResult[key] = {};
                }
                subResult = subResult[key];
            }
        }
        return result;
    };
};
/**
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 */
/**
 * Form helper plugin for jQuery
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 02.02.2015 by WhereGroup GmbH & Co. KG
 *
 */
$.fn.formData = function(values) {
    var form = $(this);
    var inputs = $(':input', form).get();
    var hasNewValues = typeof values == 'object';
    var textElements = $(".form-group.text", form);


    if (hasNewValues) {

        $.each(textElements, function() {
            var textElementContainer = $(this);
            var textElement = $('.text', textElementContainer);
            var declaration = textElementContainer.data('item');
            if(declaration.hasOwnProperty('text')) {
                if (typeof declaration.text === 'function') {
                    textElement.html(declaration.text(values));
                } else {
                    var html = "";
                    try {
                        var data = values;
                        eval('html=' + declaration.text + ';');
                    } catch (e) {
                        console.error("The defenition", declaration, " of ", textElement, ' is erroneous.', e);
                    }
                    textElement.html(html);
                }
            }
        });

        $.each(inputs, function() {
            var input = $(this);
            var value = values[this.name];
            var declaration = input.data('declaration');

            if(values.hasOwnProperty(this.name)) {

                switch (this.type) {
                    case 'select-multiple':
                        //var declaration = input.data('declaration');
                        var type = declaration.fieldType ? declaration.fieldType : 'text';

                        if(type == 'text' && value ) {
                            var separator = declaration.separator ? declaration.separator : ',';
                            var vals = $.isArray(value) ? value : value.split(separator);
                            $.each(vals, function(i, optionValue) {
                                $("option[value='" + optionValue + "']", input).prop("selected", true);
                            });
                            if(input.select2){
                                input.select2();
                            }
                        } else {
                            input.val(value);
                        }
                        break;

                    case 'checkbox':
                        input.prop('checked', value !== null && value);
                        break;
                    case 'radio':
                        if (value === null) {
                            input.prop('checked', false);
                        } else if (input.val() == value) {
                            input.prop("checked", true);
                        }
                        break;
                    case 'hidden':
                        input.val(value);
                        input.trigger('change');
                        break;

                    case 'text':
                        if(input.hasClass('hasDatepicker')) {
                            var dateFormat = input.datepicker("option", "dateFormat");

                            if(value === '' || value === 0 || value === '0') {
                                value = null;
                            }
                            // if(value !== null) {
                                // value = $.datepicker.formatDate(dateFormat, $.datepicker.parseDate(dateFormat, value))
                            // }

                            input.datepicker("setDate", value);
                            input.datepicker("refresh");
                        } else {
                            input.val(value);
                        }
                        break;
                    default:
                        input.val(value);
                }
                input.trigger('filled', {
                    data:   values,
                    value:  value
                });
                input.trigger("changeValue");

            }
        });
        return form;
    } else {
        values = {};
        var firstInput;
        $.each(inputs, function() {
            var input = $(this);
            var value;
            var declaration = input.data('declaration');

            if(this.name == ""){
                return;
            }

            switch (this.type) {
                case 'checkbox':
                case 'radio':
                    if(values.hasOwnProperty(this.name) && values[this.name] != null){
                        return;
                    }
                    value = input.is(':checked') ? input.val() : null;
                    break;
                default:
                    value = input.val();
            }

            if(value === ""){
                value = null;
            }

            if(values !== false && declaration){
                if(declaration.hasOwnProperty('mandatory') && declaration.mandatory ){
                    var isDataReady = false;
                    if(typeof declaration.mandatory === "function"){
                        isDataReady = declaration.mandatory(input, declaration, value);
                    } else{
                        isDataReady = input.data('warn')(value);
                    }
                    if(!isDataReady && !firstInput && input.is(":visible")){
                        firstInput = input;
                        input.focus();
                    }
                }
                values[this.name] = value;
            }else{
                values[this.name] = value;
            }

        });
        return values;
    }
};

$.fn.disableForm = function() {
    var form = this;
    var inputs = $(" :input", form);
    form.attr('readonly', true);
    form.css('cursor', 'wait');
    $.each(inputs, function(idx, el) {
        var $el = $(el);
        if($el.is(':checkbox') || $el.is(':radio') || $el.is('select')) {
            $el.attr('disabled', 'disabled');
        } else {
            $el.attr('readonly', 'true');
        }
    })
};

$.fn.enableForm = function() {
    var form = this;
    var inputs = $(" :input", form);
    form.css('cursor', '');
    $.each(inputs, function(idx, el) {
        var $el = $(el);
        if($el.is(':checkbox') || $el.is(':radio') || $el.is('select')) {
            $el.removeAttr('disabled', 'disabled');
        } else {
            $el.removeAttr('readonly', 'true');
        }
    })
};



/**
 * Confirm dialog
 *
 * Example:
 *     confirmDialog({html: "Remove?", title: "Please confirm!", onSuccess:function(){
                  return false;
       }});
 * @param options
 * @returns {*}
 */
window.confirmDialog = function(options) {
    var dialog = $("<div class='confirm-dialog'>" + (options.hasOwnProperty('html') ? options.html : "") + "</div>").popupDialog({
        title:       options.hasOwnProperty('title') ? options.title : "",
        maximizable: false,
        dblclick:    false,
        minimizable: false,
        resizable:   false,
        collapsable: false,
        modal:       true,
        buttons:     [{
            text:  "OK",
            click: function(e) {
                if(!options.hasOwnProperty('onSuccess') || options.onSuccess(e) !== false) {
                    dialog.popupDialog('close');
                }
                return false;
            }
        }, {
            text:    "Cancel",
            'class': 'critical',
            click:   function(e) {
                if(!options.hasOwnProperty('onCancel') || options.onCancel(e) !== false) {
                    dialog.popupDialog('close');
                }
                return false;
            }
        }]
    });
    return dialog;
};
(function($) {
    /**
     * Mapbender result table element.
     * Uses DataTables API
     *
     * @see http://datatables.net/reference/api/
     *
     * @example $('<div/>').resultTable( lengthChange: false,
     searching:    false,
     info:         false,
     columns:      [{data: 'id', title: 'ID'}, {data: 'label', title: 'Title'}],
     data:         [{id: 1, label: 'example'}]
     */
    $.widget("vis-ui-js.resultTable", {

        _table:     null,
        _dataTable: null,
        _selection: null,

        /**
         * Constructor.
         *
         * @private
         */
        _create: function() {
            var widget = this;
            var el = $(widget.element);
            var table = widget._table = $('<table class="table table-striped table-hover"></table>');
            var options = widget.options;
            var isSelectable = _.has(options, 'selectable') && options.selectable;
            var hasBottomNavigation = _.has(options, 'bottomNavigation') && _.isArray(options.bottomNavigation);
            var hasRowButtons = options.hasOwnProperty('buttons');
            var dataTableContainer = null;

            el.append(table);
            el.addClass('mapbender-element-result-table');

            if(isSelectable) {
                widget._addSelection();
            }

            if(hasRowButtons) {
                widget._addButtons(options.buttons);
            }
            var dataTable = widget._dataTable = table.DataTable($.extend({
                "oLanguage": {
                    sEmptyTable: "0 / 0",
                    sInfo:      "_START_ / _END_ (_TOTAL_)",
                    "oPaginate": {
                        "sSearch":   "Filter:",
                        "sNext":     "Weiter",
                        "sPrevious": "Zurück"
                    }
                }
            },options));

            dataTableContainer = table.closest('.dataTables_wrapper');
            dataTableContainer.find('.dataTables_paginate a').addClass('button');

            if(isSelectable) {

                var selectionManager = widget.getSelection();

                dataTable.on('page', function() {

                    $.each(dataTable.$('tr'), function() {
                        var tr = this;
                        var rowData = widget.getDataByRow(tr);
                        var foundData = null;

                        $.each(selectionManager.list,function(){
                            var selectedData = this;
                            if(rowData == selectedData){
                                foundData = selectedData;
                                return false;
                            }
                        });

                        var $tr = $(tr);
                        var checkbox = $('td.selection input[type=checkbox]', $tr);

                        if(foundData) {
                            checkbox.prop('checked', true);
                            $tr.addClass('warning');
                        }else{
                            checkbox.prop('checked', false);
                            $tr.removeClass('warning');
                        }
                    });
                });

                selectionManager.on('add', function(data) {
                    var tr = widget.getRowByData(data);
                    if(!tr){
                        return;
                    }
                    var checkbox = $('td.selection input[type=checkbox]', tr);
                    checkbox.prop('checked', true);
                    tr.addClass('warning');
                }).on('remove', function(data) {
                    var tr = widget.getRowByData(data);
                    if(!tr){
                        return;
                    }
                    $('td.selection input[type=checkbox]', tr).prop('checked', false);
                    tr.removeClass('warning');
                });

                $(table).delegate("tbody>tr[role='row']", 'click', function(e) {
                    var tr = $(this);
                    var isSelected = !tr.hasClass('warning');
                    var data = dataTable.row(this).data();

                    if(isSelected) {
                        selectionManager.add(data);
                    } else {
                        selectionManager.remove(data);
                    }
                });
            }

            if(hasRowButtons) {
                $.each(options.buttons, function(idx, button) {
                    if(!button.hasOwnProperty('onClick') && !button.hasOwnProperty('click'))
                        return;

                    $(table).delegate("tbody>tr[role='row'] button." + button.className, 'click', function(e) {
                        var $button = $(this);
                        var data = dataTable.row($button.closest('tr')[0]).data();
                        e.stopPropagation();
                        if(button.click && typeof button.click == "function"){
                            $button.data("item", data);
                            $.proxy(button.click, $button)(e);
                        }else{
                            button.onClick(data, $button, e);
                        }
                    });
                });
            }

            if(hasBottomNavigation) {
                this.addBottomNavigation(options.bottomNavigation);
            }
        },


        initializeResultTableEvents: function (highlightControl) {
            var resultTable = this;

            var tableApi = resultTable.getApi();

            var table = resultTable.element;

            table.off('mouseenter', 'mouseleave', 'click');

            table.delegate("tbody > tr", 'mouseenter', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();
                if (feature) {
                    highlightControl.getFeatures().push(feature);
                } else {
                    console.warn("No Feature in row", row);
                }
            });

            table.delegate("tbody > tr", 'mouseleave', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();
                if (feature) {
                    highlightControl.getFeatures().remove(feature);
                } else {
                    console.warn("No Feature in row", row);
                }
            });

            // table.delegate("tbody > tr", 'click', function () {
            //     var tr = this;
            //     var row = tableApi.row(tr);
            //     var feature = row.data();
            //
            //     if (feature) {
            //         highlightControl.getFeatures().push(feature);
            //     } else {
            //         console.warn("No Feature in row", row);
            //     }
            //
            // });


        },

        hoverInResultTable: function (feature, highlight) {
            var resultTable = this;

            var domRow = resultTable.getDomRowByData(feature);
            if (domRow && domRow.size()) {
                resultTable.showByRow(domRow);

                if (highlight) {
                    domRow.addClass('hover');
                } else {
                    domRow.removeClass('hover');
                }

            }

        },


        redrawResultTableFeatures: function (features) {
            var resultTable = this;
            var tableApi = resultTable.getApi();

            tableApi.clear();

            var featuresToRedraw = features.filter(function (feature) {
                return !feature.isNew && !feature.cluster;
            });
            tableApi.rows.add(featuresToRedraw);
            tableApi.draw();

            tableApi.rows(function (idx, feature, row) {

                // TODO this is a bad solution. Disabledness etc. should be controlled by buttons themselves, which unfortunately is not possible on behalf of visui result table
                if (feature.isChanged) {
                    $(row).find(".save").removeAttr("disabled");
                }
                if (feature.printMetadata) {
                    $(row).find(".printmetadata").addClass("active");
                }
                return true;
            });

        },


        getTableRowByFeature: function (feature) {
            var resultTable = this;
            var row = resultTable.getDomRowByData(feature);
            return row;
        },


        refreshFeatureRowInDataTable: function (feature) {
            var resultTable = this;
            var tableApi = resultTable.getApi();

            // TODO check this
            tableApi.row(resultTable.getDomRowByData(feature)).invalidate();
            tableApi.draw();
        },

        initializeColumnTitles: function () {
            var resultTable = this;

            var searchableColumnTitles = _.pluck(_.reject(resultTable.options.columns, function (column) {
                if (!column.sTitle) {
                    return true;
                }

                if (column.hasOwnProperty('searchable') && column.searchable === false) {
                    return true;
                }
            }), 'sTitle');

            resultTable.element.find(".dataTables_filter input[type='search']").attr('placeholder', searchableColumnTitles.join(', '));
        },


        // Allow Button disable
        genNavigation: function (elements) {
            var html = $('<div class="button-navigation"/>');
            $.each(elements, function (idx, element) {

                var type = 'button';
                if (_.has(element, 'type')) {
                    type = element.type;
                } else if (_.has(element, 'html')) {
                    type = 'html';
                }

                switch (type) {
                    case 'html':
                        html.append(element.html);
                        break;
                    case 'button':
                        var title = element.title ? element.title : (element.text ? element.text : '');
                        var disabled = !!element.disabled ? 'disabled' : '';
                        var button = $('<button class="button" ' + disabled + ' title="' + title + '">' + title + '</button>');
                        if (_.has(element, 'cssClass')) {
                            button.addClass(element.cssClass);
                        }
                        if (_.has(element, 'className')) {
                            button.addClass("icon-" + element.className);
                            button.addClass(element.className);
                        }

                        html.append(button);
                        break;
                }
            });
            return html;
        },


        // genNavigation: function(elements) {
        //     var html = $('<div class="button-navigation"/>');
        //     $.each(elements, function(idx, element) {
        //
        //         var type = 'button';
        //         if(_.has(element,'type')){
        //             type = element.type;
        //         }else if(_.has(element,'html')){
        //             type = 'html';
        //         }
        //
        //         switch(type){
        //             case 'html':
        //                 html.append(element.html);
        //                 break;
        //             case 'button':
        //                 var title = element.title?element.title:(element.text?element.text:'');
        //                 var button = $('<button class="button" title="' + title + '">' + title + '</button>');
        //                 if(_.has(element,'cssClass')){
        //                      button.addClass(element.cssClass);
        //                 }
        //                 if(_.has(element,'className')){
        //                     button.addClass("icon-"+element.className);
        //                     button.addClass( element.className);
        //                 }
        //
        //                 html.append(button);
        //                 break;
        //         }
        //     });
        //     return html;
        // },

        /**
         * Get DataTables API
         * @see http://datatables.net/reference/api/
         */
        getApi: function() {
            return this._dataTable;
        },
        
        /**
         * Get widget itself
         * 
         * @returns widget
         */
        getWidget: function(){
            return this;
        },

        /**
         * Get selection manager
         */
        getSelection: function() {
            var widget = this;
            if(!widget._selection) {
                widget._selection = $.extend(true, new function() {
                    var me = this;
                    var list = me.list = [];
                    this.table = widget._table;

                    /**
                     * Add selection
                     *
                     * @param data
                     */
                    me.add = function(data) {
                        if(_.indexOf(list,data) != -1){
                            return this;
                        }
                        list.push(data);
                        me.dispatch('add', data);
                        me.dispatch('change', list);
                        return this;
                    };

                    /**
                     * Remove selection
                     * @param data
                     * @return {boolean}
                     */
                    me.remove = function(data) {
                        if(_.indexOf(list, data) == -1) {
                            return this;
                        }
                        list.splice(_.indexOf(list, data), 1);
                        me.dispatch('remove', data);
                        me.dispatch('change', list);
                        return this;
                    };
                }, widget._eventDispatcher);
            }
            return widget._selection;
        },

        /**
         * Set option listener
         *
         * @param key
         * @param value
         * @private
         */
        _setOption: function(key, value) {
            switch (key) {
                case "data":
                    this.setData(value);
            }
        },

        /**
         * Set table data
         *
         * @param data
         */
        setData: function(data) {
            var options = $.extend(this.options, {aaData: data});
            this.options.data = data;
            this._dataTable.destroy();
            this._dataTable = $(this._table).DataTable(options);
        },

        _addSelection: function() {
            var options = this.options;
            var columns = options.columns;

            options.columns = _.union([{
                data:  null,
                title: ''
            }], columns);

            var columnDef = [{
                targets:        0,
                className:      'selection',
                width:          "1%",
                orderable:      false,
                searchable:     false,
                defaultContent: '<input type="checkbox" value="1"/>'
            }];

            // merge definitions
            options.columnDefs = options.hasOwnProperty('columnDefs') ? _.flatten(options.columnDefs, columnDef) : columnDef;
        },

        _addButtons: function(buttons) {
            var options = this.options;

            options.columns.push({
                data:  null,
                title: ''
            });

            var columnDef = [{
                targets:        -1,
                className:      'buttons',
                width:          "1%",
                orderable:      false,
                searchable:     false,
                defaultContent: $('<div>').append(this.genNavigation(options.buttons).clone()).html()
            }];

            // merge definitions
            options.columnDefs = options.hasOwnProperty('columnDefs') ? _.union(options.columnDefs, columnDef) : columnDef;
        },

        /**
         *
         * @param buttons
         * @return {*}
         */
        addBottomNavigation: function(buttons) {
            var widget = this;
            var el = $(widget.element);
            var options = widget.options;
            var navigation = widget.genNavigation(buttons).addClass('bottom-navigation');

            $('button', navigation).on('click', function(event) {
                var button = $(event.currentTarget);
                // find and run callback, if defined in configuration
                $.each(options.bottomNavigation, function(idx, config) {
                    if(button.hasClass(config.className) && config.hasOwnProperty('onClick')) {
                        config.onClick($.extend(event, {
                            widget:    widget,
                            dataTable: widget._dataTable,
                            table:     widget._table,
                            config:    config
                        }));
                    }
                });
            });

            el.append(navigation);

            return navigation;
        },

        getRowByData: function(data) {
            var widget = this;
            var r = null;
            $.each(widget.getVisibleRows(), function() {
                if(widget.getDataByRow(this) == data) {
                    r = $(this);
                    return false;
                }
            });
            return r;
        },

        getVisibleRows: function() {
            return $(">tbody>tr[role='row']", this._table);
        },

        getVisibleRowData: function() {
            var list = [];
            var widget = this;

            $.each(widget.getVisibleRows(), function() {
                list.push(widget.getDataByRow(this));
            });

            return list;
        },

        getDataByRow: function(tr) {
            return this._dataTable.row(tr).data();
        },

        selectVisibleRows: function() {
            var widget = this;
            var selectionManager = widget.getSelection();
            $.each(widget.getVisibleRows(), function() {
                selectionManager.add(widget.getDataByRow(this));
            });
        },

        // TODO: realize
        selectAll: function() {
            var widget = this;
            var selectionManager = widget.getSelection();
            $.each(widget._dataTable.data(), function() {
                selectionManager.add(this);
            });
        },

        deselectVisibleRows: function() {
            var widget = this;
            var selectionManager = widget.getSelection();
            $.each(widget.getVisibleRows(), function() {
                selectionManager.remove(widget.getDataByRow(this));
            });
        },

        // TODO: realize
        deselectAll: function() {
            var widget = this;
            var selectionManager = widget.getSelection();
            $.each(widget._dataTable.data(), function() {
                selectionManager.remove(this);
            });
        },

        hasUnselectedVisibleRows: function() {
            var r = false;
            $.each(this.getVisibleRows(),function(){
                if(!$(this).hasClass('warning')){
                    r = true;
                    return false;
                }
            });
            return r;
        },
        
        /**
         * 
         * @param {type} id
         * @param {type} key
         * @returns {@exp;selector|@exp;seed@pro;length|@exp;selector@call;slice|String|@exp;compiled@pro;selector|@exp;selector@call;replace|@exp;handleObjIn@pro;selector|until|seed.length|compiled.selector|handleObjIn.selector|@exp;type|@exp;type@call;slice|@exp;callback|@exp;props|@exp;params|@arr;@this;|@exp;data|@exp;speed|@exp;options|Array|@exp;props@call;split|@exp;jQuery@call;param|@exp;query@call;split|@exp;jQuery@call;makeArray|@exp;selectorundefined|@exp;options@pro;duration|@exp;_@call;extend|options|@exp;s@call;join@call;replace|selectorundefined|_@call;extend.duration|options.duration}Get data by id
         */
        getDataById: function(value, key){    
            var result;
            
            if(!key){
                key = 'id'
            }
            $.each(this.getApi().data(),function(i, data){
                if(value === data[key]){
                    result = data;
                    return false
                }
            });
            return result;
        },

        /**
         * Get DOM TR row by data object
         * @param {type} DOM object
         * @returns {undefined}
         */
        getDomRowByData: function(data) {
            var tableApi = this.getApi();
            var result = _.first(tableApi.rows(function(idx, _data, row) {
                return _data == data
            }).nodes());

            return result ? $(result) : result;
        },
        
        /**
         * Show by DOM row
         * @return int page number
         */
        showByRow: function(domRow){
            var tableApi =  this._dataTable;
            var rowsOnOnePage = tableApi.page.len();

            if(domRow.hasOwnProperty('length')){
                domRow = domRow[0]
            }
            
            var nodePosition = tableApi.rows({order: 'current'}).nodes().indexOf(domRow);
            var pageNumber = Math.floor(nodePosition / rowsOnOnePage);
            tableApi.page(pageNumber).draw( false );
            return pageNumber;
        },
        _eventDispatcher: {
            _listeners: {},

            on: function(name,callback){
                if(!this._listeners[name]){
                    this._listeners[name] = [];
                }
                this._listeners[name].push(callback);
                return this;
            },

            off: function(name,callback){
                if(!this._listeners[name]){
                    return;
                }
                if(callback){
                    var listeners = this._listeners[name];
                    for(var i in listeners){
                        if(callback == listeners[i]){
                            listeners.splice(i,1);
                            return;
                        }
                    }
                }else{
                    delete this._listeners[name];
                }

                return this;
            },

            dispatch: function(name,data){
                if(!this._listeners[name]){
                    return;
                }

                var listeners = this._listeners[name];
                for(var i in listeners){
                    listeners[i](data);
                }
                return this;
            }
        }
    });

})(jQuery);
(function($) {

    /**
     * Date selector based on $.ui.datepicker
     *
     * Widget can't be extended:
     * http://bugs.jqueryui.com/ticket/6228
     *
     * @author Andriy Oblivantsev <eslider@gmail.com>
     */
    $.widget("vis-ui-js.dateSelector", {
        _init: function() {
            var widget = this;
            var element = widget.element;
            var dialog;
            var datePicker = element.datepicker($.extend({
                changeMonth:       true,
                changeYear:        true,
                gotoCurrent:       true,
                defaultDate:       null,
                firstDay:          1, //showWeek:          true,
                dayNamesMin:       ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
                monthNamesShort:   ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"], //showButtonPanel: true,
                dateFormat:        'dd.mm.yy',
                onChangeMonthYear: function(input, instance) {
                    widget._trigger('changeMonthYear');
                    setTimeout(function() {
                        widget._trigger('render');
                    }, 1);
                }
            }, widget.options)).data('datepicker');

            dialog = datePicker.dpDiv;
            dialog.on('show', function(e) {
                widget._trigger('show');
                widget._trigger('render');
            });
            dialog.on('hide', function(e) {
                widget._trigger('hide');
            });

            element.bind('dateselectorrender',function(e){
                var header = $(".ui-datepicker-header", dialog);
                var headerButtons = header.find('a').addClass('button');
                header.find('select').addClass('form-control');
            });

            dialog.addClass('dropdown-menu').addClass('modal-body');
        }
    });

})(jQuery);
(function($) {

    // fake dialogExtend check for ui-dialog
    $.fn.orignalDialogFunc = $.fn.dialog;

    $.fn["dialog"] = function(arg1, arg2) {
        return this.hasClass('popup-dialog') ? this.popupDialog(arg1, arg2) :  this.orignalDialogFunc(arg1, arg2);
    };

    /**
     * jQuery dialog with bootstrap styles
     *
     * @author Andriy Oblivantsev <eslider@gmail.com>
     * @copyright 05.11.2014 by WhereGroup GmbH & Co. KG
     */
    $.widget("vis-ui-js.popupDialog", $.ui.dialog, {

        // track if window is opened
        isOpened: false,

        /**
         * Constructor, runs only if the object wasn't created before
         *
         * @return {*}
         * @private
         */
        _create: function() {
            var element = $(this.element);
            var widget = this;

            element.addClass('popup-dialog');

            // overrides default options
            $.extend(this.options, {
                show: {
                    effect:   "fadeIn",
                    duration: 300
                },
                hide: {
                    effect:   "fadeOut",
                    duration: 300
                }
            });

            //resize dialog height fix
            element.bind('popupdialogresize', function(e, ui) {
                var win = $(e.target).closest('.ui-dialog');
                var height = 0;
                $.each($('> .modal-header, > .modal-body, > .modal-footer', win), function(idx, el) {
                    height += $(el).outerHeight();
                });
                win.height(Math.round(height));
                element.width(element.closest('.ui-dialog').find('> .modal-header').width());
            });

            //resize dialog height fix
            element.bind('popupdialogresizestop', function(e, ui) {
                element.width(element.closest('.ui-dialog').find('> .modal-header').width());
            });

            // prevent key listening outside the dialog
            element.on('keydown', function(e) {
                e.stopPropagation();
            });

            var result = this._super();

            // fake dialogExtend check for ui-dialog
            element.data("ui-dialog",true);
            element.dialogExtend($.extend(true, {
                closable:    true,
                maximizable: true,
                resizible: true,
                //dblclick: true,
                //minimizable: true,
                //modal: true,
                collapsable: true
            }, this.options));

            var dialog = element.closest('.ui-dialog');
            if(this.options.modal){
                var modal = $('<div class="mb-element-modal-dialog"><div class="background" unselectable="on"></div></div>');

                modal.insertBefore(dialog);
                modal.prepend(dialog);
                modal.find('> .background').on('click mousemove mouseout mouseover',function(e){
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
                element.bind('popupdialogclose',function(){

                    console.log(modal,"??");
                    modal.fadeOut(function(){
                        modal.remove();
                    });
                });
            }

            // Fullscreen on double click
            $(dialog).dblclick(function(event) {
                var target = $(event.target);
                if(!target.is('.ui-dialog-titlebar, .ui-dialog-title')){
                    return;
                }

                if(element.dialogExtend('state') == 'normal'){
                    element.dialogExtend('maximize');
                }else{
                    element.dialogExtend('restore');
                }
            });

            return result;
        },

        /**
         * Overrides default open method, but adds some Bootstrap classes to the dialog
         * @return {}
         */
        open: function() {
            if(this.isOpened){
                return
            }
            this.isOpened = true;

            var content = $(this.element);
            var dialog = content.closest('.ui-dialog');
            var header = $('.ui-widget-header', dialog);
            var closeButton = $('.ui-dialog-titlebar-close', header);
            var dialogBody = $('.ui-dialog-content', dialog);
            var dialogBottomPane = $('.ui-dialog-buttonpane', dialog);
            var dialogBottomButtons = $('.ui-dialog-buttonset > .ui-button', dialogBottomPane);

            // Marriage of jQuery UI and Bootstrap
            dialog.addClass('modal-content');
            dialogBottomPane.addClass('modal-footer');
            dialogBottomButtons.addClass('button');
            header.addClass('modal-header');
            closeButton.addClass('close');
            dialogBody.addClass('modal-body');

            // Set as mapbender element
            dialog.addClass('mb-element-popup-dialog');
            dialogBottomButtons.addClass('btn');

            // Fix switch between windows
            if(dialog.css('z-index') == "auto"){
                dialog.css('z-index',1);
            }

            return this._super();
        }
    });

})(jQuery);
(function($) {

    /**
     * jQuery tabs with bootstrap styles
     */
    $.widget("vis-ui-js.tabNavigator", $.ui.tabs, {
        options: {
        },
        _create: function() {
            var widget = this;
            var options = widget.options;
            var el = widget.element;
            var activeTab = options.hasOwnProperty('active') ? options.active : -1;
            var ul = $('<ul class="nav nav-tabs" role="tablist"/>');

            el.append(ul);

            var r = this._super();
            //var wrapper = navigation.closest('.ui-tabs');
            el.addClass('mapbender-element-tab-navigator');

            if(options.hasOwnProperty('children')){
                $.each(options.children,function(){
                    var tab = widget._add(this);
                });
            }

            el.on('tabnavigatoractivate',function(e,ui){
                var item = $(ui.newTab).data('item');
                if(item.hasOwnProperty('active')){
                    item.active(e,ui);
                }
            });

           if(activeTab > -1) {
                widget.option('active', activeTab);
            }

            if(widget.isClosable()) {
                ul.delegate('>li> a > span.close', 'click', function(e) {
                    var closeButton = $(this);
                    widget.close(closeButton.closest('li').attr('aria-labelledby'));
                    e.stopPropagation();
                    e.preventDefault();
                });
            }

            return r;
        },

        close: function(uuid) {
            var widget = this;
            var li = $('>ul>li[aria-labelledby="' + uuid + '"]', $(widget.element));
            var uuid = li.attr('aria-labelledby');
            var tabs = li.closest('.ui-tabs');
            var div = tabs.find('>div[aria-labelledby="' + uuid + '"]');

            li.remove();
            div.remove();
            widget.refresh();

            widget._trigger('close',div);
        },

        closeAll: function() {
            var widget = this;
            $.each($('>ul>li', $(widget.element)), function() {
                widget.close($(this).attr('aria-labelledby'));
            });
        },

        isClosable: function() {
            return this.options.hasOwnProperty('closable') && this.options.closable;
        },

        _add: function (item){

            var el = this.element;
            var navigation = $("> .ui-tabs-nav",el);
            var id = item.hasOwnProperty('id') ? item.id : 'tabs-' + guid();
            //location.href alone will not work with html-base-tag in some cases, so we use this monstrosity here to be 100% safe
            var queryStringMatch = /\?.*/.exec(location.href);
            var queryString = queryStringMatch && queryStringMatch[0] || '';
            var href = location.origin + location.pathname + queryString +'#'+id;
            var label = $('<li><a role="tab" data-toggle="tab" href="' + href+ '">' + item.title + (this.isClosable() ? '<span class="close">Close</span>' : '') + '</a></li>');
            var contentHolder = $("<div id='" + id + "' class='tab-content'/>");

            label.data('item',item);

            navigation.append(label);
            contentHolder.append(item.html);
            el.append(contentHolder);
            this.refresh();
            return contentHolder;
        },

        add: function(title, htmlElement, activate) {
            var content = this._add({
                html:  htmlElement,
                title: title
            });
            if(activate) {
                this.option('active', this.size() - 1);
            }
            return content;
        },

        size: function() {
            return $(">ul>li", this.element).size();
        }
    });

    var guid = (function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }

        return function() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };
    })();
})(jQuery);
/**
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 * @copyright 08.04.2015 by WhereGroup GmbH & Co. KG
 */
(function($) {

    /**
     * Event list
     * @type {string[]}
     */
    var eventNameList = [
        'load',
        'focus', 'blur',
        'input', 'change', 'paste',
        'click', 'dblclick', 'contextmenu',
        'keydown', 'keypress', 'keyup',
        'dragstart','ondrag','dragover','drop',
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup',
        'touchstart', 'touchmove', 'touchend','touchcancel'
    ];

    // extend jquery to fire event on "show" and "hide" calls
    $.each(['show', 'hide'], function (i, ev) {
        var el = $.fn[ev];
        $.fn[ev] = function () {
            this.trigger(ev);
            return el.apply(this, arguments);
        };
    });

    /**
     * Check if object has a key
     *
     * @param obj
     * @param key
     * @returns {boolean}
     */
    function has(obj, key) {
        return typeof obj[key] !== 'undefined';
    }

    /**
     * Get value from object by the key or return default given.
     *
     * @param obj
     * @param key
     * @param defaultValue
     * @returns {*}
     */
    function getVal(obj, key, defaultValue) {
        return has(obj, key) ? obj[key] : defaultValue;
    }

    /**
     * Add jquery events to element y declration
     *
     * @param element
     * @param declaration
     */
    function addEvents(element, declaration) {
        $.each(declaration, function(k, value) {
            if(typeof value == 'function') {
                element.on(k, value);
            } else if(typeof value == "string" && _.contains(eventNameList, k)) {
                var elm = element;
                if(elm.hasClass("form-group")) {
                    elm = elm.find("input,.form-control");
                }
                if(k === 'load'){
                    setTimeout(function(){
                        $(elm).ready(function(e) {
                            var el = elm;
                            var result = false;
                            eval(value);
                            result && e.preventDefault();
                            return result;
                        });
                    },1);
                }else{
                    elm.on(k, function(e) {
                        var el = $(this);
                        var result = false;
                        eval(value);
                        result && e.preventDefault();
                        return result;
                    });
                }
            }
        });
    }

    // Copies a string to the clipboard. Must be called from within an
    // event handler such as click. May return false if it failed, but
    // this is not always possible. Browser support for Chrome 43+,
    // Firefox 42+, Safari 10+, Edge and IE 10+.
    // IE: The clipboard feature may be disabled by an administrator. By
    // default a prompt is shown the first time the clipboard is
    // used (per session).
    function copyToClipboard(text) {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return clipboardData.setData("Text", text);

        } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
            document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand("copy");  // Security exception may be thrown by some browsers.
            } catch (ex) {
                console.warn("Copy to clipboard failed.", ex);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    $.widget('vis-ui-js.generateElements', {
        options:      {},
        declarations: {
            popup: function(item, declarations, widget) {
                var popup = $("<div/>");
                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        popup.append(widget.genElement(item));
                    });
                }
                window.setTimeout(function() {
                    popup.popupDialog(item)
                }, 1);

                return popup;
            },
            form: function(item, declarations, widget) {
                var form = $('<form/>');
                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        form.append(widget.genElement(item));
                    })
                }
                return form;
            },
            fluidContainer: function(item, declarations, widget) {
                var container = $('<div class="container-fluid"/>');
                var hbox = $('<div class="row"/>');
                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        hbox.append(widget.genElement(item));
                    })
                }
                container.append(hbox);
                return container;
            },
            inline: function(item, declarations, widget) {
                var container = $('<div class="form-inline"/>');
                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        container.append(widget.genElement(item));
                    })
                }
                return container;
            },
            html:      function(item, declarations) {
                var container = $('<div class="html-element-container"/>');
                if (typeof item === 'string'){
                    container.html(item);
                }else if(has(item,'html')){
                    container.html(item.html);
                }else{
                    container.html(JSON.stringify(item));
                }
                return container;
            },
            button:    function(item, declarations) {
                var title = has(item, 'title') ? item.title : 'Submit';
                var button = $('<button class="btn button">' + title + '</button>');
                button.attr("title", title);
                return button;
            },
            submit:    function(item, declarations) {
                var button = declarations.button(item, declarations);
                button.attr('type', 'submit');
                return button;
            },
            input:     function(item, declarations, widget, input) {
                var type = has(declarations, 'type') ? declarations.type : 'text';
                var inputField = input ? input : $('<input class="form-control" type="' + type + '"/>');
                var container = $('<div class="form-group"/>');
                var icon = '<span class="glyphicon glyphicon-ok form-control-feedback" aria-hidden="true"></span>';

                // IE8 bug: type can't be changed...
                /// inputField.attr('type', type);
                inputField.data('declaration',item);

                $.each(['name', 'rows', 'placeholder'], function(i, key) {
                    if(has(item, key)) {
                        inputField.attr(key, item[key]);
                    }
                });

                if(has(item, 'value')) {
                    inputField.val(item.value);
                }

                if(has(item, 'disabled') && item.disabled) {
                    inputField.attr('disabled','');
                }


                if(has(item, 'title')) {
                    container.append(declarations.label(item, declarations));
                    container.addClass('has-title')
                }

                if(has(item, 'mandatory') && item.mandatory) {
                    inputField.data('warn',function(value){
                        var hasValue = $.trim(value) != '';
                        var isRegExp = item.mandatory !== true;

                        if(isRegExp){
                            hasValue = eval(item.mandatory).exec(value) != null;
                        }

                        if(hasValue){
                            container.removeClass('has-error');
                        }else{
                            if(inputField.is(":visible")){
                                var text = item.hasOwnProperty('mandatoryText')? item.mandatoryText: "Please, check!";
                                $.notify( inputField, text, { position:"top right", autoHideDelay: 2000});
                            }
                            container.addClass('has-error');
                        }
                        return hasValue;
                    });
                }

                if(has(item, 'infoText')) {
                    var infoButton = $('<a class="infoText"></a>');
                    infoButton.on('click touch press',function(e){
                       var button = $(e.currentTarget);
                        $.notify(button.attr('title'),'info');
                    });
                    infoButton.attr('title', item.infoText);
                    container.append(infoButton);
                }


                if(has(item, 'copyClipboard')) {

                    var copyButton = $('<a class="copy-to-clipboard"><i class="fa fa-clipboard far-clipboard" aria-hidden="true"></i></a>');
                    copyButton.on('click', function(e) {
                        var button = $(e.currentTarget);
                        var data = container.formData(false);
                        copyToClipboard(data[item.name]);
                    });
                    container.append(copyButton);
                }

                container.append(inputField);
                //container.append(icon);

                return container;
            },
            label:     function(item, declarations) {
                var label = $('<label/>');
                if(_.has(item, 'text')) {
                    label.html(item.text);
                }
                if(_.has(item, 'title')) {
                    label.html(item.title);
                }
                if(_.has(item, 'name')) {
                    label.attr('for', item.name);
                }
                return label;
            },
            checkbox: function(item, declarations, widget, input) {
                var container = $('<div class="form-group checkbox"/>');
                var label = $('<label/>');

                input = input ? input : $('<input type="checkbox"/>');

                input.data('declaration',item);

                label.append(input);

                if(has(item, 'name')) {
                    input.attr('name', item.name);
                }

                if(has(item, 'value')) {
                    input.val(item.value);
                }

                if(has(item, 'title')) {
                    label.append(item.title);
                }

                if(has(item, 'checked') && item.checked) {
                    input.attr('checked', "checked");
                }

                if(has(item, 'mandatory') && item.mandatory) {
                    input.data('warn',function(){
                        var isChecked = input.is(':checked');
                        if(isChecked){
                            container.removeClass('has-error');
                        }else{
                            container.addClass('has-error');
                            if(input.is(':visible')){
                                var text = item.hasOwnProperty('mandatoryText') ? item.mandatoryText : "Please confirm!";
                                $.notify( input, text, { position:"top left", autoHideDelay: 2000});
                            }

                        }
                        return isChecked;
                    });
                }

                container.append(label);

                if(has(item, 'infoText')) {
                    var infoButton = $('<a class="infoText">Info</a>');
                    infoButton.attr('title', item.infoText);
                    container.append(infoButton);
                }

                return container;
            },
            radio: function(item, declarations, widget) {
                var input = $('<input type="radio"/>');
                var container = declarations.checkbox(item, declarations, widget, input);
                container.addClass('radio');
                return container;
            },
            formGroup: function(item, declarations, widget) {
                var container = $('<div class="form-group"/>');
                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        container.append(widget.genElement(item));
                    });
                }
                return container;
            },
            textArea:  function(item, declarations, widget) {
                var inputField = $('<textarea class="form-control" rows="3"/>');
                var container =  declarations.input(item, declarations, widget, inputField);
                container.addClass('textarea-container');

                inputField.data('declaration',item);
                return container;
            },
            select:    function(item, declarations, widget) {
                var select = $('<select class="form-control"/>');
                var container = declarations.input(item, declarations, widget, select);
                var value = has(item, 'value') ? item.value : null;

                container.addClass('select-container');

                if(has(item, 'multiple') && item.multiple) {
                    select.attr('multiple', 'multiple');
                }

                if(has(item, 'options')) {
                    var isValuePack = _.isArray(_.first(item.options)) && _.size(_.first(item.options)) == 2;
                    _.each(item.options, function(title, value) {
                        if(isValuePack) {
                            value = title[0];
                            title = title[1];
                        } else if(_.isObject(title)) {
                            var a = _.toArray(title);
                            value = a[0];
                            title = a[1];
                        }

                        var option = $("<option/>");
                        option.attr('value', value);
                        option.html(title);
                        select.append(option);
                    });
                }

                window.setTimeout(function() {
                    select.val(value);
                    if(has(item, 'multiple') && item.multiple && (typeof select.select2 === 'function')) {
                        select.select2(item);
                    }
                }, 20);

                return container;
            },
            image: function(item, declarations, widget) {
                var image = $('<img src="' + (has(item, 'src') ? item.src : '') + '"/>');
                var subContainer = $("<div class='sub-container'/>");
                var container = declarations.input(item, declarations, widget, image);

                container.append(subContainer.append(image.detach()));
                container.addClass("image-container");

                if(has(item, 'enlargeImage') && item.enlargeImage) {
                    image.attr('tabindex', 0);
                    image.css('cursor', 'pointer');
                    image.on('keypress click', function(e) {
                        if(e.type !== 'click' && e.which && e.which !== 13) {
                            return
                        }

                        var bigImage = new Image();
                        bigImage.src = item.src;
                        bigImage.onload = function() {
                            var dialog = $('<div>');
                            var bImage = $('<img src="' + image.attr('src') + '"/>');
                            var _popupConfig = {
                                title: image.title ? image.title : 'Image',
                                width: bigImage.width
                            };
                            var maxHeight = $(window).height() - 100;
                            if(bigImage.height > maxHeight) {
                                _popupConfig.height = maxHeight;
                            }
                            dialog.popupDialog(_popupConfig);
                            bImage.css({
                                height:      'auto',
                                width:       '100%',
                                'max-width': bigImage.width
                            });
                            dialog.append(bImage);
                        };
                    })
                }

                if(has(item, 'imageCss')) {
                    image.css(item['imageCss']);
                } else {
                    image.css({width: "100%"});
                }
                return container;
            },
            file:      function(item, declarations, widget) {
                var input = $('<input type="hidden"  />');
                var fileInput = $('<input type="file" />');
                var container = declarations.input(item, declarations, widget, input);
                var defaultText = (has(item, 'text') ? item.text : "Select");
                var textSpan = '<span class="upload-button-text"><i class="fa fa-upload" aria-hidden="true"/> ' + defaultText + '</span>';
                var uploadButton = $('<span class="btn btn-success button fileinput-button">' + textSpan + '</span>');
                var buttonContainer = $("<div/>");
                var progressBar = $("<div class='progress-bar'/>");
                var eventHandlers = item.on ? item.on : {};

                if(has(item, 'accept')) {
                    fileInput.attr('accept', item.accept);
                }

                //input.detach();
                container.addClass("file-container");
                uploadButton.append(fileInput);
                buttonContainer.append(uploadButton);
                uploadButton.append(progressBar);
                container.append(buttonContainer);

                function truncate(n, len) {
                    var ext = n.substring(n.lastIndexOf(".") + 1, n.length).toLowerCase();
                    var filename = n.replace('.' + ext, '');
                    if(filename.length <= len) {
                        return n;
                    }
                    filename = filename.substr(0, len) + (n.length > len ? '[...]' : '');
                    return filename + '.' + ext;
                }

                fileInput.fileupload({
                    dataType:    'json',
                    url:         item.uploadHanderUrl,
                    formData:    item.formData,
                    //sequentialUploads: true,
                    add:         function(e, data) {
                        //console.log("added file", data, e);
                        data.submit();
                    },
                    progressall: function(e, data) {
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        progressBar.css({width: progress + "%"});
                        //progressBar.html(progress + "%");
                        if(eventHandlers.progressall){
                            eval(eventHandlers.progressall);
                        }
                    },
                    always:      function(e, data) {
                        if(eventHandlers.always) {
                            eval(eventHandlers.always);
                        }
                    },
                    done:        function(e, data) {
                        if(eventHandlers.done){
                            eval(eventHandlers.done);
                        }
                        progressBar.css({width: 0});
                    },
                    success:     function(result, textStatus, jqXHR) {
                        if(eventHandlers.success){
                            eval(eventHandlers.success);
                        }

                        if(result.files && result.files[0]) {
                            var fileInfo = result.files[0];
                            var img = container.closest('form').find('img[name="' + item.name + '"]');

                            if(fileInfo.error) {
                                $.notify(fileInfo.error, "error");
                                return;
                            }

                            if(fileInfo.name) {
                                buttonContainer.find('.upload-button-text').html('<i class="fa fa-check-circle-o far-check-circle" aria-hidden="true"/> ' + truncate(fileInfo.name, 10));
                                var newUploadFileInput = container.find('input[type="file"]')
                                    .attr('title', fileInfo.name)
                                    .attr('alt', fileInfo.name)
                                    .attr('label', fileInfo.name);
                            }

                            if(img.size()){
                                img.attr('src', fileInfo.thumbnailUrl);
                            }
                            input.val(fileInfo.url);
                        }
                    }
                });

                return container;
            },
            tabs: function(item, declarations, widget) {
                var container = $('<div/>');
                var tabs = [];
                if(has(item, 'children') ) {
                    $.each(item.children, function(k, subItem) {
                        var htmlElement = widget.genElement(subItem);
                        var tab = {
                            html: htmlElement
                        };

                        if(has(subItem, 'title')) {
                            tab.title = subItem.title;
                        }
                        tabs.push(tab);
                    });
                }
                container.tabNavigator({children: tabs});
                return container;
            },
            fieldSet: function(item, declarations, widget) {
                var fieldSet = $("<fieldset class='form-group'/>");

                if(has(item, 'title')) {
                    fieldSet.append(declarations.label(item, declarations));
                }
                if(has(item, 'legend')) {
                    fieldSet.append("<legend>"+item.legend+"</legend>");
                }

                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        fieldSet.append(widget.genElement(item));
                    })
                }

                if(has(item, 'breakLine') && item.breakLine) {
                    fieldSet.append(declarations.breakLine(item, declarations, widget));
                }

                return fieldSet;
            },
            date: function(item, declarations, widget) {
                var inputHolder = declarations.input(item, declarations, widget);
                var input = inputHolder.find('> input');
                input.dateSelector(item);
                return inputHolder;
            },
            colorPicker: function(item, declarations, widget) {
                var container = $('<div class="form-group"/>');
                var inputHolder = declarations.input(item, declarations, widget);
                var label = inputHolder.find('> label');

                inputHolder.append('<span class="input-group-addon"><i></i></span>');
                inputHolder.addClass("input-group colorpicker-element colorpicker-component");
                container.prepend(label);
                container.append(inputHolder);
                inputHolder.find('> label').remove();

                if (item.value) {
                    item.color = item.value;
                }

                if(!item.hasOwnProperty("format")){
                    item.format = "hex";
                }

                inputHolder.colorpicker(item);

                var input = inputHolder.find("input");
                input.addClass("form-control");
                input.on('changeValue', function() {
                    var clr = input.val();
                    inputHolder.colorpicker('setValue', clr);
                });

                return container;
            },
            slider: function(item, declarations, widget) {
                var container = $('<div class="form-group input-group slider-holder"/>');
                var inputHolder = declarations.input(item, declarations, widget);
                var label = inputHolder.find('> label');
                var input = inputHolder.find('> input');
                var sliderRange = $('<div class="input-group"/>');

                label.append('<span/>')

                inputHolder.prepend(sliderRange);
                inputHolder.find('> label').remove();
                inputHolder.find('> input').attr('type', 'hidden');

                container.prepend(label);
                container.append(inputHolder);

                label.find('> span').text(' ' + item.value);

                sliderRange.slider($.extend({
                    range:  "max",
                    min:    1,
                    max:    10,
                    value:  1,
                    step:   1,
                    slide:  function(event, ui) {
                        input.val(ui.value);
                        label.find('> span').text(' ' + ui.value);
                    },
                    change: function(event, ui) {
                        var value = input.val();
                        label.find('> span').text(' ' + value);
                    }
                }, item));

                input.on('change', function() {
                    var value = input.val();
                    label.find('> span').text(' ' + value);
                    sliderRange.slider("value", value);
                });

                return container;
            },


            resultTable: function(item, declarations, widget) {
                var container = $("<div/>");
                $.each(['name'], function(i, key) {
                    if(has(item, key)) {
                        container.attr(key, item[key]);
                    }
                });

                return container
                    .data('declaration', item)
                    .resultTable($.extend({
                        lengthChange: false,
                        pageLength:   10,
                        searching:    false,
                        info:         true,
                        processing:   false,
                        ordering:     true,
                        paging:       true,
                        selectable:   false,
                        autoWidth:    false
                    }, item));
            },
            digitizingToolSet: function(item, declarations, widget) {
                var $div = $("<div/>");
                $div.data('declaration',item);
                return $div.digitizingToolSet(item);
            },

            /**
             * Break line
             *
             * @param item
             * @param declarations
             * @param widget
             * @return {*|HTMLElement}
             */
            breakLine: function(item, declarations, widget) {
                return $("<hr class='break-line'/>");
            },

            /**
             * Map eleemnt.
             *
             * @param item
             * @param declarations
             * @param widget
             * @returns {*|HTMLElement}
             */
            map: function(item, declarations, widget) {
                var container = $("<div><div class='leaflat-map'/></div>");
                var tileLayerUrl = getVal(item, "tileLayerUrl", 'https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png');
                var zoomLevel = getVal(item, 'zoomLevel', 13);
                var viewPosition = getVal(item, 'viewPosition', [51.505, -0.09]);
                var maxZoom = getVal(item, 'maxZoom', 20);
                var popup = L.popup();
                L.Icon.Default.imagePath = "../../components/leaflet/images/";

                container.on('DOMNodeInsertedIntoDocument', function() {
                    var mapContainer = container.find('.leaflat-map');
                    mapContainer.css({
                        height: "100%",
                        width: '100%'
                    });

                    var map = window.lmap = L.map(mapContainer[0], {
                        trackResize: true,
                        inertia:     true
                    }).setView(viewPosition, zoomLevel);
                    L.tileLayer(tileLayerUrl, {
                        maxZoom:     getVal(item, 'maxZoom', 20),
                        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' + '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="http://mapbox.com">Mapbox</a>',
                        id:          'examples.map-i875mjb7'
                    }).addTo(map);
                    L.marker(viewPosition).addTo(map);
                    map.on('click', function(e) {
                        console.log("You clicked the map at " + e.latlng.toString());
                    });

                    container.closest('.popup-dialog').bind('popupdialogresize', function(e) {
                        map.invalidateSize();

                        console.log("resized")
                    });

                });

                container.data('declaration', item);
                return container;
            },

            /**
             *
             * @param item
             * @param declarations
             * @param widget
             */
            text: function(item, declarations, widget) {
                var text = $('<div class="text"/>');
                var container = declarations.input(item, declarations, widget, text);
                container.addClass('text');
                return container;
            },

            /**
             * Simple container
             *
             * @param item
             * @param declarations
             * @param widget
             */
            container: function(item, declarations, widget) {
                var container = $('<div class="form-group"/>');
                if(has(item, 'children')) {
                    $.each(item.children, function(k, item) {
                        container.append(widget.genElement(item));
                    })
                }
                return container;
            },

            /**
             * Simple accordion
             *
             * @param item
             * @param declarations
             * @param widget
             */
            accordion: function(item, declarations, widget) {
                var container = $('<div class="accordion"/>');
                if(has(item, 'children')) {
                    _.each(item.children, function(child, k) {
                        var pageContainer = $("<div class='container' data-id='" + k + "'/>");
                        var pageHeader = $("<h3 class='header' data-id='" + k + "'/>");

                        if(has(child, 'head')) {
                            pageHeader.append(widget.genElement(child.head));

                            // if(has(child.head, 'title')) {
                            //     pageHeader.append(widget.label(headItem));
                            // }
                            //
                            // if(has(child.head, 'children')) {
                            //     _.each(child.head.children, function(headItem) {
                            //         pageHeader.append(widget.genElement(headItem));
                            //     })
                            // }
                        }

                        if(has(child, 'content')) {
                            pageContainer.append(widget.genElement(child.content));
                        }

                        container.append(pageHeader);
                        container.append(pageContainer);
                    })
                }
                container.data('declaration', item);
                container.accordion(item);
                return container;
            }

        },

        /**
         * Constructor
         *
         * @private
         */
        _create:      function() {
            this._setOptions(this.options);
        },

        /**
         * Generate element by declaration
         *
         * @param item declaration
         * @return jquery html object
         */
        genElement: function(item) {
            var widget = this;
            var type = has(widget.declarations, item.type) ? item.type : 'html';
            var declaration = widget.declarations[type];
            var element = declaration(item, widget.declarations, widget);

            if(has(item, 'cssClass')) {
                element.addClass(item.cssClass);
            }

            if(has(item, 'attr')) {
                $.each(item.attr, function(key, val) {
                    element.attr(key,val);
                });
            }

            if(typeof item == "object") {
                addEvents(element, item);
            }

            if(has(item, 'css')) {

                element.css(item.css);
            }

            element.data('item', item);

            if(has(item, 'mandatory')){
                element.addClass('has-warning');
            }

            return element;
        },

        /**
         * Generate elements
         *
         * @param element jQuery object
         * @param children declarations
         */
        genElements: function(element, children) {
            var widget = this;
            $.each(children, function(k, item) {
                element.append(widget.genElement(item));
            })
        },

        /**
         * Set options
         *
         * @param options
         * @private
         */
        _setOptions: function(options) {
            var widget = this;
            var element = $(widget.element);

            if(has(options, 'type')) {
                element.append(widget.genElement(options));
            } else if(has(options, 'children')) {
                widget.genElements(element, options.children);
            }

            widget._super(options);
            widget.refresh();
        },

        /**
         * Refresh generated elements
         */
        refresh:     function() {
            this._trigger('refresh');
        }
    });

    /**
     * Update existing select element
     *
     * @param values
     * @param idKey
     * @param valueKey
     */
    $.fn.updateSelect = function(values, idKey, valueKey) {
        var select = this;
        var val = select.val();
        select.empty();

        if(idKey && valueKey){
            values = _.object(_.pluck(values, idKey), _.pluck(values, valueKey));
        }

        _.each(values, function(value, key) {
            select.append('<option value="'+key+'">'+value+'</option>');
        });

        select.val(val);
    };

    /**
     * Grabbed from here: http://jsfiddle.net/DkHyd/
     */
    $.fn.togglepanels = function(args) {
        return this.each(function() {
            $(this).addClass("ui-accordion ui-accordion-icons ui-widget ui-helper-reset")
                .find("h3")
                .addClass("ui-accordion-header ui-helper-reset ui-state-default ui-corner-top ui-corner-bottom")
                .hover(function() {
                    $(this).toggleClass("ui-state-hover");
                })
                .prepend('<span class="ui-icon ui-icon-triangle-1-e"></span>')
                .click(function(e) {
                    $(this)
                        .toggleClass("ui-accordion-header-active ui-state-active ui-state-default ui-corner-bottom")
                        .find("> .ui-icon").toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s").end()
                        .next().slideToggle(0);

                    if(args.onChange) {
                        var title = $(e.currentTarget);
                        args.onChange(e, {
                            'title':   title,
                            'content': title.next()
                        });
                    }
                    return false;
                })
                .next()
                .addClass("ui-accordion-content ui-helper-reset ui-widget-content ui-corner-bottom")
                .hide();
        });
    };

})(jQuery);
