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

            feature.on('Digitizer.UnmodifyFeature', function (event) {
                var length = schema.layer.getSource().getFeatures().filter(function (feature) {
                    return ["isNew", "isChanged", "isCopy"].includes(feature.get("modificationState"));
                }).length;


                if (length === 0) {
                    frame.find(".resultTableControlButtons .save").attr("disabled", "disabled");
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
                cssClass: 'icon-zoom -fn-zoom-to-feature'
            });
        }

        if (schema.allowEditData && schema.allowSaveInResultTable) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.save.title'),
                cssClass: '-fn-save icon-save'
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
                cssClass: 'icon-eyeOn -fn-toggle-visibility'
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
            $table.on('mouseenter mouseleave', 'tbody > tr', function(event) {
                var hover = event.handleObj.origType === 'mouseenter';
                var feature = $(this).data().item;
                if (feature) {
                    feature.dispatchEvent({type: 'Digitizer.HoverFeature', hover: hover});
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
            this.registerSchemaEvents(schema);
            this.registerButtonEvents(schema, $table);
        },
        registerSchemaEvents: function(schema) {
            // @todo: DO NOT use events on non-DOM Objects; they cannot be listened to from anyone without access to the exact object
            var self = this;
            $(schema).on("Digitizer.FeatureAddedManually", function (event) {
                var dt = self.getDatatablesInstance_(schema);
                dt.row.add(event.feature);
                dt.draw();
            });
        },
        registerButtonEvents: function(schema, $table) {
            $table.on('click', 'tbody > tr .-fn-save', function(event) {
                // Avoid calling row click handlers (may zoom to feature or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var data = $(this).closest('tr').data();
                if (data.schema && data.feature) {
                    schema.saveFeature(data.feature);
                }
            });
            $table.on('click', 'tbody > tr .-fn-toggle-visibility', function(event) {
                // Avoid calling row click handlers (may zoom to feature or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var feature = $(this).closest('tr').data().item;
                feature.set('hidden', !feature.get('hidden'));
                // @todo: resolve self-pollination via events (we listen to this ourselves)
                feature.dispatchEvent({type: 'Digitizer.toggleVisibility', hide: feature.get("hidden")});
            });
            $table.on('click', 'tbody > tr .-fn-zoom-to-feature', function(event) {
                // Avoid calling row click handlers (may already try to zoom to feature, or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var feature = $(this).closest('tr').data().item;
                schema.zoomToFeature(feature);
            })
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
        },
        onRowCreation: function(schema, tr, feature) {
            Mapbender.DataManager.TableRenderer.prototype.onRowCreation.apply(this, arguments);
            // Place table row into feature data for quick access (synchronized highlighting etc)
            feature.set('table-row', tr);
            // Inline save buttons start out disabled
            $('.-fn-save', tr).prop('disabled', true);
            this.registerFeatureEvents(schema, feature);
        },
        registerFeatureEvents: function(schema, feature) {
            var self = this;
            feature.on([
                'Digitizer.ModifyFeature',
                'Digitizer.UnmodifyFeature',
                'Digitizer.toggleVisibility'
                ], function(event) {
                var feature = event.target;
                var tr = feature && feature.get('table-row');
                if (tr) {
                    self.updateButtonStates_(tr, event);
                }
            });
            feature.on('Digitizer.HoverFeature', function (event) {
                var feature = event.target;
                var tr = feature && feature.get('table-row');
                var hover = !!event.hover || (typeof (event.hover) === 'undefined');
                if (tr) {
                    $(tr).toggleClass('hover', hover);
                }
                if (tr && hover) {
                    // Page to currently hovered feature
                    // @todo: this behaviour is highly irritating. It should be configurable and off by default
                    var dt = self.getDatatablesInstance_(schema);
                    // NOTE: current dataTables versions could just do dt.row(tr).show().draw(false)
                    var rowIndex = dt.rows({order: 'current'}).nodes().indexOf(tr);
                    var pageLength = dt.page.len();
                    var rowPage = Math.floor(rowIndex / pageLength);
                    dt.page(rowPage);
                    dt.draw(false);
                }
            });
        },
        updateButtonStates_: function(tr, event) {
            var feature = event.target;
            var hidden = !!feature.get('hidden');
            var tooltip;
            if (hidden) {
                tooltip = Mapbender.trans('mb.digitizer.feature.visibility.toggleon')
            } else {
                tooltip = Mapbender.trans('mb.digitizer.feature.visibility.toggleoff')
            }
            $('.-fn-toggle-visibility', tr)
                .toggleClass('icon-eyeOff', hidden)
                .toggleClass('icon-eyeOn', !hidden)
                .attr('title', tooltip)
            ;
            var activateSave = ['Digitizer.UnmodifyFeature', 'Digitizer.ModifyFeature'].indexOf(event.type);
            if (activateSave !== -1) {
                $('.-fn-save', tr).prop('disabled', !activateSave);
                // @todo: integrate with "save all" button (outside table)?
                // activate (trivial): frame.find(".resultTableControlButtons .save").removeAttr("disabled");
                // @todo: deactivation requires counting of modified features...
            }
        }
    });
})();
