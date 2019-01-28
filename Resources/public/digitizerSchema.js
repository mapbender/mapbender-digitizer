
/**
 * Escape HTML chars
 * @param text
 * @returns {string}
 */
function escapeHtml(text) {
    'use strict';
    return text.replace(/[\"&'\/<>]/g, function (a) {
        return {
            '"': '&quot;',
            '&': '&amp;',
            "'": '&#39;',
            '/': '&#47;',
            '<': '&lt;',
            '>': '&gt;'
        }[a];
    });
}

function findFeatureByPropertyValue(layer, propName, propValue) {
    for (var i = 0; i < layer.features.length; i++) {
        if (layer.features[i][propName] === propValue) {
            return layer.features[i];
        }
    }
    return null;
}

/**
 * Translate digitizer keywords
 * @param title
 * @param withoutSuffix
 * @returns {*}
 */
function translate(title, withoutSuffix) {
    return Mapbender.trans(withoutSuffix ? title : "mb.digitizer." + title);
}

Scheme = OpenLayers.Class({

    label: '',
    inlineSearch: true,
    maxResults: 500,
    displayPermanent: false,
    schemaName : '',
    dataStore : null,
    dataStoreLink : {},

    initialize: function (options) {
        var schema = this;
        schema.displayClass = this.CLASS_NAME;

        OpenLayers.Util.extend(schema, options);

        schema.events = new OpenLayers.Events(schema);
        if (schema.eventListeners instanceof Object) {
            schema.events.on(schema.eventListeners);
        }
        if (schema.id == null) {
            schema.id = OpenLayers.Util.createUniqueID(schema.CLASS_NAME + "_");
        }
    },

    _highlightSchemaFeature: function (feature, highlight) {
        var schema = this;
        var table = schema.table;
        var tableWidget = table.data('visUiJsResultTable');
        var isSketchFeature = !feature.cluster && feature._sketch && _.size(feature.data) === 0;
        var features = feature.cluster ? feature.cluster : [feature];
        var layer = feature.layer;
        var domRow;

        if (feature.renderIntent && feature.renderIntent === 'invisible') {
            return;
        }

        if (isSketchFeature) {
            return;
        }

        var styleId = feature.styleId ? feature.styleId : 'default';

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


    _createToolsetTranslations: function() {

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



    _addSelectControl: function (layer) {
        var schema = this;
        var widget = this.widget;
        var map = widget.map;
        var table = schema.table;

        var selectControl = new OpenLayers.Control.SelectFeature(layer, {
            hover: true,

            clickFeature: function (feature) {
                var features = feature.cluster ? feature.cluster : [feature];

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
                    widget._openFeatureEditDialog(features[0]);
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
        if (typeof (selectControl.handlers) != "undefined") { // OL 2.7
            selectControl.handlers.feature.stopDown = false;
        }
        // else if (typeof(selectFeatureControl.handler) != "undefined") { // OL < 2.7
        //     selectControl.handler.stopDown = false;
        //     selectControl.handler.stopUp = false;
        // }

        schema.selectControl = selectControl;
        selectControl.deactivate();
        map.addControl(selectControl);
    },


    activateSchema: function () {
        var schema = this;
        var widget = this.widget;
        var frame = schema.frame;
        var layer = schema.layer;

        if (widget.options.__disabled) {
            return;
        }

        widget.activeLayer = schema.layer;
        widget.schemaName = schema.schemaName;
        widget.currentSettings = schema;

        widget.query('style/list', {schema: schema.schemaName}).done(function (r) {
            schema.featureStyles = r.featureStyles;
            widget.reloadFeatures(layer);
            layer.setVisibility(true);
            frame.css('display', 'block');
            schema.selectControl.activate();
        });

    },

    deactivateSchema: function () {
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


    _generateSearchForm: function (frame) {
        var schema = this;
        var widget = this.widget;
        // If searching defined, then try to generate a form
        if (schema.search) {
            var searchForm;
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
                                var html = d && d.text ? d.text : '';
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

            searchForm = $('form.search', frame);

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


    _buildSelectOptions: function () {

        var schema = this;
        var schemaName = schema.schemaName;
        var widget = this.widget;
        var options = widget.options;
        var map = widget.map;
        var element = $(widget.element);
        var selector = widget.selector;
        var option = $("<option/>");
        var layer = schema.layer = widget.createSchemaFeatureLayer(schema);
        var buttons = [];
        //schema.clusterStrategy = layer.strategies[0];

        // Merge settings with default values from options
        _.defaults(schema, _.omit(options, ['schemes', 'target', 'create', 'jsSrc', 'disabled']));

        if (schema.allowLocate) {
            buttons.push({
                title: 'Hineinzoomen',
                className: 'fa fa-crosshairs',
                onClick: function (olFeature, ui) {
                    widget.zoomToJsonFeature(olFeature);
                }
            });
        }

        if (schema.allowSave || true) {
            buttons.push({
                title: translate('feature.savesave'),
                className: 'save',
                onClick: function (olFeature, ui) {
                    widget.saveFeature(olFeature);
                }
            });
        }

        if (schema.allowEditData) {
            buttons.push({
                title: translate('feature.edit'),
                className: 'edit',
                onClick: function (olFeature, ui) {
                    widget._openFeatureEditDialog(olFeature);
                }
            });
        }
        if (schema.copy.enable) {
            buttons.push({
                title: translate('feature.clone.title'),
                className: 'clone',
                cssClass: ' fa fa-files-o',
                onClick: function (olFeature, ui) {
                    widget.copyFeature(olFeature);
                }
            });
        }
        if (schema.allowCustomerStyle) {
            buttons.push({
                title: translate('feature.style.change'),
                className: 'style',
                onClick: function (olFeature, ui) {
                    widget.openChangeStyleDialog(olFeature);
                }
            });
        }

        if (schema.allowChangeVisibility) {
            buttons.push({
                title: 'Objekt anzeigen/ausblenden', //translate('feature.visibility.change'),
                className: 'visibility',
                onClick: function (olFeature, ui, b, c) {
                    var layer = olFeature.layer;
                    if (!olFeature.renderIntent || olFeature.renderIntent != 'invisible') {
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
                    if (!olFeature.printMetadata || olFeature.printMetadata == false) {
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
                title: translate("feature.remove.title"),
                className: 'remove',
                cssClass: 'critical',
                onClick: function (olFeature, ui) {
                    widget.removeFeature(olFeature);
                }
            });
        }
        // if(true) {
        //     buttons.push({
        //         title:     translate("feature.remove.title"),
        //         className: 'remove',
        //         cssClass:  'critical',
        //         onClick:   function(olFeature, ui) {
        //             widget.removeFeature(olFeature);
        //         }
        //     });
        // }

        option.val(schemaName).html(schema.label);
        map.addLayer(layer);

        var frame = schema.frame = $("<div/>").addClass('frame').data("schemaSettings", schema);
        var columns = [];
        var newFeatureDefaultProperties = {};

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
            newFeatureDefaultProperties[fieldName] = "";
            fieldSettings.title = fieldSettings.label;
            if (!fieldSettings.data) {
                fieldSettings.data = function (row, type, val, meta) {
                    var data = row.data[fieldName];
                    if (typeof (data) == 'string') {
                        data = escapeHtml(data);
                    }
                    return data;
                };
            }

            if (fieldSettings.render) {
                eval('fieldSettings.render = ' + fieldSettings.render);
            }
            columns.push(fieldSettings);
        });

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
            columns: columns,
            buttons: buttons

        };

        if (_.size(buttons)) {
            resultTableSettings.buttons = buttons;
        }

        if (options.tableTranslation) {
            resultTableSettings.oLanguage = options.tableTranslation;
        }

        if (schema.view && schema.view.settings) {
            _.extend(resultTableSettings, schema.view.settings);
        }

        var table = schema.table = $("<div/>").resultTable(resultTableSettings);
        var searchableColumnTitles = _.pluck(_.reject(resultTableSettings.columns, function (column) {
            if (!column.sTitle) {
                return true;
            }

            if (column.hasOwnProperty('searchable') && column.searchable == false) {
                return true;
            }
        }), 'sTitle');

        table.find(".dataTables_filter input[type='search']").attr('placeholder', searchableColumnTitles.join(', '));

        schema.schemaName = schemaName;

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


        frame.append($('<div/>').digitizingToolSet({
            children: toolset,
            layer: layer,
            translations: schema._createToolsetTranslations(),

            // http://dev.openlayers.org/docs/files/OpenLayers/Control-js.html#OpenLayers.Control.events
            controlEvents: {

                /**
                 * This function allows the easy use of the olEvent onStart( called on drag start) with the yml configurration
                 * e.G. to prevent the move or add additional data on move
                 * */
                onStart: function (feature, px) {

                    var control = this;
                    var schema = feature.schema;
                    var attributes = feature.attributes;
                    var preventDefault = false;
                    feature.oldGeom = {x: feature.geometry.x, y: feature.geometry.y};
                    if (!schema.hooks || !schema.hooks.onStart) {
                        return;
                    }

                    try {
                        preventDefault = eval(schema.hooks.onStart);
                    } catch (e) {

                        $.notify(e);
                        return;
                    }


                    if (preventDefault) {
                        $.notify(translate('move.denied'));
                        control.cancel();

                    }
                },

                /**
                 * This function allows the easy use of the olEvent onModificationStart with the yml configurration
                 * e.G. to prevent the modification or add additional data on modification
                 * */
                onModificationStart: function event(feature) {

                    var control = this;
                    var schema = feature.schema;
                    var attributes = feature.attributes;
                    var preventDefault = false;

                    if (!schema.hooks || !schema.hooks.onModificationStart) {
                        return;
                    }

                    try {
                        preventDefault = eval(schema.hooks.onModificationStart);
                    } catch (e) {

                        $.notify(e);
                        return;
                    }

                    if (preventDefault) {
                        control.deactivate();
                        control.activate();

                        $.notify(translate('move.denied'));

                    }

                },

                featureadded: function (event) {
                    var olFeature = event.feature;
                    var layer = event.object.layer;
                    var schema = widget.findSchemaByLayer(layer);
                    var digitizerToolSetElement = $(".digitizing-tool-set", frame);
                    var properties = $.extend({}, newFeatureDefaultProperties); // clone from newFeatureDefaultProperties
                    //
                    //if(schema.isClustered){
                    //    $.notify('Create new feature is by clusterring not posible');
                    //    return false;
                    //}

                    olFeature.isNew = true;
                    olFeature.attributes = olFeature.data = properties;
                    olFeature.layer = layer;
                    olFeature.schema = schema;

                    //widget.reloadFeatures(layer);
                    layer.redraw();

                    digitizerToolSetElement.digitizingToolSet("deactivateCurrentController");

                    widget.unsavedFeatures[olFeature.id] = olFeature;

                    if (schema.openFormAfterEdit) {
                        widget._openFeatureEditDialog(olFeature);
                    }

                    //return true;
                },

                onModification: function (event) {
                    var feature = findFeatureByPropertyValue(event.layer, 'id', event.id);
                    widget.unsavedFeatures[event.id] = feature;
                }, // http://dev.openlayers.org/docs/files/OpenLayers/Control/DragFeature-js.html

                onComplete: function (event) {
                    var feature = findFeatureByPropertyValue(event.layer, 'id', event.id);
                    widget.unsavedFeatures[event.id] = feature;
                    if (!widget.currentPopup || !widget.currentPopup.data('visUiJsPopupDialog')._isOpen) {

                        if (schema.popup.remoteData) {
                            var bbox = feature.geometry.getBounds();
                            bbox.right = parseFloat(bbox.right + 0.00001);
                            bbox.top = parseFloat(bbox.top + 0.00001);
                            bbox = bbox.toBBOX();
                            var srid = map.getProjection().replace('EPSG:', '');
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


                                    Object.keys(feature.data)
                                    $.extend(feature.data, newData);


                                });
                                widget._openFeatureEditDialog(feature);

                            }).fail(function () {
                                $.notfiy("No remote data could be fetched");
                                widget._openFeatureEditDialog(feature);
                            });

                        } else {
                            widget._openFeatureEditDialog(feature);
                        }
                    }
                }
            }
        }));

        frame.generateElements({
            children: [{
                type: 'checkbox',
                cssClass: 'onlyExtent',
                title: translate('toolset.current-extent'),
                checked: schema.searchType === "currentExtent",
                change: function (e) {
                    schema.searchType = $(e.originalEvent.target).prop("checked") ? "currentExtent" : "all";
                    widget._getData();
                }
            }]
        });

        var toolSetView = $(".digitizing-tool-set", frame);

        schema._generateSearchForm(frame);

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
                            var styleId = feature.styleId ? feature.styleId : 'default';
                            feature.layer.drawFeature(feature, styleId);
                        });
                    }
                }]
            });
        }

        frame.append('<div style="clear:both;"/>');

        frame.append(table);

        //frames.push(schema); // TODO not necessary
        frame.css('display', 'none');

        frame.data("schemaSettings", schema);

        element.append(frame);
        option.data("schemaSettings", schema);
        selector.append(option);

        schema._addSelectControl(layer);
    },


    CLASS_NAME: "Mapbender.Digitizer.Schema"


});