
var Scheme = function(rawScheme,widget) {
    /** @type {Scheme} */
    var schema = this;

   schema = $.extend(schema, rawScheme);

    if (schema.popup) {
        schema.popup.buttons = schema.popup.buttons || [];
        schema.createPopupConfiguration();
    }

    schema._initialzeHooks();

    schema.triggerModifiedState = Scheme.prototype.triggerModifiedState.bind(this); // In order to achive arrow-function like "this" behaviour

    schema.widget = widget;

    // TODO this has to be carefully checked for prototype propertys, since it fills the `undefined` properties, so it may not work at all
    _.defaults(schema, schema.widget._getNonBlackListedOptions());



};


Scheme.prototype = {


        schemaName: '',
        featureTypeName: '',
        table: null,
        label: '',
        layer: null,
        widget: null,
        frame: null,
        inlineSearch: true,
        maxResults: 500,
        displayPermanent: false,
        dataStore: null,
        dataStoreLink: {},
        showExtendSearchSwitch: false,
        featureType: {
            geomType: null,
            table: null,
            files: null
        },
        zoomScaleDenominator: 500,
        useContextMenu: true,
        toolset: {},
        popup: null,
        tableFields: {},
        style: {},
        formItems: {},
        events: null,
        selectControl: null,
        featureStyles: null,
        search: null,
        eventListeners: null,

        allowDigitize: true,
        allowDelete: true,
        allowSave: true,
        allowEditData: true,
        allowCustomerStyle: false,
        allowChangeVisibility: false,
        allowDeleteByCancelNewGeometry: false,
        allowCancelButton: true,
        allowLocate: false,
        showVisibilityNavigation: false,
        allowPrintMetadata: false,
        printable: false,
        dataItems: null,
        isClustered: false,
        clusterStrategy: null,
        styles: {},
        maxScale: null,
        minScale: null,
        group: null,
        displayOnInactive: false,
        refreshFeaturesAfterSave: [],
        elementsTranslated: false,
        olFeatureCloudPopup: null,

        editDialog: null,
        // Copy data
        copy: {
            enable: false,
            rules: [],
            data: {},
            style: {
                strokeWidth: 5,
                fillColor: "#f7ef7e",
                strokeColor: '#4250b5',
                fillOpacity: 0.7,
                graphicZIndex: 15
            }
        },

        // Save data
        save: {}, // pop a confirmation dialog when deactivating, to ask the user to save or discard
        // current in-memory changes
        confirmSaveOnDeactivate: true,
        openFormAfterEdit: true,
        maxResults: 5001,
        pageLength: 10,
        oneInstanceEdit: true,
        searchType: "currentExtent",
        inlineSearch: false,
        useContextMenu: false,
        hooks: {
            onModificationStart: null,
            onStart: null,
        },
        evaluatedHooks: {},

        lastRequest: null,
        xhr: null,
        view: null,

        // Layer list names/ids to be refreshed after feature save complete
        refreshLayersAfterFeatureSave: [],

        clustering: [{
            scale: 5000000,
            distance: 30
        }],
        digitizingToolset : null,

        _initialzeHooks: function () {
            var schema = this;
            _.each(schema.hooks, function (value, name) {
                if (!value) {
                    return false;
                }

                try {
                    schema.evaluatedHooks[name] = eval(value);
                } catch (e) {
                    $.notify(e);
                }
            });
        },


        getTableWidget: function() {
            var schema = this;
            var table = schema.table;
            return table.data('visUiJsResultTable');
        },


        redrawFeature: function(feature,highlight) {
            var layer = feature.layer;

            var styleId = feature.styleId || 'default';

            if (feature.attributes && feature.attributes.label) {
                layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
            } else {
                if (highlight) {
                    layer.drawFeature(feature, 'select');
                } else {
                    if (feature.selected) {
                        layer.drawFeature(feature, 'selected');
                    } else {
                        layer.drawFeature(feature, styleId);
                    }
                }
            }

        },

        hoverInResultTable: function(feature,highlight) {

            var features = feature.cluster || [feature];
            var tableWidget = this.getTableWidget();
            var domRow;

            for (var k in features) {
                var feature = features[k];
                domRow = tableWidget.getDomRowByData(feature);
                if (domRow && domRow.size()) {
                    tableWidget.showByRow(domRow);

                    if (highlight) {
                        domRow.addClass('hover');
                    } else {
                        domRow.removeClass('hover');
                    }
                    // $('.selection input', domRow).prop("checked", feature.selected);

                    break;
                }
            }
        },
        /**
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         * @param {boolean} highlight
         * @private
         */

        _highlightSchemaFeature: function (feature, highlight) {


            var isSketchFeature = !feature.cluster && feature._sketch && _.size(feature.data) === 0;


            if (feature.renderIntent && feature.renderIntent === 'invisible') {
                return;
            }

            if (isSketchFeature) {
                return;
            }

           this.redrawFeature(feature,highlight);
           this.hoverInResultTable(feature,highlight);


        },


        _augmentPopupConfigurationButtons: function() {
            var schema = this;
            var widget = schema.widget;
            var popupConfiguration = schema.popup;

            // Initialize custom button events
            _.each(popupConfiguration.buttons, function (button) {
                if (button.click) {
                    var eventHandlerCode = button.click;
                    button.click = function (e) {
                        var _widget = widget;
                        var el = $(this);
                        var form = $(this).closest(".ui-dialog-content");
                        var feature = form.data('feature');
                        var data = feature.data;

                        eval(eventHandlerCode);

                        e.preventDefault();
                        return false;
                    }
                }
            });
        },
        /**
         * @private
         */


        createPopupConfiguration: function () {

            var schema = this;
            var popupConfiguration = schema.popup;

            var buttons = popupConfiguration.buttons;

            this._augmentPopupConfigurationButtons();

            if (schema.printable) {
                var printButton = {
                    text: Mapbender.DigitizerTranslator.translate('feature.print'),
                    click: function () {
                        var printWidget = $('.mb-element-printclient').data('mapbenderMbPrintClient');
                        if (printWidget) {
                            var dialog = $(this).closest('.ui-dialog-content');
                            var feature = dialog.data('feature');
                            printWidget.printDigitizerFeature(schema.featureTypeName || schema.schemaName, feature.fid);
                        } else {
                            $.notify('Druck Element ist nicht verfügbar!');
                        }
                    }
                };
                buttons.push(printButton);
            }
            if (schema.copy.enable) {
                buttons.push({
                    text: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                    click: function (e) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        schema.widget.copyFeature(olFeature); // TODO possibly a bug?
                    }
                });
            }
            if (schema.allowCustomerStyle) {
                var styleButton = {
                    text: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                    click: function (e) {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        schema.widget.openChangeStyleDialog(feature);
                    }
                };
                buttons.push(styleButton);
            }
            if (schema.allowEditData && schema.allowSave) {
                var saveButton = {
                    text: Mapbender.DigitizerTranslator.translate('feature.save.title'),
                    click: function () {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        schema.widget.saveFeature(feature);
                    }
                };
                buttons.push(saveButton);
            }
            if (schema.allowDelete) {
                buttons.push({
                    text: Mapbender.DigitizerTranslator.translate('feature.remove.title'),
                    'class': 'critical',
                    click: function () {
                        var dialog = $(this).closest('.ui-dialog-content');
                        var feature = dialog.data('feature');
                        schema.widget.removeFeature(feature);
                        schema.widget.currentPopup.popupDialog('close');
                    }
                });
            }
            if (schema.allowCancelButton) {
                buttons.push({
                    text: Mapbender.DigitizerTranslator.translate('cancel'),
                    click: function () {
                        schema.widget.currentPopup.popupDialog('close');
                    }.bind(this)
                });
            }

        },



        _createToolsetTranslations: function () {

            var schema = this;

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


        /**
         *
         * @param {(OpenLayers.Layer | OpenLayers.Layer.Vector)}layer
         * @private
         */

        _addSelectControl: function () {
            /** @type {Scheme} */
            var schema = this;
            var layer = schema.layer;
            var widget = this.widget;
            var map = widget.map;
            var table = schema.table;

            var selectControl = new OpenLayers.Control.SelectFeature(layer, {
                hover: true,

                clickFeature: function (feature) {
                    var features = feature.cluster || [feature];

                    if (_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true})) {
                        return;
                    }

                    feature.selected = !feature.selected;

                    var selectionManager = table.resultTable("getSelection");

                    if (feature.selected) {
                        selectionManager.add(feature);
                    } else {
                        selectionManager.remove(feature);
                    }

                    schema._highlightSchemaFeature(feature, true);

                    if (schema.allowEditData) {
                        widget._openFeatureEditDialog(features[0], schema);
                    }
                },
                overFeature: function (feature) {
                    schema._highlightSchemaFeature(feature, true);
                },
                outFeature: function (feature) {
                    schema._highlightSchemaFeature(feature, false);
                }
            });

            // Workaround to move map by touch vector features
            selectControl.handlers && selectControl.handlers.feature && (selectControl.handlers.feature.stopDown = false);
            schema.selectControl = selectControl;
            selectControl.deactivate();
            map.addControl(selectControl);
        },


        activateSchema: function () {
            /** @type {Scheme} */
            var schema = this;
            var widget = this.widget;
            var frame = schema.frame;
            var layer = schema.layer;

            if (widget.options.__disabled) {
                return;
            }

            widget.activeLayer = schema.layer;
            widget.schemaName = schema.schemaName;
            widget.currentSchema = schema;

            widget.query('style/list', {schema: schema.schemaName}).done(function (r) {
                schema.featureStyles = r.featureStyles;
                widget.reloadFeatures(layer);
                layer.setVisibility(true);
                frame.css('display', 'block');
                schema.selectControl.activate();
            });

        },

        deactivateSchema: function () {
            /** @type {Scheme} */
            var schema = this;
            var widget = this.widget;
            var frame = schema.frame;
            //var tableApi = schema.table.resultTable('getApi');
            var layer = schema.layer;

            frame.css('display', 'none');

            if (!schema.displayPermanent) {
                layer.setVisibility(false);
            }

            schema.selectControl.deactivate();

            // https://trac.wheregroup.com/cp/issues/4548
            if (widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

        },

        _setSchemaName: function(name) {
            var schema = this;
            schema.schemaName = name;

        },

        _createToolbar: function () {
            /** @type {Scheme} */
            var schema = this;
            var schemaName = schema.schemaName;
            var widget = schema.widget;
            var element = $(widget.element);
            var selector = widget.selector;

            // Merge settings with default values from options


            var frame = schema.frame = $("<div/>").addClass('frame').data("schemaSettings", schema);

            schema._generateToolSetView(frame);

            schema._generateSearchForm(frame);

            frame.append('<div style="clear:both;"/>');

            schema._generateResultDataTable(frame);

            frame.css('display', 'none');

            frame.data("schemaSettings", schema);

            element.append(frame);

            var option = $("<option/>");
            option.val(schemaName).html(schema.label);
            option.data("schemaSettings", schema);
            selector.append(option);

        },


        _generateResultDataTableButtons: function() {
            /** @type {Scheme} */
            var schema = this;
            var widget = schema.widget;
            var buttons = [];

            if (schema.allowLocate) {
                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.zoom'),
                    className: 'zoom',
                    cssClass: 'fa fa-crosshairs',
                    onClick: function (olFeature, ui) {
                        widget.zoomToJsonFeature(olFeature);
                    }
                });
            }

            if (schema.allowEditData && schema.allowSave) {
                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.save'),
                    className: 'save',
                    cssClass: ' fa fa-floppy-o disabled',
                    onClick: function (olFeature, ui) {
                        widget.saveFeature(olFeature);
                    }
                });
            }

            if (schema.allowEditData) {
                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.edit'),
                    className: 'edit',
                    onClick: function (olFeature, ui) {
                        widget._openFeatureEditDialog(olFeature, schema);
                    }
                });
            }
            if (schema.copy.enable) {
                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.clone.title'),
                    className: 'clone',
                    cssClass: ' fa fa-files-o',
                    onClick: function (olFeature, ui) {
                        widget.copyFeature(olFeature);
                    }
                });
            }
            if (schema.allowCustomerStyle) {
                buttons.push({
                    title: Mapbender.DigitizerTranslator.translate('feature.style.change'),
                    className: 'style',
                    onClick: function (olFeature, ui) {
                        widget.openChangeStyleDialog(olFeature);
                    }
                });
            }

            if (schema.allowChangeVisibility) {
                buttons.push({
                    title: 'Objekt anzeigen/ausblenden', //Mapbender.DigitizerTranslator.translate('feature.visibility.change'),
                    className: 'visibility',
                    onClick: function (olFeature, ui, b, c) {
                        var layer = olFeature.layer;
                        if (!olFeature.renderIntent || olFeature.renderIntent !== 'invisible') {
                            layer.drawFeature(olFeature, 'invisible');
                            ui.addClass("icon-invisibility");
                            ui.closest('tr').addClass('invisible-feature');
                        } else {
                            if (olFeature.styleId) {
                                layer.drawFeature(olFeature, olFeature.styleId);
                            } else {
                                layer.drawFeature(olFeature, 'default');
                            }
                            ui.removeClass("icon-invisibility");
                            ui.closest('tr').removeClass('invisible-feature');
                        }
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
                        widget.removeFeature(olFeature);
                    }
                });
            }

            return buttons;


        },

        _generateResultDataTableColumns: function() {
            /** @type {Scheme} */
            var schema = this;

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


        _generateResultDataTable: function (frame) {
            /** @type {Scheme} */
            var schema = this;
            var widget = schema.widget;
            var options = widget.options;

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
                columns: schema._generateResultDataTableColumns(),
                buttons: schema._generateResultDataTableButtons(),
                oLanguage: options.tableTranslation || null

            };

            // if (_.size(buttons)) {
            //     resultTableSettings.buttons = buttons;
            // }

            // if (options.tableTranslation) {
            //     resultTableSettings.oLanguage = options.tableTranslation;
            // }

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

        _generateSearchForm: function (frame) {
            /** @type {Scheme} */
            var schema = this;
            var widget = this.widget;
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
                    var xhr = widget._getData();
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

            if (!schema.showExtendSearchSwitch) {
                $(".onlyExtent", frame).css('display', 'none');
            }
        },

        triggerModifiedState: function(feature,control,on) {
            var schema = this;

            var table = schema.table;
            var tableWidget = table.data('visUiJsResultTable');

            var row = tableWidget.getDomRowByData(feature);

            if (on) {
                row.find('.button.save').removeClass("disabled").addClass('active');
            } else {
                row.find('.button.save').removeClass("active").addClass('disabled');
            }

            control && control.deactivate();

        },

        _generateToolSetView: function (frame) {
            /** @type {Scheme} */
            var schema = this;
            var widget = schema.widget;
            var layer = schema.layer;
            var newFeatureDefaultProperties = [];

            $.each(schema.tableFields, function (fieldName) {
                newFeatureDefaultProperties.push(fieldName);
            });

            var toolset = widget.toolsets[schema.featureType.geomType];
            if (schema.hasOwnProperty("toolset")) {
                toolset = schema.toolset;
            }
            // remove removeSelected Control if !allowDelete
            if (!schema.allowDelete) {
                $.each(toolset, function (k, tool) {
                    if (tool.type === "removeSelected") {
                        toolset.splice(k, 1);
                    }
                });
            }

            var digitizingToolSetElement = $('<div/>').digitizingToolSet({
                children: toolset,
                layer: layer,
                translations: schema._createToolsetTranslations(),
                controlEvents: {
                    openFeatureEditDialog: function (feature) {

                        if (schema.openFormAfterEdit) {
                            widget._openFeatureEditDialog(feature, schema);
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
                                    widget._openFeatureEditDialog(feature, schema);

                                }).fail(function () {
                                    $.notify("No remote data could be fetched");
                                    widget._openFeatureEditDialog(feature, schema);
                                });

                            } else {
                                widget._openFeatureEditDialog(feature, schema);
                            }
                        }
                    },


                    triggerModifiedState: schema.triggerModifiedState
                }

            });

            frame.append(digitizingToolSetElement);

            schema.digitizingToolset = digitizingToolSetElement.data("digitizingToolSet");

            frame.generateElements({
                children: [{
                    type: 'checkbox',
                    cssClass: 'onlyExtent',
                    title: Mapbender.DigitizerTranslator.translate('toolset.current-extent'),
                    checked: schema.searchType === "currentExtent",
                    change: function (e) {
                        schema.searchType = $(e.originalEvent.target).prop("checked") ? "currentExtent" : "all";
                        widget._getData();
                    }
                }]
            });

            var toolSetView = $(".digitizing-tool-set", frame);

            if (!schema.allowDigitize) {

                toolSetView.css('display', 'none');
                toolSetView = $("<div class='digitizing-tool-sets'/>");
                toolSetView.insertBefore(frame.find('.onlyExtent'));

            }

            if (schema.showVisibilityNavigation) {
                toolSetView.generateElements({
                    type: 'fieldSet',
                    cssClass: 'right',
                    children: [{
                        type: 'button',
                        cssClass: 'fa fa-eye-slash',
                        title: 'Alle ausblenden',
                        click: function (e) {
                            var tableApi = table.resultTable('getApi');
                            tableApi.rows(function (idx, feature, row) {
                                var $row = $(row);
                                var visibilityButton = $row.find('.button.icon-visibility');
                                visibilityButton.addClass('icon-invisibility');
                                $row.addClass('invisible-feature');
                                feature.layer.drawFeature(feature, 'invisible');
                            });
                        }
                    }, {
                        type: 'button',
                        title: 'Alle einblenden',
                        cssClass: 'fa fa-eye',
                        click: function (e) {
                            var tableApi = table.resultTable('getApi');
                            tableApi.rows(function (idx, feature, row) {
                                var $row = $(row);
                                var visibilityButton = $row.find('.button.icon-visibility');
                                visibilityButton.removeClass('icon-invisibility');
                                $row.removeClass('invisible-feature');
                                var styleId = feature.styleId || 'default';
                                feature.layer.drawFeature(feature, styleId);
                            });
                        }
                    }]
                });
            }


        },

        /**
         * "Fake" form data for a feature that hasn't gone through attribute
         * editing, for saving. This is used when we save a feature that has only
         * been moved / dragged. The popup dialog with the form is not initialized
         * in these cases.
         * Assigned values are copied from the feature's data, if it was already
         * stored in the db, empty otherwise.
         *
         * @param {(OpenLayers.Feature | OpenLayers.Feature.Vector)} feature
         * @returns {{}}
         */
        initialFormData: function (feature) {
            /** @type {Scheme} */
            var schema = this;
            var formData = {};

            var extractFormData = function (definition) {
                _.forEach(definition, function (item) {
                    if (_.isArray(item)) {
                        // recurse into lists
                        extractFormData(item);
                    } else if (item.name) {
                        var currentValue = (feature.data || {})[item.name];
                        // keep empty string, but replace undefined => null
                        if (typeof (currentValue) === 'undefined') {
                            currentValue = null;
                        }
                        formData[item.name] = currentValue;
                    } else if (item.children) {
                        // recurse into child property (should be a list)
                        extractFormData(item.children);
                    }
                });
            };

            extractFormData(schema.formItems);
            return formData;
        },


        _createFeatureLayerStyleMap: function() {
            var schema = this;
            var widget = schema.widget;
            var styles = schema.styles || {};

            var styleContext = {
                context: {
                    webRootPath: Mapbender.configuration.application.urls.asset,
                    feature: function (feature) {
                        return feature;
                    },
                    label: function (feature) {
                        if (feature.attributes.hasOwnProperty("label")) {
                            return feature.attributes.label;
                        }
                        return feature.cluster && feature.cluster.length > 1 ? feature.cluster.length : "";
                    }
                }
            };
            var defaultStyle = styles.default ? $.extend({}, widget.styles.default, styles.default) : widget.styles.default;
            var selectStyle =  styles.select || widget.styles.select;
            var selectedStyle = styles.selected || widget.styles.selected;

            var styleMap = new OpenLayers.StyleMap({
                'default': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style.default, defaultStyle), styleContext),
                'select': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style.select, selectStyle), styleContext),
                'selected': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style.selected, selectedStyle), styleContext)
            }, {extendDefault: true});

            styleMap.styles.invisible = new OpenLayers.Style({
                strokeWidth: 1,
                fillColor: "#F7F79A",
                strokeColor: '#6fb536',
                display: 'none'
            });
            styleMap.styles.labelText = new OpenLayers.Style({
                strokeWidth: 0,
                fillColor: '#cccccc',
                fillOpacity: 0,
                strokeColor: '#5e1a2b',
                strokeOpacity: 0,
                pointRadius: 15,
                label: '${label}',
                fontSize: 15
            });
            styleMap.styles.labelTextHover = new OpenLayers.Style({
                strokeWidth: 0,
                fillColor: '#cccccc',
                strokeColor: '#2340d3',
                fillOpacity: 1,
                pointRadius: 15,
                label: '${label}',
                fontSize: 15
            });

            var copyStyleData = schema.copy && schema.copy.style;

            if (copyStyleData) {
                styleMap.styles.copy = new OpenLayers.Style(copyStyleData);
            }

            return styleMap;

        },

        /**
         * Create vector feature layer
         *
         * @returns {OpenLayers.Layer.Vector}
         */
        createSchemaFeatureLayer: function () {

            var schema = this;
            var widget = schema.widget;
            var isClustered = schema.isClustered = schema.hasOwnProperty('clustering');
            var strategies = [];

            var styleMap = schema._createFeatureLayerStyleMap();


            if (isClustered) {
                var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
                strategies.push(clusterStrategy);
                schema.clusterStrategy = clusterStrategy;
            }

            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap: styleMap,
                name: schema.label,
                visibility: false,
                rendererOptions: {zIndexing: true},
                strategies: strategies
            });

            if (schema.maxScale) {
                layer.options.maxScale = schema.maxScale;
            }

            if (schema.minScale) {
                layer.options.minScale = schema.minScale;
            }

            schema.layer = layer;
            widget.map.addLayer(layer);
        },


};