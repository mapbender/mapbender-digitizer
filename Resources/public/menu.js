(function () {
    "use strict";


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;

        var frame = $("<div />").addClass('frame');

        menu.appendToolset_(frame);

        frame.append('<div style="clear:both;"/>');

        menu.appendResultTableControlButtons_(frame);

        menu.appendCurrentExtentSwitch_(frame);

        menu.generateResultTable_(frame);

        frame.hide();

        menu.appendTo = function ($element) {
            $element.append(frame);
        };

        menu.registerEvents_(frame);

        menu.changeCurrentExtentSearch_(schema.currentExtentSearch);

    };

    Mapbender.Digitizer.Menu.prototype = Object.create(Mapbender.DataManager.Menu.prototype);
    Mapbender.Digitizer.Menu.prototype.constructor = Mapbender.DataManager.Menu;


    Mapbender.Digitizer.Menu.prototype.appendResultTableControlButtons_ = function (frame) {
        var menu = this;
        var schema = menu.schema;

        var buttons = {};

        if (schema.showVisibilityNavigation && schema.allowChangeVisibility) {

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("icon-eyeOff eyeOff");
            $button.attr("title", Mapbender.DataManager.Translator.translate('toolset.hideAll'));
            $button.click(function (event) {
                schema.layer.getSource().getFeatures().forEach(function (feature) {
                    feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: true});
                });
            });
            buttons['hideAll'] = $button;

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("icon-eyeOn eyeOn");
            $button.attr("title", Mapbender.DataManager.Translator.translate('toolset.showAll'));
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
            $button.attr("title", Mapbender.DataManager.Translator.translate('toolset.saveAll'));
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
            var title = Mapbender.DataManager.Translator.translate('toolset.current-extent');
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

    Mapbender.Digitizer.Menu.prototype.appendToolset_ = function (frame) {
        var menu = this;
        var schema = menu.schema;

        menu.toolSet = new Mapbender.Digitizer.Toolset(schema);


        if (schema.allowDigitize) {
            frame.append(menu.toolSet.element);
        }


    };


    Mapbender.Digitizer.Menu.prototype.registerResultTableEvents = function (resultTable, frame) {
        var menu = this;
        var schema = menu.schema;
        var widget = schema.widget;
        var map = widget.map;

        menu.changeCurrentExtentSearch_ = function (currentExtentSearch) {
            var menu = this, features = null;
            resultTable.currentExtentSearch = currentExtentSearch;
            if (currentExtentSearch) {
                features = schema.layer.getSource().getFeatures().filter(function (feature) {
                    return widget.isInExtent(feature);
                });
            } else {
                features = schema.layer.getSource().getFeatures();
            }
            resultTable.redraw(features);

        };

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
                    $button.attr('title', Mapbender.DataManager.Translator.translate('feature.visibility.toggleon'));
                } else {
                    $button.addClass('icon-eyeOff').removeClass('icon-eyeOn');
                    $button.attr('title', Mapbender.DataManager.Translator.translate('feature.visibility.toggleoff'));
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
                title: Mapbender.DataManager.Translator.translate('feature.zoomTo'),
                className: 'zoom',
                onClick: function (feature, ui) {
                    schema.zoomToFeature(feature);
                }
            };
        }

        if (schema.allowEditData && schema.allowSaveInResultTable) {
            buttons['save'] = {
                title: Mapbender.DataManager.Translator.translate('feature.save.title'),
                className: 'save',
                disabled: true,
                onClick: function (feature, $button) {
                    schema.saveFeature(feature);
                }
            };
        }

        if (schema.allowEditData) {
            buttons['edit'] = {
                title: Mapbender.DataManager.Translator.translate('feature.edit'),
                className: 'edit',
                onClick: function (feature, ui) {
                    schema.openFeatureEditDialog(feature);
                }
            };
        }
        if (schema.copy && schema.copy.enable) {
            buttons['copy'] = {
                title: Mapbender.DataManager.Translator.translate('feature.clone.title'),
                className: 'copy',
                onClick: function (feature, ui) {
                    schema.copyFeature(feature);
                }
            };
        }
        if (schema.allowCustomStyle) {
            buttons['style'] = {
                title: Mapbender.DataManager.Translator.translate('feature.style.change'),
                className: 'style',
                onClick: function (feature, ui) {
                    schema.openChangeStyleDialog(feature);
                }
            };
        }

        if (schema.allowChangeVisibility) {
            buttons['toggleVisibility'] = {
                title: Mapbender.DataManager.Translator.translate('feature.visibility.toggleoff'),
                className: 'visibility',
                cssClass: 'icon-eyeOff',
                onClick: function (feature, $button) {
                    feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: !feature.get("hidden")});
                }
            };
        }

        if (schema.allowDelete) {

            buttons['delete'] = {
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
            };
        }

        return buttons;


    };


})();
