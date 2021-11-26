(function ($) {

    $.widget("digitizer.resultTable", $["vis-ui-js"].resultTable, {
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
