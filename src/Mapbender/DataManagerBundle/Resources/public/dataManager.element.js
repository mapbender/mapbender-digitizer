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
     * @property {Array<String>} [combine]
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
        /** @type {{DataManagerSchemaConfig|null}} */
        currentSettings: null,

        _create: function() {
            if (Array.isArray(this.options.schemes) || !Object.keys(this.options.schemes).length) {
                throw new Error("Missing schema configuration");
            }
            this.elementUrl = [
                Mapbender.configuration.application.urls.element,
                this.element.attr('id'),
                ''  // produce trailing slash
            ].join('/');

            this.selector = $(this._renderSchemaSelector(this.element));
            this.formRenderer_ = this._createFormRenderer();
            this.dialogFactory_ = Mapbender.DataManager.DialogFactory;
            var schemaNames = Object.keys(this.options.schemes);
            for (var s = 0; s < schemaNames.length; ++s) {
                var schemaName = schemaNames[s];
                var schema = this.options.schemes[schemaName];
                if (!schema.combine) {
                    var fileConfigs = this._getDataStoreFromSchema(schema).files || [];
                    var schemaBaseUrl = [this.elementUrl, schemaName, '/'].join('');
                    this.formRenderer_.prepareItems(schema.formItems || [], schemaBaseUrl, fileConfigs);
                }
            }
            this.tableRenderer = this._createTableRenderer();
            this._initializeEvents();
            this._afterCreate();
        },
        _createFormRenderer: function() {
            return new Mapbender.DataManager.FormRenderer();
        },
        _createTableRenderer: function() {
            var buttonsTemplate = $('.-tpl-table-buttons', this.element).remove().css('display', '').html();
            return new Mapbender.DataManager.TableRenderer(this, buttonsTemplate);
        },
        /**
         * @param {jQuery} $container to render into
         * @return {*|jQuery|HTMLElement} should always be (or wrap) the <select> tag
         * @private
         */
        _renderSchemaSelector: function($container) {
            var self = this;
            var selector = $('<select class="selector -fn-schema-selector"/>');
            var schemaNames = Object.keys(this.options.schemes);
            var visible = schemaNames.filter(function(schemaName) {
                return self.options.schemes[schemaName].listed;
            });

            if (visible.length === 1) {
                var singleScheme = this.options.schemes[visible[0]];
                var title = singleScheme.label || singleScheme.schemaName;
                if(title) {
                    $container.append($('<h3 class="title"/>').text(title));
                }
                selector.hide();
            }
            // build select options
            for (var i = 0; i < visible.length; ++i) {
                var schemaConfig = this.options.schemes[visible[i]];
                var option = $("<option/>");
                option.val(schemaConfig.schemaName).text(schemaConfig.label);
                option.data('schema', schemaConfig);
                selector.append(option);
            }
            $container.append(selector);
            return selector;
        },
        getItemSchema: function(item) {
            return this.options.schemes[item.schemaName];
        },
        /**
         * @param {DataManagerSchemaConfig|String} schema
         * @return {Array<DataManagerSchemaConfig>}
         */
        expandCombination: function(schema) {
            var expanded = [];
            var schema0 = (typeof schema === 'string') && this.options.schemes[schema] || schema;
            if (!schema0.combine) {
                expanded.push(schema0);
            } else {
                for (var i = 0; i < schema0.combine.length; ++i) {
                    expanded.push(this.options.schemes[schema0.combine[i]]);
                }
            }
            return expanded;
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
            var id = this._getUniqueItemId(dataItem);
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
                dataItem: Object.assign({}, this._getItemData(dataItem), newValues || {})
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
                itemId: this._getUniqueItemId(dataItem),
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
                this.tableRenderer.addRow(dataItem, true);
            } else {
                this.tableRenderer.refreshRow(dataItem, true);
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
            return valid && Mapbender.DataManager.FormUtil.extractValues($form);
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
        _getItemData: function(dataItem) {
            return dataItem.properties;
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
            Object.assign(dataItem.properties, newValues);
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
            var itemValues = this._getItemData(dataItem);

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
            if (schema.allowDelete && this._getUniqueItemId(dataItem)) {
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
                        return widget._prepareDataItem(itemData);
                    });
                    widget.tableRenderer.replaceRows(preparedItems);
                    return preparedItems;
                })
            ;
        },
        /**
         * Transforms data item server response data to internally used item structure.
         * @param {Object} data
         * @return {*}
         * @private
         */
        _prepareDataItem: function(data) {
            // Trivial in data-manager. Use plain object directly.
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
            var id = this._getUniqueItemId(dataItem);
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
            this.tableRenderer.removeRow(dataItem);
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
        _getUniqueItemId: function(item) {
            return item.id || null;
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
        getEnabledSchemaFunctionCodes: function(schema) {
            var codes = ['-fn-edit-data'];
            if (schema.allowDelete) {
                codes.push('-fn-delete');
            }
            return codes;
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
        __dummy: null
    });

})(jQuery);
