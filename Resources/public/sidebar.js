var Sidebar = function(schema) {

    this.schema = schema;
    this.frame  = $("<div/>").addClass('frame');


    this._addSpecificOptionToSchemeSelector();

    this._generateToolSetView();

    if (!this.schema.showExtendSearchSwitch) {
        $(".onlyExtent", this.frame).hide();
    }

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
        selector.append(option);
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
                cssClass: ' fa fa-floppy-o disabled',
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
                title: 'Objekt anzeigen/ausblenden', //Mapbender.DigitizerTranslator.translate('feature.visibility.change'),
                className: 'visibility',
                onClick: function (olFeature) {
                    var on = olFeature.renderIntent === 'invisible';
                    schema.toggleFeatureVisibility(olFeature,on);
                }
            });
        }

        if (schema.allowPrintMetadata) {
            buttons.push({
                title: 'Sachdaten drucken',
                className: 'printmetadata-inactive',
                onClick: function (olFeature, ui, b, c) {
                    if (!olFeature.printMetadata) {
                        olFeature.printMetadata = true;
                        ui.addClass("icon-printmetadata-active");
                        ui.removeClass("icon-printmetadata-inactive");
                    } else {
                        olFeature.printMetadata = false;
                        ui.removeClass("icon-printmetadata-active");
                        ui.addClass("icon-printmetadata-inactive");
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
                    schema.removeFeature(olFeature);
                }
            });
        }

        return buttons;


    },

    _generateResultDataTableColumns: function () {
        /** @type {Scheme} */
        var schema = this.schema;

        var columns = [];

        if (!schema.hasOwnProperty("tableFields")) {

            schema.tableFields = {
                id: {
                    label: '',
                    data: function (row, type, val, meta) {
                        var table = $('<table/>');
                        _.each(row.data, function (value, key) {
                            var tableRow = $('<tr/>');
                            var keyCell = $('<td style="font-weight: bold; padding-right: 5px"/>');
                            var valueCell = $('<td/>');

                            keyCell.text(key + ':');
                            valueCell.text(value);
                            tableRow.append(keyCell).append(valueCell);
                            table.append(tableRow);

                        });
                        return table.prop('outerHTML');
                    }
                }
            };

        }

        $.each(schema.tableFields, function (fieldName, fieldSettings) {
            fieldSettings.title = fieldSettings.label;
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
            oLanguage: schema._getTableTranslations()

        };


        if (schema.view && schema.view.settings) {
            _.extend(resultTableSettings, schema.view.settings);
        }

        var div = $("<div/>");
        var table = schema.table = div.resultTable(resultTableSettings);
        var searchableColumnTitles = _.pluck(_.reject(resultTableSettings.columns, function (column) {
            if (!column.sTitle) {
                return true;
            }

            if (column.hasOwnProperty('searchable') && column.searchable === false) {
                return true;
            }
        }), 'sTitle');

        table.find(".dataTables_filter input[type='search']").attr('placeholder', searchableColumnTitles.join(', '));


        frame.append(table);
    },

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
                var xhr = schema._getData();
                if (xhr) {
                    xhr.done(function () {
                        var olMap = widget.getMap();
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

    _createToolsetTranslations: function () {

        var schema = this.schema;

        var toolSetTranslations = {
            drawPoint: "Punkt setzen",
            drawLine: "Linie zeichnen",
            drawPolygon: "Polygon zeichnen",
            drawRectangle: "Rechteck zeichen",
            drawCircle: "Kreis zeichen",
            drawEllipse: "Ellipse zeichen",
            drawDonut: "Polygon mit Enklave zeichnen",
            selectAndEditGeometry: "Objekt Position/Größe beabeiten",
            moveGeometry: "Objekt bewegen",
            selectGeometry: "Objekt selektieren",
            removeSelected: "Selektierte objekte löschen",
            removeAll: "Alle Objekte löschen"
        };

        // Merge subjects with available translations
        if (schema.featureType && schema.featureType.geomType) {
            var geomType = schema.featureType.geomType;
            var translationPrefix = 'mb.digitizer.toolset.' + geomType + '.';

            _.each(Mapbender.i18n, function (v, k) {
                if (k.indexOf(translationPrefix) === 0) {
                    var shortKeyName = k.split(translationPrefix)[1];
                    toolSetTranslations[shortKeyName] = v;
                }
            });
        }

        return toolSetTranslations;
    },

    _generateToolSetView: function () {
        /** @type {Scheme} */
        var schema = this.schema;
        var widget = schema.widget;
        var layer = schema.layer;
        var frame = this.frame;
        var newFeatureDefaultProperties = [];

        $.each(schema.tableFields, function (fieldName) {
            newFeatureDefaultProperties.push(fieldName);
        });

        var toolset = schema.toolset;

        var digitizingToolSetElement = $('<div/>').digitizingToolSet({
            buttons: toolset,
            layer: layer,
            translations: this._createToolsetTranslations(),
            injectedMethods: {

                openFeatureEditDialog: function (feature) {

                    if (schema.openFormAfterEdit) {
                        schema._openFeatureEditDialog(feature);
                    }
                },
                getDefaultAttributes: function () {
                    return _.clone(newFeatureDefaultProperties)
                },
                preventModification: function () {

                    return !!schema.evaluatedHooks.onModificationStart;

                },
                preventMove: function () {

                    return !!schema.evaluatedHooks.onStart;

                },
                extendFeatureDataWhenNoPopupOpen: function (feature) {
                    // TODO inspect this!
                    if (!widget.currentPopup || !widget.currentPopup.data('visUiJsPopupDialog')._isOpen) {

                        if (schema.popup.remoteData) {
                            var bbox = feature.geometry.getBounds();
                            bbox.right = parseFloat(bbox.right + 0.00001);
                            bbox.top = parseFloat(bbox.top + 0.00001);
                            bbox = bbox.toBBOX();
                            var srid = widget.map.getProjection().replace('EPSG:', '');
                            var url = widget.elementUrl + "getFeatureInfo/";

                            $.ajax({
                                url: url, data: {
                                    bbox: bbox,
                                    schema: schema.schemaName,
                                    srid: srid
                                }
                            }).done(function (response) {
                                _.each(response.dataSets, function (dataSet) {
                                    var newData = JSON.parse(dataSet).features[0].properties;


                                    Object.keys(feature.data);
                                    $.extend(feature.data, newData);


                                });
                                schema._openFeatureEditDialog(feature);

                            }).fail(function () {
                                $.notify("No remote data could be fetched");
                                schema._openFeatureEditDialog(feature);
                            });

                        } else {
                            schema._openFeatureEditDialog(feature);
                        }
                    }
                },


                triggerModifiedState: schema.triggerModifiedState
            }


        });

        frame.append(digitizingToolSetElement);

        schema.digitizingToolset = digitizingToolSetElement.digitizingToolSet("instance");

        frame.generateElements({
            children: [{
                type: 'checkbox',
                cssClass: 'onlyExtent',
                title: Mapbender.DigitizerTranslator.translate('toolset.current-extent'),
                checked: schema.searchType === "currentExtent",
                change: function (e) {
                    schema.searchType = $(e.originalEvent.target).prop("checked") ? "currentExtent" : "all";
                    schema._getData();
                }
            }]
        });

        var toolSetView = $(".digitizing-tool-set", frame);


        if (!schema.allowDigitize) {

            toolSetView.hide();
            toolSetView = $("<div class='digitizing-tool-sets'/>");
            toolSetView.insertBefore(frame.find('.onlyExtent'));

        }

        var corporateFeatureControlButtons = [];
        if (schema.showVisibilityNavigation) {
            corporateFeatureControlButtons.push({
                type: 'button',
                title: '',
                cssClass: 'fa fa-eye-slash',
                click: function (e) {
                    schema._toggleVisibility(false);
                }
            });
            corporateFeatureControlButtons.push({
                type: 'button',
                title: '',
                cssClass: 'fa fa-eye',
                click: function (e) {
                    schema._toggleVisibility(true);
                }
            });
        }
        if (schema.allowSaveAll || true) {
            corporateFeatureControlButtons.push({
                type: 'button',
                title: '',
                cssClass: 'save-all-features fa fa-floppy-o', // TODO class attribute should be availabe in vis.ui.generateElements
                disabled : true,
                click: function (e) {
                    var unsavedFeatures = schema._getUnsavedFeatures();
                    _.forEach(unsavedFeatures, function(feature) {
                        schema.saveFeature(feature);
                    });

                }
            });
        }


        toolSetView.generateElements({
            type: 'fieldSet',
            cssClass: 'right',
            //css: {marginTop: "0px"},
            children: corporateFeatureControlButtons
        });



    }




};

