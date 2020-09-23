(function () {
    "use strict";

    Mapbender.Digitizer = Mapbender.Digitizer || {};
    Mapbender.Digitizer.TableRenderer = function() {
        Mapbender.DataManager.TableRenderer.apply(this, arguments);
    };
    Mapbender.Digitizer.TableRenderer.prototype = Object.create(Mapbender.DataManager.TableRenderer.prototype);
    Object.assign(Mapbender.Digitizer.TableRenderer.prototype, {
        constructor: Mapbender.Digitizer.TableRenderer
    });


    Mapbender.Digitizer.Menu = function (schema) {

        var menu = this;
        menu.schema = schema;

        var frame = $("<div />").addClass('frame');

        frame.append('<div style="clear:both;"/>');

        menu.appendResultTableControlButtons_(frame);

        menu.appendCurrentExtentSwitch_(frame);

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

        schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;

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

    Mapbender.Digitizer.TableRenderer.prototype.getButtonsOption = function(schema) {
        var buttons = [];

        if (schema.allowLocate) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.zoomTo'),
                cssClass: 'icon-zoom zoom', // NOTE: "zoom" class required for getButtonByFeature ...
                onClick: function (feature, ui) {
                    schema.zoomToFeature(feature);
                }
            });
        }

        if (schema.allowEditData && schema.allowSaveInResultTable) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.save.title'),
                cssClass: 'icon-save save', // NOTE: "save" class required for getButtonByFeature ...
                disabled: true,
                onClick: function (feature, $button) {
                    schema.saveFeature(feature);
                }
            });
        }

        if (schema.copy && schema.copy.enable) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.clone.title'),
                cssClass: 'icon-copy copy', // NOTE: "copy" class required for getButtonByFeature ...
                onClick: function (feature, ui) {
                    schema.copyFeature(feature);
                }
            });
        }
        if (schema.allowCustomStyle) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.style.change'),
                cssClass: 'icon-style style', // NOTE: "style" class required for getButtonByFeature ...
                onClick: function (feature, ui) {
                    schema.openChangeStyleDialog(feature);
                }
            });
        }

        if (schema.allowChangeVisibility) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'),
                cssClass: 'icon-eyeOff visibility', // NOTE: "visibility" class required for getButtonByFeature ...
                onClick: function (feature, $button) {
                    feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: !feature.get("hidden")});
                }
            });
        }
        var upstreamButtons = Mapbender.DataManager.TableRenderer.prototype.getButtonsOption.call(this, schema);
        return _.union(buttons, upstreamButtons);
    };

    Object.assign(Mapbender.Digitizer.TableRenderer.prototype, {
        render: function(schema) {
            var table = Mapbender.DataManager.TableRenderer.prototype.render.call(this, schema);
            this.registerEvents(schema, $(table));
            return table;
        },
        registerEvents: function(schema, $table) {
            $table.on('mouseenter', 'tbody > tr', function () {
                var feature = $(this).data().item;
                if (feature) {
                    feature.dispatchEvent({type: 'Digitizer.HoverFeature'});
                }
            });
            $table.on('mouseleave', 'tbody > tr', function () {
                var feature = $(this).data().item;
                if (feature) {
                    feature.dispatchEvent({type: 'Digitizer.UnhoverFeature'});
                }
            });
            $table.on('click', 'tbody > tr', function () {
                var feature = $(this).data().item;
                if (feature) {
                    if (schema.zoomOnResultTableClick) {
                        schema.zoomToFeature(feature);
                    }
                    if (schema.openDialogOnResultTableClick) {
                        schema.openFeatureEditDialog(feature);
                    }
                }
            });
            // @todo: DO NOT use events on non-DOM Objects; they cannot be listened to from anyone without access to the exact object
            var self = this;
            $(schema).on("Digitizer.FeatureAddedManually", function (event) {
                var feature = event.feature;
                if (!feature.get('data')) {
                    console.warn("Ignoring event for feature without table-displayable data");
                    return;
                }
                var dt = self.getDatatablesInstance_(schema);
                console.log("Hello", event);
                dt.row.add(event.feature);
                dt.draw();
            });
        },
        getCustomOptions: function(schema) {
            // Unlike upstream DM, we DO NOT want to forward any random value from schema config
            // into the dataTables / resultTable widget constructor
            return undefined;
        },
        getOptions: function(schema) {
            var options = Mapbender.DataManager.TableRenderer.prototype.getOptions.call(this, schema);
            if (typeof (schema.pageLength) !== 'undefined') {
                options.pageLength = schema.pageLength;
            }
            options.searching = !!schema.inlineSearch || (typeof (schema.inlineSearch) === 'undefined');
            return options;
        },
        getDefaultColumnConfigs: function(schema) {
            // @todo DataManager: data manager does not use default columns, but it should; without
            //                    columns, dataTables crashes immediately.
            var tableFields = [];

            tableFields.push({
                data: schema.featureType.uniqueId,
                label: 'Nr.',
                width: '20%'
            });
            return tableFields;
        },
        getColumnsConfigs: function(schema) {
            var fieldConfigs = schema.tableFields || [];
            if (!Array.isArray(fieldConfigs)) {
                // Digitizer vs DM quirk: digitizer uses a PHP-style mapping of attribute name to other config values
                // Adapt by unravelling object-to-object mapping to list of object; add the top-level key as the "data" property
                fieldConfigs = _.map(fieldConfigs, function(value, key) {
                    return Object.assign({}, value, {
                        data: key
                    });
                });
            }
            if (!fieldConfigs.length) {
                fieldConfigs = this.getDefaultColumnConfigs(schema);
            }
            return fieldConfigs;
        }
    });
})();
