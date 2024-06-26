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
                    feature.set('hover', hover);
                }
            });
            $table.on('click', 'tbody > tr', function (e) {
                // Do nothing if click hit an interaction button; return true to allow other handlers
                var $target = $(e.target);
                var $parentsAndSelf = $target.parentsUntil(this).add($target);
                if ($parentsAndSelf.filter('.button,.btn').length) {
                    return true;
                }
                var feature = $(this).data().item;
                if (feature) {
                    widget.zoomToFeature(schema, feature);
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
                    self.owner._saveItem(data.schema, data.item).fail(function(){
                        self.owner._afterFailedSave(data.schema,data.item);
                    });
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
                    self.owner.cloneFeature(data.schema, data.item);
                }
            });
        },
        onRowCreation: function(tableSchema, tr, feature) {
            Mapbender.DataManager.TableRenderer.prototype.onRowCreation.apply(this, arguments);
            // Place table row into feature data for quick access (synchronized highlighting etc)
            feature.set('table-row', tr);
            // Inline save buttons start out disabled
            $('.-fn-save', tr).prop('disabled', !feature.get('dirty'));
            this.registerFeatureEvents(feature);
        },
        registerFeatureEvents: function(feature) {
            // Avoid registering same event handlers on the same feature multiple times
            if (feature.get('table-events')) {
                return;
            }
            // @todo: track across multiple tables

            var self = this;
            // Update interaction buttons when "hidden" and "dirty" values change
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function(event) {
                var feature = event.target;
                var tr = feature && feature.get('table-row');
                if (tr) {
                    switch (event.key) {
                        default:
                            // do nothing
                            break;
                        case 'dirty':
                            // Page to feature on initial modification
                            if (feature.get('dirty')) {
                                self.showRow(tr);
                            }
                            self.updateButtonStates_(tr, feature);
                            break;
                        case 'hover':
                        case 'editing':
                            $(tr).toggleClass('hover', !!feature.get('hover'));
                            $(tr).toggleClass('table-info', !!feature.get('editing'));
                            break;
                    }


                    if (event.key === 'dirty' && feature.get('dirty')) {
                        self.showRow(tr);
                    }
                    self.updateButtonStates_(tr, feature);
                }
            });
            feature.set('table-events', true);
        },
        /**
         * @param {Object} feature
         * @param {Boolean} show to automatically update pagination
         */
        refreshRow: function(feature, show) {
            Mapbender.DataManager.TableRenderer.prototype.refreshRow.apply(this, arguments);

            var tr = feature && feature.get('table-row');
            if (tr) {
                this.updateButtonStates_(tr, feature);
            }
        },
        updateButtonStates_: function(tr, feature) {
            var hidden = !!feature.get('hidden');
            var tooltip;
            if (hidden) {
                tooltip = Mapbender.trans('mb.digitizer.feature.visibility.toggleon')
            } else {
                tooltip = Mapbender.trans('mb.digitizer.feature.visibility.toggleoff')
            }
            var $visibilityButton = $('.-fn-toggle-visibility', tr);
            // Support both icon class ON button (legacy misuse) and icon markup INSIDE button transparently
            var $visibilityIcon = $visibilityButton.children().add($visibilityButton).filter('.fa');
            $visibilityIcon
                .toggleClass('fa-eye-slash', hidden)
                .toggleClass('fa-eye', !hidden)
                .attr('title', tooltip)
            ;
            $('.-fn-save', tr).prop('disabled', !feature.get('dirty'));

            if (!!feature.get('dirty')) {
                $('.-fn-save', tr).removeClass('btn-outline-primary');
                $('.-fn-save', tr).addClass('btn-primary');
            } else {
                $('.-fn-save', tr).removeClass('btn-primary');
                $('.-fn-save', tr).addClass('btn-outline-primary');
            }
        }
    });
})();
