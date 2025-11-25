(function() {

    class MbDataManager extends MapbenderElement {
        constructor(configuration, $element) {
            super(configuration, $element);

            this.currentSettings = null;
            this.toolsetTemplate_ = null;
            this.tableButtonsTemplate_ = null;
            this.fetchXhr = null;
            this.$loadingIndicator_ = null;
            this.grantsRequest_ = null;
            this.formRenderer_ = null;
            this.dialogFactory_ = null;
            this.tableRenderer = null;
            this.currentPopup = null;

            if (Array.isArray(this.options.schemes) || !Object.keys(this.options.schemes || {}).length) {
                throw new Error('Missing schema configuration');
            }
            this.elementUrl = [
                Mapbender.configuration.application.urls.element,
                this.$element.attr('id'),
                '' // produce trailing slash
            ].join('/');
            this.$loadingIndicator_ = $('.loading-indicator', this.$element);
            const $accordionHeader = this.$element.parentsUntil('.sidePane', '.container-accordion').prev('.accordion');
            if ($accordionHeader.length) {
                this.$loadingIndicator_.remove();
                $accordionHeader
                    .addClass('clearfix')
                    .prepend(this.$loadingIndicator_.css({ float: 'right', opacity: 0.0 }));
            }
            const self = this;
            this.grantsRequest_ = $.getJSON([this.elementUrl, 'grants'].join(''));
            this.grantsRequest_.then((function(mergeWith) {
                return function(allGrants) {
                    const schemaNames = Object.keys(allGrants);
                    for (let i = 0; i < schemaNames.length; ++i) {
                        const schemaName = schemaNames[i];
                        if (allGrants[schemaName] === false) {
                            delete mergeWith[schemaName];
                        } else {
                            Object.assign(mergeWith[schemaName], allGrants[schemaName]);
                        }
                    }
                };
            })(this.options.schemes)).catch(this._onAjaxError.bind(this));

            this.grantsRequest_.then(function() {
                self.updateSchemaSelector_();
            });
            this.tableButtonsTemplate_ = $('.-tpl-table-buttons', this.$element).remove().css('display', '').html();
            this.toolsetTemplate_ = $('.-tpl-toolset', this.$element).remove().css('display', '').html();
            this.formRenderer_ = this._createFormRenderer();
            this.dialogFactory_ = Mapbender.DataManager.DialogFactory;
            const schemaNames = Object.keys(this.options.schemes);
            for (let s = 0; s < schemaNames.length; ++s) {
                const schemaName = schemaNames[s];
                const schema = this.options.schemes[schemaName];
                if (!schema.combine) {
                    const fileConfigs = this._getDataStoreFromSchema(schema).files || [];
                    const schemaBaseUrl = [this.elementUrl, schemaName, '/'].join('');
                    this.formRenderer_.prepareItems(schema.formItems || [], schemaBaseUrl, fileConfigs);
                }
            }
            this.tableRenderer = this._createTableRenderer();
            this._initializeEvents();
            this._afterCreate();
        }

        _createFormRenderer() {
            return new Mapbender.DataManager.FormRenderer();
        }

        _createTableRenderer() {
            return new Mapbender.DataManager.TableRenderer(this, this.tableButtonsTemplate_);
        }

        updateSchemaSelector_() {
            const self = this;
            const $select = $('select.-fn-schema-selector', this.$element);
            const schemaNames = Object.keys(this.options.schemes);
            const visible = schemaNames.filter(function(schemaName) {
                return self.options.schemes[schemaName].listed;
            });
            if (visible.length === 1) {
                $select.hide();
                const singleScheme = this.options.schemes[visible[0]];
                const title = singleScheme.label || singleScheme.schemaName;
                if (title) {
                    $select.before($('<h3 class="title"/>').text(title));
                }
            }
            $select.empty();
            for (let i = 0; i < visible.length; ++i) {
                const schemaConfig = this.options.schemes[visible[i]];
                const option = $('<option/>');
                option.val(schemaConfig.schemaName).text(schemaConfig.label);
                option.data('schema', schemaConfig);
                $select.append(option);
            }
        }

        getItemSchema(item) {
            return this.options.schemes[item.schemaName];
        }

        /**
         * @param {DataManagerSchemaConfig|String} schema
         * @return {Array<DataManagerSchemaConfig>}
         */
        expandCombination(schema) {
            const expanded = [];
            const schema0 = (typeof schema === 'string') && this.options.schemes[schema] || schema;
            if (!schema0.combine) {
                expanded.push(schema0);
            } else {
                for (let i = 0; i < schema0.combine.length; ++i) {
                    const subschemaName = schema0.combine[i];
                    if (this.options.schemes[subschemaName]) {
                        expanded.push(this.options.schemes[subschemaName]);
                    }
                }
            }
            return expanded;
        }

        /**
         * Unraveled from _create for child class actions after initialization, but
         * before triggering ready event and loading the first set of data.
         * @private
         */
        _afterCreate() {
            this._start();
        }

        /**
         * Loads and displays data from initially selected schema.
         * Unraveled from _create for child classes need to act after our initialization,
         * but before loading the first set of data.
         * @private
         */
        _start() {
            Mapbender.elementRegistry.markReady(this.$element.attr('id'));
            if (!this.skipInitialData_()) {
                // Use schema change event, it does everything we need
                $('.-fn-schema-selector', this.$element).trigger('change');
            }
        }

        skipInitialData_() {
            return !!this.$element.parents('.contentPane').length;
        }

        _initializeEvents() {
            const self = this;
            $('.-fn-schema-selector', this.$element).on('change', function() {
                self._onSchemaSelectorChange();
            });
            this.$element.on('click', '.-fn-edit-data', function() {
                const $tr = $(this).closest('tr');
                self._openEditDialog($tr.data('schema'), $tr.data('item'));
            });
            this.$element.on('click', '.-fn-delete', function() {
                const $tr = $(this).closest('tr');
                self.removeData($tr.data('schema'), $tr.data('item'));
            });
            this.$element.on('click', '.-fn-refresh', function() {
                self._getData(self._getCurrentSchema());
            });
            this.$element.on('click', '.-fn-create-item', function() {
                self._createItem(self._getCurrentSchema());
            });
        }

        /**
         * Mapbender sidepane interaction API
         */
        hide() {
            this._closeCurrentPopup();
        }

        /**
         * @todo Digitizer: use .featureType attribute instead of .dataStore (otherwise equivalent)
         * @param {DataManagerSchemaConfig} schema
         * @return {DataStoreConfig}
         */
        _getDataStoreFromSchema(schema) {
            return schema.dataStore;
        }

        _closeCurrentPopup() {
            if (this.currentPopup) {
                if (this.currentPopup.dialog('instance')) {
                    this.currentPopup.dialog('destroy');
                }
                this.currentPopup = null;
            }
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _activateSchema(schema) {
            if (this.currentSettings) {
                this._deactivateSchema(this.currentSettings);
                this.currentSettings = null;
            }
            this.currentSettings = schema;
            this._updateToolset(schema);
            $('.data-container', this.$element)
                .empty()
                .append(this.tableRenderer.render(schema))
            ;
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _deactivateSchema(schema) {
            this._closeCurrentPopup();
        }

        _getCurrentSchema() {
            const $select = $('.-fn-schema-selector', this.$element);
            const option = $('option:selected', $select);
            if (option.data('schema')) return option.data('schema');
            const schemaKeys = Object.keys(this.options['schemes']);
            if (schemaKeys.length === 0) {
                Mapbender.error('Configuration error: Element ' + this.$element.attr('id') + ' has no schema defined');
                throw new Error('No schema defined');
            }
            const firstSchemaKey = schemaKeys[0];
            return this.options['schemes'][firstSchemaKey];
        }

        _onSchemaSelectorChange() {
            const schemaNew = this._getCurrentSchema();
            this._activateSchema(schemaNew);
            this._getData(schemaNew);
        }

        /**
         * @param {jQuery} $container
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _updateToolset(schema) {
            $('.toolset', this.$element).replaceWith(this.toolsetTemplate_);
            const $toolset = $('.toolset', this.$element);
            let allowRefresh = schema.allowRefresh;
            if (schema.combine) {
                $('.-fn-create-item', $toolset).remove();
                const subSchemas = this.expandCombination(schema);
                for (let s = 0; s < subSchemas.length; ++s) {
                    allowRefresh = allowRefresh || subSchemas[s].allowRefresh;
                }
            }
            if (!allowRefresh) {
                $('.-fn-refresh', $toolset).remove();
            }
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {Object} [newValues]
         * @return {Promise}
         * @private
         */
        _saveItem(schema, dataItem, newValues) {
            const self = this;
            const params = {
                schema: schema.schemaName
            };
            const id = this._getUniqueItemId(dataItem);
            if (id) {
                params.id = id;
            }
            const submitData = this._getSaveRequestData(schema, dataItem, newValues);
            return this.postJSON('save?' + $.param(params), submitData)
                .then(function(response) {
                    self._afterSave(schema, dataItem, id, response);
                    return response;
                })
            ;
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {Object} [newValues]
         * @return {{dataItem: *}}
         * @private
         */
        _getSaveRequestData(schema, dataItem, newValues) {
            return {
                properties: Object.assign({}, this._getItemData(dataItem), newValues || {})
            };
        }

        /**
         * Produces event after item has been saved on the server.
         * New items have a null originalId. Updated items have a non-empty originalId.
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {(String|null)} originalId
         * @private
         */
        _saveEvent(schema, dataItem, originalId) {
            const eventData = {
                item: dataItem,
                itemId: this._getUniqueItemId(dataItem),
                originalId: originalId,
                uniqueIdKey: this._getUniqueItemIdProperty(schema),
                schema: schema,
                schemaName: schema.schemaName,
                scheme: schema.schemaName,
                originator: this
            };
            this.$element.trigger('data.manager.item.saved', eventData);
        }

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
        _afterSave(schema, dataItem, originalId, responseData) {
            if (responseData.dataItem) {
                this._replaceItemData(schema, dataItem, responseData.dataItem);
            }
            if (!originalId) {
                // new item
                this.tableRenderer.addRow(dataItem, true);
            } else {
                this.tableRenderer.refreshRow(dataItem, true);
            }
            this._saveEvent(schema, dataItem, originalId);
            $.notify(Mapbender.trans('mb.data.store.save.successfully'), 'info');
        }

        _updateCalculatedText($elements, data) {
            $elements.each((index, element) => {
                const expression = $(element).attr('data-expression');
                const content = (function(data_) {
                    return eval(expression);
                })(data);
                if ($(element).attr('data-html-expression')) {
                    $(element).html(content);
                } else {
                    $(element).text(content);
                }
            });
        }

        /**
         * @param {jQuery} $form
         * @return {Object|boolean} false on any invalid form inputs
         * @private
         */
        _getFormData($form) {
            const valid = Mapbender.DataManager.FormUtil.validateForm($form);
            return valid && Mapbender.DataManager.FormUtil.extractValues($form, true);
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {jQuery} $scope
         * @param {Object} [dataItem]
         * @return {boolean|Promise}
         * @private
         */
        _submitFormData(schema, $scope, dataItem) {
            const formData = this._getFormData($scope);
            if (formData) {
                const uniqueIdAttribute = this._getUniqueItemIdProperty(schema);
                if (typeof formData[uniqueIdAttribute] !== 'undefined') {
                    console.warn('Form contains an input field for the object id', schema);
                }
                delete formData[uniqueIdAttribute];
                return this._saveItem(schema, dataItem, formData);
            } else {
                return false;
            }
        }

        /**
         * Gets persistent data properties of the item
         * @return {Object}
         */
        _getItemData(dataItem) {
            return dataItem.properties;
        }

        /**
         * Places updated data (from form or otherwise) back into the item
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {Object} newValues
         * @private
         */
        _replaceItemData(schema, dataItem, newValues) {
            Object.assign(dataItem.properties, newValues.properties);
        }

        /**
         * Open edit feature dialog
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @private
         */
        _openEditDialog(schema, dataItem) {
            const widget = this;
            this._closeCurrentPopup();
            const itemValues = this._getItemData(dataItem);
            const dialog = $('<div/>');
            dialog.data('item', dataItem);
            dialog.data('schema', schema);
            dialog.attr('data-item-id', this._getUniqueItemId(dataItem));
            dialog.append(this.formRenderer_.renderElements(schema.formItems));
            if (!schema.allowEdit) {
                $('.-fn-delete-attachment', dialog).remove();
            }
            const dialogOptions = this._getEditDialogPopupConfig(schema, dataItem);
            if (!$('> .ui-tabs', dialog).length) {
                dialog.addClass('content-padding');
            }
            this.dialogFactory_.dialog(dialog, dialogOptions);
            widget.currentPopup = dialog;
            Mapbender.DataManager.FormUtil.setValues(dialog, itemValues);
            const schemaBaseUrl = [this.elementUrl, schema.schemaName, '/'].join('');
            this.formRenderer_.updateFileInputs(dialog, schemaBaseUrl, itemValues);
            // Legacy custom vis-ui event shenanigans
            $('.-js-custom-events[name]', dialog).each(function() {
                $(this).trigger('filled', { data: itemValues, value: itemValues[$(this).attr('name')] });
            });
            this._updateCalculatedText($('.-fn-calculated-text', dialog), itemValues);
            dialog.on('click', '.mb-3 .-fn-copytoclipboard', function() {
                const $input = $(':input', $(this).closest('.mb-3'));
                Mapbender.DataManager.FormUtil.copyToClipboard($input);
            });
            this.formRenderer_.initializeWidgets(dialog, schemaBaseUrl);
            dialog.one('dialogclose', function() {
                widget._cancelForm(schema, dataItem);
            });
            return dialog;
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @return {Object}
         * @see https://api.jqueryui.com/1.12/dialog/
         * @private
         */
        _getEditDialogPopupConfig(schema, dataItem) {
            let width = schema.popup.width;
            // NOTE: unlike width, which allows CSS units, minWidth option is expected to be a pure pixel number
            let minWidth = 550;
            if (/\d+px/.test(width || '')) {
                minWidth = parseInt(width.replace(/px$/, '')) || minWidth;
            }
            return {
                position: schema.popup.position || {},
                modal: schema.popup.modal || false,
                title: schema.popup.title || Mapbender.trans('mb.data-manager.details_title'),
                width: schema.popup.width,
                minWidth: minWidth,
                classes: {
                    'ui-dialog-content': 'ui-dialog-content data-manager-edit-data'
                },
                buttons: this._getEditDialogButtons(schema, dataItem)
            };
        }

        /**
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @return {Array<Object>}
         * @private
         */
        _getEditDialogButtons(schema, dataItem, overrideAllowSave) {
            const buttons = [];
            const widget = this;
            if (schema.allowEdit || overrideAllowSave) {
                buttons.push({
                    text: Mapbender.trans('mb.actions.save'),
                    'class': 'btn btn-primary',
                    click: function() {
                        const $scope = $(this).closest('.ui-dialog-content');
                        const saved = widget._submitFormData(schema, $scope, dataItem);
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
                    title: Mapbender.trans('mb.data-manager.actions.delete_tooltip'),
                    'class': 'btn btn-danger',
                    click: function() {
                        widget._closeCurrentPopup();
                        widget.removeData(schema, dataItem);
                    }
                });
            }
            const closeText = buttons.length && 'mb.actions.cancel' || 'mb.actions.close';
            const closeTooltip = buttons.length && 'mb.data-manager.actions.cancel_tooltip' || 'mb.data-manager.actions.close_tooltip';
            buttons.push({
                text: Mapbender.trans(closeText),
                title: Mapbender.trans(closeTooltip),
                'class': 'btn btn-light',
                click: function() {
                    widget._cancelForm(schema, dataItem);
                }
            });
            return buttons;
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @private
         */
        _createItem(schema) {
            this._openEditDialog(schema, {
                id: null,
                schemaName: schema.schemaName,
                properties: {}
            });
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @private
         */
        _cancelForm(schema, dataItem) {
            this._closeCurrentPopup();
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {Object}
         */
        _getSelectRequestParams(schema) {
            return {
                schema: schema.schemaName
            };
        }

        /**
         * Loads data items with explicit request params, without side effects.
         *
         * @param {Object} params
         * @returns {jqXHR} resolves with prepared items
         */
        loadItems(params) {
            return $.getJSON([this.elementUrl, 'select'].join(''), params);
        }

        /**
         * Loads data items, and replaces current table (Digitizer: and map layer contents).
         * Aborts previous pending item request.
         * Updates loading indicator
         * Notifies on error
         *
         * @returns {Promise} resolves with prepared items
         * @private
         */
        _getData(schema) {
            const widget = this;
            if (this.fetchXhr) {
                this.fetchXhr.abort();
                this.fetchXhr = null;
            }
            this._closeCurrentPopup();
            this.$loadingIndicator_.css({ opacity: 1 });
            this.fetchXhr = this.decorateXhr_(this.loadItems(this._getSelectRequestParams(schema)), this.$loadingIndicator_);
            return this.fetchXhr
                .always(function() {
                    widget.fetchXhr = null;
                })
                .then(function(dataItems) {
                    return dataItems.map(function(itemData) {
                        return widget._prepareDataItem(itemData);
                    });
                })
                .then(function(preparedItems) {
                    widget.tableRenderer.replaceRows(preparedItems);
                    return preparedItems;
                });
        }

        /**
         * Transforms data item server response data to internally used item structure.
         * @param {Object} data
         * @return {*}
         * @private
         */
        _prepareDataItem(data) {
            // Trivial in data-manager. Use plain object directly.
            return data;
        }

        /**
         * Remove data item
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         */
        removeData(schema, dataItem) {
            const widget = this;
            const id = this._getUniqueItemId(dataItem);
            if (!id) {
                throw new Error("Can't delete item without id from server");
            }
            this.confirmDialog(Mapbender.trans('mb.data.store.remove.confirm.text')).then(function() {
                const params = {
                    schema: schema.schemaName,
                    id: id
                };
                widget.postJSON('delete?' + $.param(params), null, {
                    method: 'DELETE'
                }).done(function() {
                    widget._afterRemove(schema, dataItem, id);
                });
            });
        }

        /**
         * Produces event after item has been deleted server-side
         *
         * @param schema
         * @param dataItem
         * @param id
         * @private
         */
        _deleteEvent(schema, dataItem, id) {
            // Quirky jquery ui event. Triggers a 'mbdatamanagerremove' on this.element. Limited legacy data payload.
            this._trigger('removed', {
                schema: schema,
                feature: dataItem
            });
            const eventData = {
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
            this.$element.trigger('data.manager.item.deleted', eventData);
        }

        /**
         * Called after item has been deleted from the server
         *
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} dataItem
         * @param {String} id
         * @private
         */
        _afterRemove(schema, dataItem, id) {
            this.tableRenderer.removeRow(dataItem);
            this._deleteEvent(schema, dataItem, id);
            $.notify(Mapbender.trans('mb.data.store.remove.successfully'), 'info');
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @return {String}
         * @private
         */
        _getUniqueItemIdProperty(schema) {
            return this._getDataStoreFromSchema(schema).uniqueId || 'id';
        }

        /**
         * @param {DataManagerSchemaConfig} schema
         * @param {Object} item
         * @return {(String|null)}
         * @private
         */
        _getUniqueItemId(item) {
            return item.id || null;
        }

        postJSON(uri, data, options) {
            const options_ = {
                url: this.elementUrl + uri,
                method: 'POST',
                contentType: 'application/json; charset=utf-8',
                dataType: 'json'
            };
            Object.assign(options_, options || {});
            if (data && !options_.data) {
                options_.data = JSON.stringify(data);
            }
            this.$loadingIndicator_.css({ opacity: 1 });
            return this.decorateXhr_($.ajax(options_), this.$loadingIndicator_);
        }

        decorateXhr_(jqXhr, $loadingIndicator) {
            if ($loadingIndicator) {
                jqXhr.always(function() {
                    $loadingIndicator.css({ opacity: 0 });
                });
            }
            jqXhr.fail(this._onAjaxError);
            return jqXhr;
        }

        _onAjaxError(xhr) {
            if (xhr.statusText === 'abort') {
                return;
            }
            let errorMessage = Mapbender.trans('mb.data.store.api.query.error-message');
            let responseErrorMessage = Mapbender.trans('mb.data.store.'+xhr.responseJSON.message);
            console.error(errorMessage, xhr);
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = [errorMessage, responseErrorMessage].join(':\n');
            }
            $.notify(errorMessage, {
                autoHide: false
            });
        }

        getEnabledSchemaFunctionCodes(schema) {
            const codes = ['-fn-edit-data'];
            if (schema.allowDelete) {
                codes.push('-fn-delete');
            }
            return codes;
        }

        /**
         * Promise-based confirmation dialog utility.
         * @param {String} title
         * @return {Promise}
         * @static
         */
        confirmDialog(title) {
            return this.dialogFactory_.confirm(title);
        }
    }

    window.Mapbender.Element = window.Mapbender.Element || {};
    window.Mapbender.Element.MbDataManager = MbDataManager;
})();
