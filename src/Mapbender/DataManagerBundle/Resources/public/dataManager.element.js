(function($) {
    /**
     * @typedef {Object} DataManagerItem
     */
    /**
     * @typedef {Object} DataStoreConfig
     * @property {String} id
     * @property {String} uniqueId
     */
    /**
     * @typedef {Object} DataManagerSchemaConfig
     * @property {String} schemaName identifier for schema
     * @property {DataStoreConfig} dataStore
     * @property {boolean} allowEdit
     * @property {boolean} allowCreate
     * @property {boolean} allowDelete
     * @property {boolean} allowRefresh
     * @property {String} label
     * @property {Array<*>} formItems
     * @property {Object} popup
     * @property {String} popup.title
     * @property {String} popup.width
     * @property {*} table
     */
    /**
     * @typedef {Object} DataManagagerBaseEventData
     * @property {Object} item
     * @property {String} itemId
     * @property {DataManagerSchemaConfig} schema
     * @property {*} originator sending widget instance
     */
    /**
     * @typedef {DataManagagerBaseEventData} DataManagerDeletedEventData
     * @property {String} schemaName
     * @property {Object} feature digitizer / bc amenity
     */
    /**
     * @typedef {DataManagagerBaseEventData} DataManagagerSaveEventData
     * @property {(String|null)} originalId null for newly saved item
     * @property {String} uniqueIdKey legacy: name of attribute on item that contains id
     * @property {String} schemaName identifier for schema
     * @property {String} scheme legacy (ambiguous): alias for schemaName
     */

    $.widget("mapbender.mbDataManager", {
        options: {
            /** @type {Object<String, DataManagerSchemaConfig>} */
            schemes: {}
        },
        /** @type {(DataManagerSchemaConfig|null)} */
        currentSettings: null,

        _create: function() {
            this.elementUrl = [
                Mapbender.configuration.application.urls.element,
                this.element.attr('id'),
                ''  // produce trailing slash
            ].join('/');
            this.selector = $(this._renderSchemaSelector(this.element));
            this.formRenderer_ = this._createFormRenderer();
            this.dialogFactory_ = Mapbender.DataManager.DialogFactory;
            this.tableRenderer = this._createTableRenderer();
            this._initializeEvents();
            this._afterCreate();
        },

        _createFormRenderer: function() {
            return new Mapbender.DataManager.FormRenderer(this, this.options.schemes);
        },
        _createTableRenderer: function() {
            return new Mapbender.DataManager.TableRenderer(this);
        },
        /**
         * @param {jQuery} $container to render into
         * @return {*|jQuery|HTMLElement} should always be (or wrap) the <select> tag
         * @private
         */
        _renderSchemaSelector: function($container) {
            var widget = this;
            var selector = $('<select class="selector -fn-schema-selector"/>');
            if ((typeof this.options.schemes !== 'object') || $.isArray(this.options.schemes)) {
                throw new Error("Invalid type for schemes configuration " + (typeof this.options.schemes));
            }
            // Use _.size, to support both Array and Object types
            var nSchemes = _.size(this.options.schemes);
            if (!nSchemes) {
                throw new Error("Missing schemes configuration");
            }

            if (nSchemes === 1) {
                var singleScheme = _.first(_.toArray(this.options.schemes));
                var title = singleScheme.label || singleScheme.schemaName;
                if(title) {
                    $container.append($('<h3 class="title"/>').text(title));
                }
                selector.hide();
            }
            this.hasOnlyOneScheme = (nSchemes === 1);
            $container.append(selector);

            let visibleSchemes = this._filterVisibleSchemes();

            // build select options
            _.each(visibleSchemes, function(schemaConfig) {
                var option = $("<option/>");
                option.val(schemaConfig.schemaName).text(schemaConfig.label);
                option.data('schema', schemaConfig);
                selector.append(option);
            });
            return selector;
        },

        _filterVisibleSchemes: function() {
            return this.options.schemes;
        },
        /**
         * Unraveled from _create for child class actions after initialization, but
         * before triggering ready event and loading the first set of data.
         * @private
         */
        _afterCreate: function() {
            this._start();
        },
        /**
         * Loads and displays data from initially selected schema.
         * Unraveled from _create for child classes need to act after our initialization,
         * but before loading the first set of data.
         * @private
         */
        _start: function() {
            this._trigger('ready');
            // Use schema change event, it does everything we need
            this.selector.trigger('change');
        },
        _initializeEvents: function() {
            var self = this;
            $('select.selector', this.element).on('change', function() {
                self._onSchemaSelectorChange();
            });
            this.element.on('click', '.-fn-edit-data', function() {
                var $tr = $(this).closest('tr');
                self._openEditDialog($tr.data('schema'), $tr.data('item'));
            });
            this.element.on('click', '.-fn-delete', function() {
                var $tr = $(this).closest('tr');
                self.removeData($tr.data('schema'), $tr.data('item'));
            });
            this.element.on('click', '.-fn-refresh-schema', function() {
                var schema = $(this).data('schema');
                self._closeCurrentPopup();
                self._getData(schema);
            });
            this.element.on('click', '.-fn-create-item', function() {
                var schema = $(this).data('schema');
                self._createItem(schema);
            });
        },
        /**
         * Mapbender sidepane interaction API
         */
        hide: function() {
            this._closeCurrentPopup();
        },
        /**
         * @todo Digitizer: use .featureType attribute instead of .dataStore (otherwise equivalent)
         * @param {DataManagerSchemaConfig} schema
         * @return {DataStoreConfig}
         */
        _getDataStoreFromSchema: function(schema) {
            return schema.dataStore;
        },
        _closeCurrentPopup: function() {
            if (this.currentPopup) {
                if (this.currentPopup.dialog('instance')) {
                    this.currentPopup.dialog('destroy');
                }
                this.currentPopup = null;
            }
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _activateSchema: function(schema) {
            if (this.currentSettings) {
                this._deactivateSchema(this.currentSettings);
                this.currentSettings = null;
            }
            $('.frame', this.element).remove();
            this.currentSettings = schema;
            $('select.selector', this.element).after(this._renderSchemaFrame(schema));
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _deactivateSchema: function(schema) {
            this._closeCurrentPopup();
        },
        _getCurrentSchema: function() {
            var $select = $('select.selector', this.element);
            var option = $('option:selected', $select);
            return option.data("schema");
        },
        _onSchemaSelectorChange: function() {
            var schemaNew = this._getCurrentSchema();
            this._activateSchema(schemaNew);
            this._getData(schemaNew);
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {jQuery}
         * @private
         */
        _renderSchemaFrame: function(schema) {
            var frame =  $("<div/>")
                .addClass('frame')
                .data("schema", schema)
            ;
            var $toolset = $('<div>').addClass('schema-toolset');
            frame.append($toolset);
            this._updateToolset($toolset, schema);

            frame.append($toolset);
            var $loadingIndicator = $(document.createElement('div'))
                .addClass('loading-indicator')
                .css({opacity: 0})
                .append($('<i class="fa fas fa-spinner fa-spin">'))
            ;
            frame.append($loadingIndicator);
            frame.append(this.tableRenderer.render(schema));
            return frame;
        },
        /**
         * @param {jQuery} $container
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _updateToolset: function($container, schema) {
            $container.empty();
            var toolset = this._renderToolset(schema);
            $container.append(toolset);
        },
        /**
         * @param {DataManagerSchemaConfig}schema
         * @return {Array<(Element|{jQuery})>}
         * @private
         */
        _renderToolset: function(schema) {
            var buttons = [];
            if (schema.allowRefresh) {
                var $refreshButton = $('<button>').data('schema', schema).attr({
                    type: 'button',
                    'class': 'btn btn-sm -fn-refresh-schema btn-default',
                    title: Mapbender.trans('mb.actions.refresh')
                });
                $refreshButton.append($('<i/>').addClass('fa fa-refresh'));
                buttons.push($refreshButton);
            }

            if (schema.allowCreate) {
                var $createButton = $('<button>').data('schema', schema).attr({
                    type: 'button',
                    'class': 'btn btn-sm -fn-create-item btn-default',
                    title: Mapbender.trans('mb.data.store.create')
                });
                $createButton.append($('<i/>').addClass('fa fa-plus'));
                buttons.push($createButton);
            }
            if (buttons.length) {
                var $group = $(document.createElement('span'))
                    .addClass('btn-group')
                    .append(buttons)
                ;
                return $group.get();
            } else {
                return [];
            }
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {Object} [newValues]
         * @return {Promise}
         * @private
         */
        _saveItem: function(schema, dataItem, newValues) {
            var self = this;
            var params = {
                schema: schema.schemaName
            };
            var id = this._getUniqueItemId(schema, dataItem);
            if (id) {
                params.id = id;
            }
            var submitData = this._getSaveRequestData(schema, dataItem, newValues);
            return this.postJSON('save?' + $.param(params), submitData)
                .then(function(response) {
                    self._afterSave(schema, dataItem, id, response);
                    return response;
                })
            ;
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {Object} [newValues]
         * @return {{dataItem: *}}
         * @private
         */
        _getSaveRequestData: function(schema, dataItem, newValues) {
            return {
                dataItem: Object.assign({}, this._getItemData(schema, dataItem), newValues || {})
            };
        },
        /**
         * Produces event after item has been saved on the server.
         * New items have a null originalId. Updated items have a non-empty originalId.
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {(String|null)} originalId
         * @private
         */
        _saveEvent: function(schema, dataItem, originalId) {
            /** @var {DataManagagerSaveEventData} eventData */
            var eventData = {
                item: dataItem,
                itemId: this._getUniqueItemId(schema, dataItem),
                originalId: originalId,
                uniqueIdKey: this._getUniqueItemIdProperty(schema),
                schema: schema,
                schemaName: schema.schemaName,
                scheme: schema.schemaName,
                originator: this
            };
            this.element.trigger('data.manager.item.saved', eventData);
        },
        /**
         * Called after item has been stored on the server.
         * New items have a null originalId. Updated items have a non-empty originalId.
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {String|null} originalId
         * @param {Object} responseData
         * @private
         */
        _afterSave: function(schema, dataItem, originalId, responseData) {
            this._replaceItemData(schema, dataItem, responseData.dataItem);
            if (!originalId) {
                // new item
                this.tableRenderer.addRow(schema, dataItem, true);
            } else {
                this.tableRenderer.refreshRow(schema, dataItem, true);
            }
            this._saveEvent(schema, dataItem, originalId);
            $.notify(Mapbender.trans('mb.data.store.save.successfully'), 'info');
        },
        _updateCalculatedText: function($elements, data) {
            $elements.each(function() {
                var expression = $(this).attr('data-expression');
                var textContent = function(data) {
                    return eval(expression);
                }(data);
                $(this).text(textContent);
            });
        },
        /**
         * @param {jQuery} $form
         * @return {Object|boolean} false on any invalid form inputs
         * @private
         */
        _getFormData: function($form) {
            var valid = Mapbender.DataManager.FormUtil.validateForm($form);
            return valid && Mapbender.DataManager.FormUtil.extractValues($form, true);
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {jQuery} $scope
         * @param {Object} [dataItem]
         * @return {boolean|Promise}
         * @private
         */
        _submitFormData: function(schema, $scope, dataItem) {
            var formData = this._getFormData($scope);

            if (formData) {
                var uniqueIdAttribute = this._getUniqueItemIdProperty(schema);
                if (typeof formData[uniqueIdAttribute] !== 'undefined') {
                    console.warn("Form contains an input field for the object id", schema);
                }
                delete formData[uniqueIdAttribute];
                return this._saveItem(schema, dataItem, formData);
            } else {
                return false;
            }
        },
        /**
         * Gets persistent data properties of the item
         * @return {Object}
         */
        _getItemData: function(schema, dataItem) {
            // Trivial in data manager: the item and the item data are completely interchangeable
            // @todo Digitizer: when working with native Openlayers feature, return data properties instead of top-level object
            return dataItem;
        },
        /**
         * Places updated data (from form or otherwise) back into the item
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {Object} newValues
         * @private
         */
        _replaceItemData: function(schema, dataItem, newValues) {
            // @todo Digitizer: when working with native Openlayers feature, use data properties instead of top-level object
            _.extend(dataItem, newValues);
        },
        /**
         * Open edit feature dialog
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @private
         */
        _openEditDialog: function(schema, dataItem) {
            var widget = this;
            this._closeCurrentPopup();
            var itemValues = this._getItemData(schema, dataItem);

            var dialog = $("<div/>");
            dialog.append(this.formRenderer_.renderElements(schema.formItems));
            if (!schema.allowEdit) {
                $('.-fn-delete-attachment', dialog).remove();
            }
            var dialogOptions = this._getEditDialogPopupConfig(schema, dataItem);
            if (!$('> .ui-tabs', dialog).length) {
                dialog.addClass('content-padding');
            }
            this.dialogFactory_.dialog(dialog, dialogOptions);
            widget.currentPopup = dialog;
            Mapbender.DataManager.FormUtil.setValues(dialog, itemValues);
            var schemaBaseUrl = [this.elementUrl, schema.schemaName, '/'].join('');
            this.formRenderer_.updateFileInputs(dialog, schemaBaseUrl, itemValues);
            // Legacy custom vis-ui event shenanigans
            $('.-js-custom-events[name]', dialog).each(function() {
                $(this).trigger('filled', {data: itemValues, value: itemValues[$(this).attr('name')]});
            });

            this._updateCalculatedText($('.-fn-calculated-text', dialog), itemValues);

            dialog.on('click', '.form-group .-fn-copytoclipboard', function() {
                var $input = $(':input', $(this).closest('.form-group'));
                Mapbender.DataManager.FormUtil.copyToClipboard($input);
            });
            this.formRenderer_.initializeWidgets(dialog, schemaBaseUrl);

            dialog.one('dialogclose', function() {
                widget._cancelForm(schema, dataItem);
            });

            return dialog;
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @return {Object}
         * @see https://api.jqueryui.com/1.12/dialog/
         * @private
         */
        _getEditDialogPopupConfig: function(schema, dataItem) {
            var width = schema.popup.width;
            // NOTE: unlike width, which allows CSS units, minWidth option is expected to be a pure pixel number
            var minWidth = 550;
            if (/\d+px/.test(width || '')) {
                minWidth = parseInt(width.replace(/px$/, '')) || minWidth
            }
            return {
                title: schema.popup.title || Mapbender.trans('mb.data-manager.details_title'),
                width: schema.popup.width,
                minWidth: minWidth,
                classes: {
                    'ui-dialog-content': 'ui-dialog-content data-manager-edit-data'
                },
                buttons: this._getEditDialogButtons(schema, dataItem)
            };
        },
        /**
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @return {Array<Object>}
         * @private
         */
        _getEditDialogButtons: function(schema, dataItem) {
            var buttons = [];
            var widget = this;
            if (schema.allowEdit) {
                buttons.push({
                    text: Mapbender.trans('mb.actions.save'),
                    click: function() {
                        var $scope = $(this).closest('.ui-dialog-content');
                        var saved = widget._submitFormData(schema, $scope, dataItem);
                        if (saved) {
                            saved.then(function() {
                                widget._closeCurrentPopup();
                            });
                        }
                    }
                });
            }
            if (schema.allowDelete && this._getUniqueItemId(schema, dataItem)) {
                buttons.push({
                    text: Mapbender.trans('mb.actions.delete'),
                    'class': 'critical',
                    click: function() {
                        widget._closeCurrentPopup();
                        widget.removeData(schema, dataItem);
                    }
                });
            }
            buttons.push({
                text: Mapbender.trans('mb.actions.cancel'),
                click: function() {
                    widget._cancelForm(schema, dataItem);
                }
            });
            // @todo Digitizer: add custom schema buttons...?

            return buttons;
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _createItem: function(schema) {
            this._openEditDialog(schema, {});
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @private
         */
        _cancelForm: function(schema, dataItem) {
            this._closeCurrentPopup();
            // @todo Digitizer: discard geometry modifications / discard entire item if it's new
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Object}
         */
        _getSelectRequestParams: function(schema) {
            return {
                schema: schema.schemaName
            };
        },
        /**
         * @private
         */
        _getData: function(schema) {
            var widget = this;
            return this.getJSON('select', this._getSelectRequestParams(schema))
                .then(function(dataItems) {
                    var preparedItems = dataItems.map(function(itemData) {
                        return widget._prepareDataItem(schema, itemData);
                    });
                    widget.tableRenderer.replaceRows(schema, preparedItems);
                    return preparedItems;
                })
            ;
        },
        /**
         * Transforms data item server response data to internally used item structure.
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} data
         * @return {*}
         * @private
         */
        _prepareDataItem: function(schema, data) {
            // trivial in data-manager: data item and plain data objects are interchangeable
            // @todo Digitizer: create Openlayers feature
            return data;
        },
        /**
         * Remove data item
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         */
        removeData: function(schema, dataItem) {
            var widget = this;
            var id = this._getUniqueItemId(schema, dataItem);
            if (!id) {
                throw new Error("Can't delete item without id from server");
            }
            this.confirmDialog(Mapbender.trans('mb.data.store.remove.confirm.text')).then(function() {
                var params ={
                    schema: schema.schemaName,
                    id: id
                };
                widget.postJSON('delete?' + $.param(params), null, {
                    method: 'DELETE'
                }).done(function() {
                    widget._afterRemove(schema, dataItem, id);
                });
            });
        },
        /**
         * Produces event after item has been deleted server-side
         *
         * @param schema
         * @param dataItem
         * @param id
         * @private
         */
        _deleteEvent: function(schema, dataItem, id) {
            // Quirky jquery ui event. Triggers a 'mbdatamanagerremove' on this.element. Limited legacy data payload.
            this._trigger('removed', null, {
                schema: schema,
                feature: dataItem
            });
            /** @type {DataManagerDeletedEventData} */
            var eventData = {
                schema: schema,
                schemaName: schema.schemaName,
                item: dataItem,
                // Digitizer / bc amenity
                feature: dataItem,
                itemId: id,
                // sending widget instance
                originator: this
            };

            // Listeners should prefer data.manager.item.deleted because a) it is much easier to search for non-magic, explicit
            // event names in project code; b) it contains more data
            this.element.trigger('data.manager.item.deleted', eventData);
        },
        /**
         * Called after item has been deleted from the server
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {String} id
         * @private
         */
        _afterRemove: function(schema, dataItem, id) {
            this.tableRenderer.removeRow(schema, dataItem);
            this._deleteEvent(schema, dataItem, id);
            $.notify(Mapbender.trans('mb.data.store.remove.successfully'), 'info');
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {String}
         * @private
         */
        _getUniqueItemIdProperty: function(schema) {
            // @todo: this default should be server provided
            return this._getDataStoreFromSchema(schema).uniqueId || 'id';
        },
        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} item
         * @return {(String|null)}
         * @private
         */
        _getUniqueItemId: function(schema, item) {
            var itemData = this._getItemData(schema, item);
            var idProperty = this._getUniqueItemIdProperty(schema);
            return itemData[idProperty] || null;
        },
        /**
         * @param {String} uri
         * @param {Object} [data]
         * @return {jQuery.Deferred}
         */
        getJSON: function(uri, data) {
            var url = this.elementUrl + uri;
            var $loadingIndicator = $('.loading-indicator', this.element);
            $loadingIndicator.css({opacity: 1});
            return $.getJSON(url, data)
                .fail(this._onAjaxError)
                .always(function() {
                    $loadingIndicator.css({opacity: 0})
                })
            ;
        },
        postJSON: function(uri, data, options) {
            var options_ = {
                url: this.elementUrl + uri,
                method: 'POST',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json'
            };
            _.extend(options_, options || {});
            if (data && !options_.data) {
                options_.data = JSON.stringify(data);
            }
            var $loadingIndicator = $('.loading-indicator', this.element);
            $loadingIndicator.css({opacity: 1});
            return $.ajax(options_)
                .fail(this._onAjaxError)
                .always(function() {
                    $loadingIndicator.css({opacity: 0})
                })
            ;
        },
        _onAjaxError: function(xhr) {
            var errorMessage = Mapbender.trans('mb.data.store.api.query.error-message');
            console.error(errorMessage, xhr);
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = [errorMessage, xhr.responseJSON.message].join(":\n");
            }
            $.notify(errorMessage, {
                autoHide: false
            });
        },
        /**
         * Promise-based confirmation dialog utility.
         * @param {String} title
         * @return {Promise}
         * @static
         */
        confirmDialog: function confirmDialog(title) {
            return this.dialogFactory_.confirm(title);
        },
        /**
         * Utility method to escape HTML chars
         * @param {String} text
         * @returns {string}
         * @static
         */
        escapeHtml: function escapeHtml(text) {
            'use strict';
            return text.replace(/["&'\/<>]/g, function (a) {
                return {
                    '"': '&quot;', '&': '&amp;', "'": '&#39;',
                    '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
                }[a];
            });
        },
        __dummy: null
    });

})(jQuery);
