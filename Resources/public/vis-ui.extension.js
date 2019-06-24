(function ($) {


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

                /**
                 *  This is why the original function in vis-ui needs to be overriden.
                 *   //TODO this belongs somewhere else and should be injected (BEV-Code)
                 */
                if (input.parent().attr('data-ignore')) {
                    return;
                }

                /**
                 *
                 */


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

    $.widget("digitizer.resultTable", $["vis-ui-js"].resultTable, {


        initializeResultTableEvents: function (selectControl, processFeature) {
            var resultTable = this;

            var tableApi = resultTable.getApi();

            var table = resultTable.element;

            table.off('mouseenter', 'mouseleave', 'click');

            table.delegate("tbody > tr", 'mouseenter', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();
                if (feature) {
                    selectControl.highlight(feature);
                } else {
                    console.warn("No Feature in row", row);
                }
            });

            table.delegate("tbody > tr", 'mouseleave', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();
                if (feature) {
                    selectControl.unhighlight(feature);
                } else {
                    console.warn("No Feature in row", row);
                }
            });

            table.delegate("tbody > tr", 'click', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();

                if (feature) {
                    selectControl.highlight(feature);
                    processFeature(feature);
                } else {
                    console.warn("No Feature in row", row);
                }

            });


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
        }


    });


})(jQuery);
