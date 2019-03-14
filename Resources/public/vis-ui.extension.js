(function($) {

    $.widget("digitizer.resultTable", $["vis-ui-js"].resultTable, {


        initializeResultTableEvents: function (selectControl, processFeature) {
            var resultTable = this;

            var tableApi = resultTable.getApi();

            var table =  resultTable.element;

            table.off('mouseenter', 'mouseleave', 'click');

            table.delegate("tbody > tr", 'mouseenter', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();
                if (feature) {
                    selectControl.highlight(feature);
                } else {
                    console.warn("No Feature in row",row);
                }
            });

            table.delegate("tbody > tr", 'mouseleave', function () {
                var tr = this;
                var row = tableApi.row(tr);
                var feature = row.data();
                if (feature) {
                    selectControl.unhighlight(feature);
                } else {
                    console.warn("No Feature in row",row);
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
                    console.warn("No Feature in row",row);
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

            // TODO redefine Code for Cluster

            // var features = feature.cluster || [feature];
            // var domRow;
            //
            // for (var k in features) {
            //     var feature = features[k];
            //     domRow = schema.resultTable.getDomRowByData(feature);
            //     if (domRow && domRow.size()) {
            //         schema.resultTable.showByRow(domRow);
            //
            //         if (highlight) {
            //             domRow.addClass('hover');
            //         } else {
            //             domRow.removeClass('hover');
            //         }
            //         // $('.selection input', domRow).prop("checked", feature.selected);
            //
            //         break;
            //     }
            // }
        },


        redrawResultTableFeatures: function (features) {
            var resultTable = this;
            var tableApi = resultTable.getApi();

            tableApi.clear();

            var featuresToRedraw = features.filter(function (feature) {
                return !feature.isNew
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

            tableApi.row(resultTable.getDomRowByData(feature)).invalidate();
            tableApi.draw();
        },

        initializeColumnTitles: function() {
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
        genNavigation: function(elements) {
            var html = $('<div class="button-navigation"/>');
            $.each(elements, function(idx, element) {

                var type = 'button';
                if(_.has(element,'type')){
                    type = element.type;
                }else if(_.has(element,'html')){
                    type = 'html';
                }

                switch(type){
                    case 'html':
                        html.append(element.html);
                        break;
                    case 'button':
                        var title = element.title?element.title:(element.text?element.text:'');
                        var disabled = !!element.disabled ? 'disabled' : '';
                        var button = $('<button class="button" '+disabled+' title="' + title + '">' + title + '</button>');
                        if(_.has(element,'cssClass')){
                            button.addClass(element.cssClass);
                        }
                        if(_.has(element,'className')){
                            button.addClass("icon-"+element.className);
                            button.addClass( element.className);
                        }

                        html.append(button);
                        break;
                }
            });
            return html;
        }


    });


})(jQuery);
