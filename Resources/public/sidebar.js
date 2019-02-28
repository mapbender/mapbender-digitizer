var Sidebar = function(schema) {

    this.schema = schema;
    this.frame  = $("<div/>").addClass('frame');


    this._addSpecificOptionToSchemeSelector();

    this._generateToolSetView();

    this._generateSearchForm();

    this.frame.append('<div style="clear:both;"/>');

    this._generateResultDataTable();

    this.frame.hide();
};


Sidebar.prototype = {


    _addSpecificOptionToSchemeSelector: function () {
        var schema = this.schema;
        var widget = schema.widget;
        var selector = widget.selector;

        var option = $("<option/>");
        option.val(schema.schemaName).html(schema.label);
        option.data("schemaSettings", schema);
        if (schema.schemaName === 'all') {
            selector.prepend(option);
            selector.val(schema.schemaName);
        } else {
            selector.append(option);
        }
    },


    _generateResultDataTableButtons: function () {
        /** @type {Scheme} */
        var schema = this.schema;
        var buttons = [];

        if (schema.allowLocate) {
            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.zoom'),
                className: 'zoom',
                cssClass: 'fa fa-crosshairs',
                onClick: function (olFeature, ui) {
                    schema.zoomToJsonFeature(olFeature);
                }
            });
        }

        if (schema.allowEditData && schema.allowSave) {
            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.save'),
                className: 'save',
                cssClass: ' fa fa-floppy-o',
                disabled: true,
                onClick: function (olFeature, ui) {
                    schema.saveFeature(olFeature);
                }
            });
        }

        if (schema.allowEditData) {
            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                className: 'edit',
                onClick: function (olFeature, ui) {
                    schema._openFeatureEditDialog(olFeature);
                }
            });
        }
        if (schema.copy.enable) {
            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                className: 'clone',
                cssClass: ' fa fa-files-o',
                onClick: function (olFeature, ui) {
                    schema.copyFeature(olFeature);
                }
            });
        }
        if (schema.allowCustomerStyle) {
            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                className: 'style',
                onClick: function (olFeature, ui) {
                    schema.openChangeStyleDialog(olFeature);
                }
            });
        }

        if (schema.allowChangeVisibility) {
            buttons.push({
                title: Mapbender.DigitizerTranslator.translate('feature.visibility.change'),
                className: 'visibility',
                onClick: function (olFeature) {
                    console.log(olFeature.renderIntent);
                    schema.toggleFeatureVisibility(olFeature);
                }
            });
        }

        if (schema.allowPrintMetadata) {
            buttons.push({
                title: 'Sachdaten drucken',
                className: 'printmetadata',
                onClick: function (olFeature, ui, b, c) {
                    if (!olFeature.printMetadata) {
                        olFeature.printMetadata = true;
                        ui.addClass("active");
                    } else {
                        olFeature.printMetadata = false;
                        ui.removeClass("active");
                    }
                }
            });
        }

        if (schema.allowDelete) {

            buttons.push({
                title: Mapbender.DigitizerTranslator.translate("feature.remove.title"),
                className: 'remove',
                cssClass: 'critical',
                onClick: function (olFeature, ui) {
                    if (schema.getSchemaByFeature(olFeature).allowDelete) {
                        schema.removeFeature(olFeature);
                    } else {
                        $.notify("Deletion is not allowed");
                    }
                }
            });
        }

        return buttons;


    },

    _generateResultDataTableColumns: function () {
        /** @type {Scheme} */
        var schema = this.schema;

        var columns = [];


        $.each(schema.tableFields, function (fieldName, fieldSettings) {
            fieldSettings.title = fieldSettings.label;
            fieldSettings.data = fieldSettings.data || schema._createResultTableDataFunction(fieldName);
            if (!fieldSettings.data) {
                fieldSettings.data = function (row, type, val, meta) {
                    var data = row.data[fieldName];
                    if (typeof (data) == 'string') {
                        data = data.escapeHtml();
                    }
                    return data;
                };
            }

            if (fieldSettings.render) {
                eval('fieldSettings.render = ' + fieldSettings.render);
            }
            columns.push(fieldSettings);
        });

        return columns;

    },


    _generateResultDataTable: function () {

        /** @type {Scheme} */
        var schema = this.schema;
        var frame =  this.frame;

        var tableTranslation = schema.tableTranslation ? Mapbender.DigitizerTranslator.translateObject(schema.tableTranslation) : Mapbender.DigitizerTranslator.tableTranslations();

        var resultTableSettings = {
            lengthChange: false,
            pageLength: schema.pageLength,
            searching: schema.inlineSearch,
            info: true,
            processing: false,
            ordering: true,
            paging: true,
            selectable: false,
            autoWidth: false,
            columns: this._generateResultDataTableColumns(),
            buttons: this._generateResultDataTableButtons(),
            oLanguage: tableTranslation

        };


        if (schema.view && schema.view.settings) {
            _.extend(resultTableSettings, schema.view.settings);
        }

        var $div = $("<div/>");
        var $table = $div.resultTable(resultTableSettings);
        schema.resultTable = $table.resultTable("instance");

        var searchableColumnTitles = _.pluck(_.reject(resultTableSettings.columns, function (column) {
            if (!column.sTitle) {
                return true;
            }

            if (column.hasOwnProperty('searchable') && column.searchable === false) {
                return true;
            }
        }), 'sTitle');

        $table.find(".dataTables_filter input[type='search']").attr('placeholder', searchableColumnTitles.join(', '));


        frame.append($table);

    },

    //TODO methode ist zu lang
    _generateSearchForm: function () {
        /** @type {Scheme} */
        var schema = this.schema;
        var widget = schema.widget;
        var frame = this.frame;
        var searchForm = $('form.search', frame);


        // If searching defined, then try to generate a form
        if (schema.search) {
            if (schema.search.form) {

                var foreachItemTree = function (items, callback) {
                    _.each(items, function (item) {
                        callback(item);
                        if (item.children && $.isArray(item.children)) {
                            foreachItemTree(item.children, callback);
                        }
                    })
                };
                var elementUrl = widget.elementUrl;
                // $.fn.select2.defaults.set('amdBase', 'select2/');
                // $.fn.select2.defaults.set('amdLanguageBase', 'select2/dist/js/i18n/');

                foreachItemTree(schema.search.form, function (item) {

                    if (item.type && item.type === 'select') {
                        if (item.ajax) {

                            // Hack to get display results as an HTML
                            item.escapeMarkup = function (m) {
                                return m;
                            };
                            // Replace auto-complete results with required key word
                            item.templateResult = function (d, selectDom, c) {
                                var html = d && (d.text || '');
                                if (d && d.id && d.text) {
                                    // Highlight results
                                    html = d.text.replace(new RegExp(ajax.lastTerm, "gmi"), '<span style="background-color: #fffb67;">\$&</span>');
                                }
                                return html;
                            };
                            var ajax = item.ajax;
                            ajax.dataType = 'json';
                            ajax.url = elementUrl + 'form/select';
                            ajax.data = function (params) {
                                if (params && params.term) {
                                    // Save last given term to get highlighted in templateResult
                                    ajax.lastTerm = params.term;
                                }
                                return {
                                    schema: schema.schemaName,
                                    item: item,
                                    form: searchForm.formData(),
                                    params: params
                                };
                            };

                        }
                    }
                });
                frame.generateElements({
                    type: 'form',
                    cssClass: 'search',
                    children: schema.search.form
                });
            }

            var onSubmitSearch = function (e) {
                schema.search.request = searchForm.formData();
                var xhr = schema.getData();
                if (xhr) {
                    xhr.done(function () {
                        var olMap = widget.map;
                        olMap.zoomToExtent(layer.getDataExtent());

                        if (schema.search.hasOwnProperty('zoomScale')) {
                            olMap.zoomToScale(schema.search.zoomScale, true);
                        }
                    });
                }
                return false;
            };

            searchForm
                .on('submit', onSubmitSearch)
                .find(' :input')
                .on('change', onSubmitSearch);
        }

    },


    _generateToolSetView: function () {

        this._appendDigitizingToolset();
        this._appendGeneralDigitizerButtons();
    },

    _appendDigitizingToolset: function() {
        var schema = this.schema;
        var frame = this.frame;
        var widget = schema.widget;
        var layer = schema.layer;


        var toolset = schema.toolset;

        var $digitizingToolSetElement = $('<div/>').digitizingToolSet({
            buttons: toolset,
            layer: layer,
            translations: Mapbender.DigitizerTranslator.toolsetTranslations(schema.featureType && schema.featureType.geomType),
            injectedMethods: {

                openFeatureEditDialog: function (feature) {

                    if (schema.openFormAfterEdit) {
                        schema._openFeatureEditDialog(feature);
                    }
                },
                getDefaultAttributes: function () {
                    return schema._getDefaultProperties();
                },
                preventModification: function () {

                    return !!schema.evaluatedHooks.onModificationStart;

                },
                preventMove: function () {

                    return !!schema.evaluatedHooks.onStart;

                },
                extendFeatureDataWhenNoPopupOpen: function (feature) {

                    if (widget.currentPopup && widget.currentPopup.data('visUiJsPopupDialog')._isOpen) {

                    } else {

                        if (schema.popup && schema.popup.remoteData) {
                            schema._getRemoteData(feature);
                        } else {
                            schema._openFeatureEditDialog(feature);
                        }
                    }
                },


                setModifiedState: schema.setModifiedState
            }


        });


        $digitizingToolSetElement.addClass("left");

        if (schema.allowDigitize) {
            frame.append($digitizingToolSetElement);
        }


        schema.digitizingToolset = $digitizingToolSetElement.digitizingToolSet("instance");

    },


    _appendGeneralDigitizerButtons: function() {
        var schema = this.schema;
        var frame = this.frame;

        var corporateFeatureControlButtons = [];
        if (schema.showVisibilityNavigation) {

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("fa fa-eye-slash");
            $button.attr("title",Mapbender.DigitizerTranslator.translate('toolset.hideAll'));
            $button.click(function() {
                schema._toggleVisibility(false);
            });
            corporateFeatureControlButtons.push($button);

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("fa fa-eye");
            $button.attr("title",Mapbender.DigitizerTranslator.translate('toolset.showAll'));
            $button.click(function() {
                schema._toggleVisibility(true);
            });
            corporateFeatureControlButtons.push($button);
        }
        if (schema.allowSaveAll) {

            var $button = $("<button class='button' type='button'/>");
            $button.addClass("fa fa-floppy-o");
            $button.attr("title",Mapbender.DigitizerTranslator.translate('toolset.saveAll'));
            $button.addClass("save-all-features");
            $button.click(function() {
                var unsavedFeatures = schema._getUnsavedFeatures();
                _.forEach(unsavedFeatures, function(feature) {
                    schema.saveFeature(feature);
                });
            });
            corporateFeatureControlButtons.push($button);

        }


        var generalDigitizerControl = $("<div/>");
        generalDigitizerControl.addClass("general-digitizer-buttons");
        generalDigitizerControl.addClass("right");

        $.each(corporateFeatureControlButtons, function(i,button) {
            generalDigitizerControl.append(button);

        });

        frame.append(generalDigitizerControl);

        if (schema.showExtendSearchSwitch) {
            var $checkbox = $("<input type='checkbox' />");
            var title = Mapbender.DigitizerTranslator.translate('toolset.current-extent');
            $checkbox.attr('title',title);
            if (schema.searchType === "currentExtent") {
                $checkbox.attr("checked","checked");
            }
            $checkbox.change(function (e) {
                schema.searchType = $(e.originalEvent.target).prop("checked") ? "currentExtent" : "all";
                schema.getData();
            });
            frame.append("<div style='clear:both'>");
            var $div = $("<div/>");
            $div.addClass("form-group checkbox onlyExtent");
            var $label = $("<label/>")
            $label.append($checkbox);
            $label.append(title);
            $div.append($label);
            frame.append($div);
        }
    }



};

