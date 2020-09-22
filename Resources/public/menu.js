(function () {
    "use strict";


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;

        var frame = $("<div />").addClass('frame');

        frame.append('<div style="clear:both;"/>');

        menu.appendResultTableControlButtons_(frame);

        menu.appendCurrentExtentSwitch_(frame);

        menu.generateResultTable_(frame);

        frame.hide();

        menu.currentExtentSearch = schema.currentExtentSearch;
    };

    Mapbender.Digitizer.Menu.prototype.appendResultTableControlButtons_ = function (frame) {
        var menu = this;
        var schema = menu.schema;

        var buttons = {};

        if (schema.showVisibilityNavigation && schema.allowChangeVisibility) {

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("icon-eyeOff eyeOff");
            $button.attr("title", Mapbender.trans('mb.digitizer.toolset.hideAll'));
            $button.click(function (event) {
                schema.layer.getSource().getFeatures().forEach(function (feature) {
                    feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: true});
                });
            });
            buttons['hideAll'] = $button;

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("icon-eyeOn eyeOn");
            $button.attr("title", Mapbender.trans('mb.digitizer.toolset.showAll'));
            $button.click(function (event) {
                schema.layer.getSource().getFeatures().forEach(function (feature) {
                    feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: false});
                });
            });
            buttons['showAll'] = $button;
        }
        if (schema.allowSaveAll) {

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("icon-save save");
            $button.attr("title", Mapbender.trans('mb.digitizer.toolset.saveAll'));
            $button.attr("disabled", "disabled");
            $button.click(function () {
                schema.layer.getSource().getFeatures().filter(function (feature) {
                    return (["isNew", "isChanged", "isCopy"].includes(feature.get("modificationState")));
                }).forEach(function (feature) {
                    schema.saveFeature(feature);
                });
            });
            buttons['allowSaveAll'] = $button;

        }


        var $div = $("<div/>");
        $div.addClass("resultTableControlButtons");
        $.each(buttons, function (name, $button) {
            $div.append($button);
        });
        frame.append($div);
    };


    Mapbender.Digitizer.Menu.prototype.appendCurrentExtentSwitch_ = function (frame) {
        var menu = this;
        var schema = menu.schema;
        if (schema.showExtendSearchSwitch) {
            var $checkbox = $("<input type='checkbox' />");
            var title = Mapbender.trans('mb.digitizer.toolset.current-extent');
            $checkbox.attr('title', title);
            if (schema.currentExtentSearch) {
                $checkbox.attr("checked", "checked");
            }
            $checkbox.change(function (e) {
                var currentExtentSearch = !!$(e.originalEvent.target).prop("checked");
                menu.changeCurrentExtentSearch_(currentExtentSearch)
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

    Mapbender.Digitizer.Menu.prototype.changeCurrentExtentSearch_ = function(currentExtentSearch) {
        var widget = this.widget;
        this.currentExtentSearch = !!currentExtentSearch;
        if (this.resultTable) {
            var features = this.schema.layer.getSource().getFeatures();
            if (this.currentExtentSearch) {
                features = features.filter(function(feature) {
                    return widget.isInExtent(feature);
                });
            }
            this.resultTable.redraw(features);
        }
    };

    Mapbender.Digitizer.Menu.prototype.registerResultTableEvents = function (resultTable, frame) {
        var menu = this;
        var schema = menu.schema;
        var widget = schema.widget;
        var map = widget.map;
        menu.resultTable = resultTable;

        $(schema).on("Digitizer.FeaturesLoaded", function (event) {
            var features = event.features;
            resultTable.redraw(features);
        });

        $(schema).on("Digitizer.FeatureAddedManually", function (event) {
            var feature = event.feature;
            resultTable.addRow(feature);
        });

        map.on(ol.MapEventType.MOVEEND, function (event) {

            var resolution = map.getView().getResolution();

            if (resolution > schema.layer.getMaxResolution() || resolution < schema.layer.getMinResolution()) {

                resultTable.clear();

            } else {

                if (resultTable.currentExtentSearch) {
                    var features = schema.layer.getSource().getFeatures().filter(function (feature) {
                        return widget.isInExtent(feature);
                    });
                    resultTable.redraw(features);
                } else {
                    resultTable.redraw(schema.layer.getSource().getFeatures());
                }

            }

        });

        resultTable.element.delegate("tbody > tr", 'click', function () {
            var tr = this;
            var row = resultTable.getApi().row(tr);
            var feature = row.data();

            if (feature) {

                if (schema.zoomOnResultTableClick) {
                    schema.zoomToFeature(feature);
                }
                if (schema.openDialogOnResultTableClick) {
                    schema.openFeatureEditDialog(feature);
                }
            } else {
                console.warn("No Feature in row", row);
            }

        });


        schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;

            if (resultTable.currentExtentSearch && !widget.isInExtent(feature)) {
                return;
            }

            feature.on('Digitizer.HoverFeature', function (event) {

                resultTable.hoverInResultTable(feature, true);

            });

            feature.on('Digitizer.UnhoverFeature', function (event) {

                resultTable.hoverInResultTable(feature, false);

            });

            feature.on('Digitizer.ModifyFeature', function (event) {

                var $button = resultTable.getButtonByFeature('.save', feature);
                if ($button) {
                    $button.removeAttr("disabled");
                }

                frame.find(".resultTableControlButtons .save").removeAttr("disabled");

            });

            feature.on('Digitizer.UnmodifyFeature', function (event) {

                var $button = resultTable.getButtonByFeature('.save', feature);
                if ($button) {
                    $button.attr("disabled", "disabled");
                }

                var length = schema.layer.getSource().getFeatures().filter(function (feature) {
                    return ["isNew", "isChanged", "isCopy"].includes(feature.get("modificationState"));
                }).length;


                if (length === 0) {
                    frame.find(".resultTableControlButtons .save").attr("disabled", "disabled");
                }

            });

            feature.on('Digitizer.toggleVisibility', function (event) {
                var $button = resultTable.getButtonByFeature('.visibility', feature);
                if (!$button) {
                    return;
                }
                if (event.hide) {
                    $button.addClass('icon-eyeOn').removeClass('icon-eyeOff');
                    $button.attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleon'));
                } else {
                    $button.addClass('icon-eyeOff').removeClass('icon-eyeOn');
                    $button.attr('title', Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'));
                }
            });

        });

        schema.layer.getSource().on(ol.source.VectorEventType.REMOVEFEATURE, function (event) {
            resultTable.deleteRow(event.feature);
        });

    };

    Mapbender.Digitizer.Menu.prototype.generateResultDataTableButtons = function () {
        var menu = this;
        var schema = menu.schema;

        var buttons = {};

        if (schema.allowLocate) {
            buttons['locate'] = {
                title: Mapbender.trans('mb.digitizer.feature.zoomTo'),
                className: 'zoom',
                onClick: function (feature, ui) {
                    schema.zoomToFeature(feature);
                }
            };
        }

        if (schema.allowEditData && schema.allowSaveInResultTable) {
            buttons['save'] = {
                title: Mapbender.trans('mb.digitizer.feature.save.title'),
                className: 'save',
                disabled: true,
                onClick: function (feature, $button) {
                    schema.saveFeature(feature);
                }
            };
        }

        if (schema.allowEditData) {
            buttons['edit'] = {
                title: Mapbender.trans('mb.digitizer.feature.edit'),
                className: 'edit',
                onClick: function (feature, ui) {
                    schema.openFeatureEditDialog(feature);
                }
            };
        }
        if (schema.copy && schema.copy.enable) {
            buttons['copy'] = {
                title: Mapbender.trans('mb.digitizer.feature.clone.title'),
                className: 'copy',
                onClick: function (feature, ui) {
                    schema.copyFeature(feature);
                }
            };
        }
        if (schema.allowCustomStyle) {
            buttons['style'] = {
                title: Mapbender.trans('mb.digitizer.feature.style.change'),
                className: 'style',
                onClick: function (feature, ui) {
                    schema.openChangeStyleDialog(feature);
                }
            };
        }

        if (schema.allowChangeVisibility) {
            buttons['toggleVisibility'] = {
                title: Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'),
                className: 'visibility',
                cssClass: 'icon-eyeOff',
                onClick: function (feature, $button) {
                    feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: !feature.get("hidden")});
                }
            };
        }

        if (schema.allowDelete) {

            buttons['delete'] = {
                title: Mapbender.trans("mb.digitizer.feature.remove.title"),
                className: 'remove',
                cssClass: 'critical',
                onClick: function (feature, ui) {
                    if (schema.allowDelete) {
                        schema.removeFeature(feature);
                    } else {
                        $.notify("Deletion is not allowed");
                    }
                }
            };
        }

        return buttons;


    };

    Object.assign(Mapbender.Digitizer.Menu.prototype, {
        generateResultDataTableColumns: function (schema) {

            var columns = [];

            var createResultTableDataFunction = function (columnId, fieldSettings) {

                return function (feature, type, val, meta) {

                    var escapeHtml = function (str) {

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
                    };

                    var data = feature.get('data') && feature.get('data').get(columnId);
                    if (typeof (data) == 'string') {
                        data = escapeHtml(data);
                    }
                    return data || '';
                };
            };


            $.each(schema.tableFields, function (columnId, fieldSettings) {
                fieldSettings.title = fieldSettings.label;
                fieldSettings.data = fieldSettings.data || createResultTableDataFunction(columnId, fieldSettings);
                columns.push(fieldSettings);
            });

            return columns;
        },
        getResultTableOptions: function(schema) {
            var menu = this;
            var widget = schema.widget;
            return {
                lengthChange: false,
                pageLength: schema.pageLength,
                searching: schema.inlineSearch,
                info: true,
                processing: false,
                ordering: true,
                paging: true,
                selectable: false,
                autoWidth: false,
                columns: menu.generateResultDataTableColumns(schema),
                buttons: menu.generateResultDataTableButtons(),
                oLanguage: widget.options.tableTranslation
            };
        },
        generateResultTable_: function (frame) {
            var menu = this;
            var schema = menu.schema;
            var widget = schema.widget;

            var resultTableSettings = this.getResultTableOptions(schema);

            var $div = $("<div/>");
            var $table = $div.resultTable(resultTableSettings);

            var resultTable = $table.resultTable("instance");


            // ??? function does not exist
            // resultTable.initializeColumnTitles();

            resultTable.element.delegate("tbody > tr", 'mouseenter', function () {
                var tr = this;
                var row = resultTable.getApi().row(tr);
                var feature = row.data();
                if (feature) {
                    feature.dispatchEvent({type: widget.TYPE + '.HoverFeature'});
                }

            });

            resultTable.element.delegate("tbody > tr", 'mouseleave', function () {
                var tr = this;
                var row = resultTable.getApi().row(tr);
                var feature = row.data();
                if (feature) {
                    feature.dispatchEvent({type: widget.TYPE + '.UnhoverFeature'});
                }
            });

            // menu.registerResultTableEvents(resultTable, frame);

            frame.append($table);
        }
    });

})();
