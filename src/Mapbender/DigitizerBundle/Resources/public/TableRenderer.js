(function () {
    "use strict";

    Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.TableRenderer = function() {
        // Call parent constructor
        Mapbender.DataManager.TableRenderer.apply(this, arguments);

        // Initialize an array to store checked row IDs
        this.selectedFeatures = [];
    };

    // Inherit from DataManager.TableRenderer
    Mapbender.Digitizer.TableRenderer.prototype =
        Object.create(Mapbender.DataManager.TableRenderer.prototype);

    Object.assign(Mapbender.Digitizer.TableRenderer.prototype, {
        constructor: Mapbender.Digitizer.TableRenderer,

        render: function(schema) {
            var table = Mapbender.DataManager.TableRenderer.prototype.render.call(this, schema);
            this.registerEvents(schema, $(table));
            return table;
        },

        registerEvents: function(schema, $table) {
            var widget = this.owner;

            // Hover highlight
            $table.on('mouseenter mouseleave', 'tbody > tr', function(event) {
                var hover = event.handleObj.origType === 'mouseenter';
                var feature = $(this).data().item;
                if (feature) {
                    feature.set('hover', hover);
                }
            });

            // Row click => zoom to feature
            $table.on('click', 'tbody > tr', function (e) {
                var $target = $(e.target);
                if ($target.is('.row-checkbox')) {
                    return true;
                }
                var feature = $(this).data().item;
                if (feature) {
                    widget.zoomToFeature(schema, feature);
                }
            });


            // Existing buttons
            this.registerButtonEvents(schema, $table);    
        },

        registerButtonEvents: function(schema, $table) {
            var self = this;

            $table.on('click', 'tbody > tr .-fn-check-for-export', function(e) {
                e.stopPropagation();
                var $row = $(this).closest('tr');
                var feature = $row.data('item');
                if (!feature) { return; }
                // Toggle selected state, maintain selectedFeatures array
                var idx = self.selectedFeatures.indexOf(feature);
                var selected = (idx >= 0);
                if (selected) {
                    self.selectedFeatures.splice(idx, 1);
                    $('i.fa', this).removeClass('fa-check-square-o').addClass('fa-square-o');
                } else {
                    self.selectedFeatures.push(feature);
                    $('i.fa', this).removeClass('fa-square-o').addClass('fa-check-square-o');
                }
            });

            // Save
            $table.on('click', 'tbody > tr .-fn-save', function(event) {
                event.stopPropagation();
                var data = $(this).closest('tr').data();
                if (data.schema && data.item) {
                    self.owner._saveItem(data.schema, data.item)
                        .fail(function(){
                            self.owner._afterFailedSave(data.schema, data.item);
                        });
                }
            });

            // Toggle visibility
            $table.on('click', 'tbody > tr .-fn-toggle-visibility', function(event) {
                event.stopPropagation();
                var $tr = $(this).closest('tr');
                var feature = $tr.data().item;
                feature.set('hidden', !feature.get('hidden'));
                self.updateButtonStates_($tr.get(0), feature);
            });

            // Edit style
            $table.on('click', 'tbody > tr .-fn-edit-style', function(event) {
                event.stopPropagation();
                var data = $(this).closest('tr').data();
                if (data.schema && data.item) {
                    self.owner.openStyleEditor(data.schema, data.item);
                }
            });

            // Copy
            $table.on('click', 'tbody > tr .-fn-copy', function(event) {
                event.stopPropagation();
                var data = $(this).closest('tr').data();
                if (data.schema && data.item) {
                    self.owner.cloneFeature(data.schema, data.item);
                }
            });
        },

        onRowCreation: function(tableSchema, tr, feature) {
            Mapbender.DataManager.TableRenderer.prototype.onRowCreation.apply(this, arguments);
            // Link table row with feature
            feature.set('table-row', tr);
            // Inline save buttons start out disabled
            $('.-fn-save', tr).prop('disabled', !feature.get('dirty'));
            this.registerFeatureEvents(feature);
        },

        registerFeatureEvents: function(feature) {
            if (feature.get('table-events')) {
                return;
            }
            var self = this;
            feature.on(ol.ObjectEventType.PROPERTYCHANGE, function(event) {
                var feature = event.target;
                var tr = feature && feature.get('table-row');
                if (tr) {
                    switch (event.key) {
                        default:
                            break;
                        case 'dirty':
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

        refreshRow: function(feature, show) {
            Mapbender.DataManager.TableRenderer.prototype.refreshRow.apply(this, arguments);
            var tr = feature && feature.get('table-row');
            if (tr) {
                this.updateButtonStates_(tr, feature);
            }
        },

        updateButtonStates_: function(tr, feature) {
            var hidden = !!feature.get('hidden');
            var tooltip = hidden
                ? Mapbender.trans('mb.digitizer.feature.visibility.toggleon')
                : Mapbender.trans('mb.digitizer.feature.visibility.toggleoff');
            var $visibilityButton = $('.-fn-toggle-visibility', tr);
            // Handle icon class toggling
            var $visibilityIcon = $visibilityButton.children().add($visibilityButton).filter('.fa');
            $visibilityIcon
                .toggleClass('fa-eye-slash', hidden)
                .toggleClass('fa-eye', !hidden)
                .attr('title', tooltip);

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
