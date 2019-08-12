(function () {
    "use strict";


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;
        var frame = $("<div />").addClass('frame');

        menu.appendToolset_(frame);

        frame.append('<div style="clear:both;"/>');

        menu.appendCurrentExtentSwitch_(frame);

        menu.generateDataTable_(frame);

        frame.hide();

        menu.show = function () {
            frame.show();
        };

        menu.hide = function () {
            frame.hide();
        };

        menu.appendTo = function ($element) {
            $element.append(frame);
        };

        schema.layer.getSource().dispatchEvent({type: "Digitizer.ChangeCurrentExtentSearch", currentExtentSearch: schema.currentExtentSearch});
    };

    Mapbender.Digitizer.Menu.prototype = Object.create(Mapbender.DataManager.Menu.prototype);
    Mapbender.Digitizer.Menu.prototype.constructor = Mapbender.DataManager.Menu;


    Mapbender.Digitizer.Menu.prototype.appendCurrentExtentSwitch_ = function (frame) {
        var menu = this;
        var schema = menu.schema;
        if (schema.showExtendSearchSwitch) {
            var $checkbox = $("<input type='checkbox' />");
            var title = Mapbender.DataManager.Translator.translate('toolset.current-extent');
            $checkbox.attr('title', title);
            if (schema.currentExtentSearch) {
                $checkbox.attr("checked", "checked");
            }
            $checkbox.change(function (e) {
                var currentExtentSearch = !!$(e.originalEvent.target).prop("checked");
                schema.layer.getSource().dispatchEvent({
                    type: "Digitizer.ChangeCurrentExtentSearch",
                    currentExtentSearch: currentExtentSearch
                });
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

    Mapbender.Digitizer.Menu.prototype.appendToolset_ = function (frame) {
        var menu = this;
        var schema = menu.schema;

        menu.toolSet = new Mapbender.Digitizer.Toolset(schema);


        if (schema.allowDigitize) {
            frame.append(menu.toolSet.element);
        }


    };

    Mapbender.Digitizer.Menu.prototype.registerResultTableEvents = function (resultTable) {
        var menu = this;
        var schema = menu.schema;
        var map = schema.widget.map;

        map.on(ol.MapEventType.MOVEEND, function (event) {

            if (resultTable.currentExtentSearch) {
                schema.layer.getSource().getFeatures().forEach(function (feature) {
                    if (ol.extent.intersects(schema.widget.map.getView().calculateExtent(), feature.getGeometry().getExtent())) {
                        resultTable.addRow(feature);
                    } else {
                        resultTable.deleteRow(feature);
                    }
                });

            }

        });


        schema.layer.getSource().on("Digitizer.ChangeCurrentExtentSearch", function (event) {
            resultTable.currentExtentSearch = event.currentExtentSearch;
            if (event.currentExtentSearch) {
                resultTable.deleteRows(function (idx, feature, row) {
                    return !ol.extent.intersects(schema.widget.map.getView().calculateExtent(), feature.getGeometry().getExtent())
                });
            } else {
                schema.layer.getSource().getFeatures().forEach(function (feature) {
                    resultTable.addRow(feature);
                });
            }
        });

        schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;

            if (resultTable.currentExtentSearch && !ol.extent.intersects(schema.widget.map.getView().calculateExtent(), feature.getGeometry().getExtent())) {
                return;
            }

            resultTable.addRow(feature);

            feature.on('Digitizer.HoverFeature', function (event) {

                resultTable.hoverInResultTable(feature, event.hover);

            });

            feature.on('Digitizer.ModifyFeature', function (event) {

                var row = resultTable.getTableRowByFeature(feature);

                if (event.allowSaving) {
                    $(row).find('.button.save').removeAttr("disabled");
                } else {
                    $(row).find('.button.save').attr("disabled", "disabled");
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

        var buttons = [];

        if (schema.allowLocate) {
            buttons.push({
                title: Mapbender.DataManager.Translator.translate('feature.zoomTo'),
                className: 'zoom',
                onClick: function (feature, ui) {
                    schema.zoomToFeature(feature);
                }
            });
        }

        if (schema.allowEditData && schema.allowSaveInResultTable) {
            buttons.push({
                title: Mapbender.DataManager.Translator.translate('feature.save.title'),
                className: 'save',
                disabled: true,
                onClick: function (feature, $button) {
                    schema.saveFeature(feature);
                }
            });
        }

        if (schema.allowEditData) {
            buttons.push({
                title: Mapbender.DataManager.Translator.translate('feature.edit'),
                className: 'edit',
                onClick: function (feature, ui) {
                    schema.openFeatureEditDialog(feature);
                }
            });
        }
        if (schema.copy && schema.copy.enable) {
            buttons.push({
                title: Mapbender.DataManager.Translator.translate('feature.clone.title'),
                className: 'copy',
                onClick: function (feature, ui) {
                    schema.copyFeature(feature);
                }
            });
        }
        if (schema.allowCustomStyle) {
            buttons.push({
                title: Mapbender.DataManager.Translator.translate('feature.style.change'),
                className: 'style',
                onClick: function (feature, ui) {
                    schema.openChangeStyleDialog(feature);
                }
            });
        }

        if (schema.allowChangeVisibility) {
            buttons.push({
                title: Mapbender.DataManager.Translator.translate('feature.visibility.toggleoff'),
                className: 'visibility',
                cssClass: 'icon-eyeOff',
                onClick: function (feature, $button) {
                    schema.layer.getSource().dispatchEvent({type: 'toggleFeatureVisibility', feature: feature});
                    if (feature.hidden) {
                        $button.addClass('icon-eyeOn').removeClass('icon-eyeOff');
                        $button.attr('title', Mapbender.DataManager.Translator.translate('feature.visibility.toggleon'));
                    } else {
                        $button.addClass('icon-eyeOff').removeClass('icon-eyeOn');
                        $button.attr('title', Mapbender.DataManager.Translator.translate('feature.visibility.toggleoff'));
                    }
                }
            });
        }

        if (schema.allowPrintMetadata) {
            buttons.push({
                title: 'Sachdaten drucken',
                className: 'printmetadata',
                onClick: function (feature, ui, b, c) {
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
                title: Mapbender.DataManager.Translator.translate("feature.remove.title"),
                className: 'remove',
                cssClass: 'critical',
                onClick: function (feature, ui) {
                    if (schema.allowDelete) {
                        schema.removeFeature(feature);
                    } else {
                        $.notify("Deletion is not allowed");
                    }
                }
            });
        }

        return buttons;


    };



})();
