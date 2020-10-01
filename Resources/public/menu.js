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


    Mapbender.Digitizer.Menu = function (owner) {
        this.owner = owner;
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
                // @todo: pull value from checkbox, not from (missing) property

                if (resultTable.currentExtentSearch) {
                    var features = schema.layer.getSource().getFeatures().filter(function (feature) {
                        return widget.isInExtent(feature);
                    });
                    resultTable.redraw(features);     // @todo: resolve custom vis-ui dependency
                } else {
                    resultTable.redraw(schema.layer.getSource().getFeatures());   // @todo: resolve custom vis-ui dependency
                }

            }

        });

        schema.layer.getSource().on(ol.source.VectorEventType.ADDFEATURE, function (event) {
            var feature = event.feature;
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function (event) {
                if (event.key === 'dirty' || event.key === 'modificationState') {
                    var length = schema.layer.getSource().getFeatures().filter(function (feature) {
                        return ["isNew", "isChanged", "isCopy"].includes(feature.get("modificationState"));
                    }).length;

                    if (length === 0) {
                        frame.find(".resultTableControlButtons .save").attr("disabled", "disabled");
                    }
                }
            });

        });

        schema.layer.getSource().on(ol.source.VectorEventType.REMOVEFEATURE, function (event) {
            resultTable.deleteRow(event.feature);
        });
    };

    Mapbender.Digitizer.TableRenderer.prototype.getButtonsOption = function(schema) {
        var buttons = [];

        buttons.push({
            title: Mapbender.trans('mb.digitizer.feature.zoomTo'),
            cssClass: 'fa fas fa-crosshairs -fn-zoom-to-feature'
        });

        if (schema.allowEditData && schema.allowSaveInResultTable) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.save.title'),
                cssClass: '-fn-save fa fas fa-save'
            });
        }

        if (schema.copy && schema.copy.enable) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.clone.title'),
                cssClass: 'fa fas fa-copy -fn-copy'
            });
        }
        if (schema.allowCustomStyle) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.style.change'),
                cssClass: '-fn-edit-style fa fas fa-eyedropper fa-eye-dropper'  // NOTE: fas and fa-eye-dropper for FA5+; fa-eyedropper for FA4
            });
        }

        if (schema.allowChangeVisibility) {
            buttons.push({
                title: Mapbender.trans('mb.digitizer.feature.visibility.toggleoff'),
                cssClass: 'fa far fa-eye -fn-toggle-visibility'
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
            var widget = this.owner;
            $table.on('mouseenter mouseleave', 'tbody > tr', function(event) {
                var hover = event.handleObj.origType === 'mouseenter';
                var feature = $(this).data().item;
                if (feature) {
                    feature.dispatchEvent({type: 'Digitizer.HoverFeature', hover: hover});
                }
            });
            $table.on('click', 'tbody > tr', function (e) {
                // Do nothing if click hit an interaction button; return true to allow other handlers
                if ($(e.target).hasClass('button')) {
                    return true;
                }
                var feature = $(this).data().item;
                if (feature) {
                    if (schema.zoomOnResultTableClick) {
                        widget.zoomToFeature(schema, feature);
                    }
                    if (schema.openDialogOnResultTableClick) {
                        schema.openFeatureEditDialog(feature);
                    }
                }
            });
            this.registerButtonEvents(schema, $table);
        },
        registerButtonEvents: function(schema, $table) {
            var self = this;
            $table.on('click', 'tbody > tr .-fn-save', function(event) {
                // Avoid calling row click handlers (may zoom to feature or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var data = $(this).closest('tr').data();
                if (data.schema && data.item) {
                    self.owner._saveItem(data.schema, undefined, data.item);
                }
            });
            $table.on('click', 'tbody > tr .-fn-toggle-visibility', function(event) {
                // Avoid calling row click handlers (may zoom to feature or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var $tr = $(this).closest('tr');
                var feature = $tr.data().item;
                feature.set('hidden', !feature.get('hidden'));
                self.updateButtonStates_($tr.get(0), feature);
            });
            $table.on('click', 'tbody > tr .-fn-zoom-to-feature', function(event) {
                // Avoid calling row click handlers (may already try to zoom to feature, or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var feature = $(this).closest('tr').data().item;
                self.owner.zoomToFeature(schema, feature);
            });
            $table.on('click', 'tbody > tr .-fn-edit-style', function(event) {
                var data = $(this).closest('tr').data();
                if (data.schema && data.item) {
                    self.owner.openStyleEditor(data.schema, data.item);
                }
            });
            $table.on('click', 'tbody > tr .-fn-copy', function(event) {
                // Avoid calling row click handlers (may already try to zoom to feature, or open the edit dialog, depending on schema config)
                event.stopPropagation();
                var data = $(this).closest('tr').data();
                if (data.schema && data.item) {
                    data.schema.copyFeature(data.item);
                }
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
        },
        onRowCreation: function(schema, tr, feature) {
            Mapbender.DataManager.TableRenderer.prototype.onRowCreation.apply(this, arguments);
            // Place table row into feature data for quick access (synchronized highlighting etc)
            feature.set('table-row', tr);
            // Inline save buttons start out disabled
            $('.-fn-save', tr).prop('disabled', !feature.get('dirty'));
            this.registerFeatureEvents(schema, feature);
        },
        registerFeatureEvents: function(schema, feature) {
            var self = this;
            // Update interaction buttons when "hidden" and "dirty" values change
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function(event) {
                var feature = event.target;
                var tr = feature && feature.get('table-row');
                if (tr) {
                    self.updateButtonStates_(tr, feature);
                }
            });
            feature.on('Digitizer.HoverFeature', function (event) {
                var feature = event.target;
                var tr = feature && feature.get('table-row');
                var hover = !!event.hover || (typeof (event.hover) === 'undefined');
                if (tr) {
                    $(tr).toggleClass('hover', hover);
                }
            });
        },
        updateButtonStates_: function(tr, feature) {
            var hidden = !!feature.get('hidden');
            var tooltip;
            if (hidden) {
                tooltip = Mapbender.trans('mb.digitizer.feature.visibility.toggleon')
            } else {
                tooltip = Mapbender.trans('mb.digitizer.feature.visibility.toggleoff')
            }
            $('.-fn-toggle-visibility', tr)
                .toggleClass('fa-eye-slash', hidden)
                .toggleClass('fa-eye', !hidden)
                .attr('title', tooltip)
            ;
            $('.-fn-save', tr).prop('disabled', !feature.get('dirty'));
            // @todo: integrate with "save all" button (outside table)?
            // activate (trivial): frame.find(".resultTableControlButtons .save").removeAttr("disabled");
            // @todo: deactivation requires counting of modified features...
        }
    });
})();
