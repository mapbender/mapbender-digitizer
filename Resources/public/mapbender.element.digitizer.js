(function($) {
    /**
     * Regular Expression to get checked if string should be translated
     *
     * @type {RegExp}
     */
    var translationReg = /^trans:\w+\.(\w|-|\.{1}\w+)+\w+$/;

    /**
     * Translate digitizer keywords
     * @param title
     * @returns {*}
     */
    function translate(title, withoutSuffix) {
        return Mapbender.trans(withoutSuffix ? title : "mb.digitizer." + title);
    }

    /**
     * Translate object
     *
     * @param items
     * @returns object
     */
    function translateObject(items) {
        for (var k in items) {
            var item = items[k];
            if(typeof item === "string" && item.match(translationReg)) {
                items[k] = translate(item.split(':')[1], true);
            } else if(typeof item === "object") {
                translateObject(item);
            }
        }
        return item;
    }

    /**
     * "Fake" form data for a feature that hasn't gone through attribute
     * editing, for saving. This is used when we save a feature that has only
     * been moved / dragged. The popup dialog with the form is not initialized
     * in these cases.
     * Assigned values are copied from the feature's data, if it was already
     * stored in the db, empty otherwise.
     *
     * @param feature
     * @returns {{}}
     */
    function initialFormData(feature) {
        var formData = {};
        var extractFormData;
        extractFormData = function(definition) {
            _.forEach(definition, function(item) {
                if (_.isArray(item)) {
                    // recurse into lists
                    extractFormData(item);
                } else if (item.name) {
                    var currentValue = (feature.data || {})[item.name];
                    // keep empty string, but replace undefined => null
                    if (typeof(currentValue) === 'undefined') {
                        currentValue = null;
                    }
                    formData[item.name] = currentValue;
                } else if (item.children) {
                    // recurse into child property (should be a list)
                    extractFormData(item.children);
                }
            });
        };
        extractFormData(feature.schema.formItems);
        return formData;
    }

    /**
     * Check and replace values recursive if they should be translated.
     * For checking used "translationReg" variable
     *
     *
     * @param items
     */
    function translateStructure(items) {
        var isArray = items instanceof Array;
        for (var k in items) {
            if(isArray || k == "children") {
                translateStructure(items[k]);
            } else {
                if(typeof items[k] == "string" && items[k].match(translationReg)) {
                    items[k] = translate(items[k].split(':')[1], true);
                }
            }
        }
    }

    /**
     * Escape HTML chars
     * @param text
     * @returns {string}
     */
    function escapeHtml(text) {
        'use strict';
        return text.replace(/[\"&'\/<>]/g, function (a) {
            return {
                '"': '&quot;', '&': '&amp;', "'": '&#39;',
                '/': '&#47;',  '<': '&lt;',  '>': '&gt;'
            }[a];
        });
    }

    function findFeatureByPropertyValue(layer, propName, propValue) {
        for (var i=0; i< layer.features.length ; i++) {
            if (layer.features[i][propName] === propValue) {
                return layer.features[i];
            }
        }
        return null;
    }

    /**
     * Example:
     *     Mapbender.confirmDialog({html: "Feature löschen?", title: "Bitte bestätigen!", onSuccess:function(){
                  return false;
           }});
     * @param options
     * @returns {*}
     */
    Mapbender.confirmDialog = function (options) {
        var dialog = $("<div class='confirm-dialog'>" + (options.hasOwnProperty('html') ? options.html : "") + "</div>").popupDialog({
            title:       options.hasOwnProperty('title') ? options.title : "",
            maximizable: false,
            dblclick:    false,
            minimizable: false,
            resizable:   false,
            collapsable: false,
            modal:       true,
            buttons:     options.buttons || [{
                text:  options.okText || "OK",
                click: function(e) {
                    if(!options.hasOwnProperty('onSuccess') || options.onSuccess(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }, {
                text:    options.cancelText || "Abbrechen",
                'class': 'critical',
                click:   function(e) {
                    if(!options.hasOwnProperty('onCancel') || options.onCancel(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }]
        });
        return dialog;
    };


    /**
     * Digitizing tool set
     *
     * @author Andriy Oblivantsev <eslider@gmail.com>
     * @author Stefan Winkelmann <stefan.winkelmann@wheregroup.com>
     *
     * @copyright 20.04.2015 by WhereGroup GmbH & Co. KG
     */
    $.widget("mapbender.mbDigitizer", {
        options: {
            // Default option values
            allowDigitize: true,
            allowDelete: true,
            allowEditData:true,
            allowCustomerStyle: true,
            allowChangeVisibility: true,
            allowPrintMetadata: false,
            // pop a confirmation dialog when deactivating, to ask the user to save or discard
            // current in-memory changes
            confirmSaveOnDeactivate: true,
            openFormAfterEdit: true,
            maxResults: 5001,
            pageLength: 10,
            oneInstanceEdit: true,
            searchType: "currentExtent",
            inlineSearch: false,
            useContextMenu: false,
            clustering: [
                {scale: 5000000, distance: 30}
            ],
            zoomDependentVisibility: {
                // in same unit as scale display
                min: null,
                max: 25000
            }
        },
        // Default tool-sets
        toolsets: {
            point: [
              {type: 'drawPoint'},
              //{type: 'modifyFeature'},
              {type: 'moveFeature'},
              {type: 'selectFeature'},
              {type: 'removeSelected'}
              //{type: 'removeAll'}
            ],
            line: [
              {type: 'drawLine'},
              {type: 'modifyFeature'},
              {type: 'moveFeature'},
              {type: 'selectFeature'},
              {type: 'removeSelected'}
              //{type: 'removeAll'}
            ],
            polygon: [
              {type: 'drawPolygon'},
              {type: 'drawRectangle'},
              {type: 'drawCircle'},
              {type: 'drawEllipse'},
              {type: 'drawDonut'},
              {type: 'modifyFeature'},
              {type: 'moveFeature'},
              {type: 'selectFeature'},
              {type: 'removeSelected'}
                //{type: 'removeAll'}
            ]
        },
        map:      null,
        currentSettings: null,
        featureEditDialogWidth: "423px",
        unsavedFeatures: {},

        /**
         * Default styles merged by schema styles if defined
         */
        styles: {
            'default': {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor:   "#6fb536",
                fillOpacity: 0.3
                //, label: '${label}'
            },
            'select':  {
                strokeWidth: 3,
                fillColor:   "#F7F79A",
                strokeColor: '#6fb536',
                fillOpacity: 0.5
            }

        },
        /**
         * Constructor.
         *
         * At this moment not all elements (like a OpenLayers) are avaible.
         *
         * @private
         */
        _create: function() {
            var widget = this;
            this.widget = this;
            if(!Mapbender.checkTarget("mbDigitizer", widget.options.target)) {
                return;
            }
            var element = widget.element;
            widget.elementUrl = Mapbender.configuration.application.urls.element + '/' + element.attr('id') + '/';
            Mapbender.elementRegistry.onElementReady(widget.options.target, $.proxy(widget._setup, widget));
            this._popupFormItemsByScheme = {};
        },

        /**
         * Open change style dialog
         * @returns {*}
         */
        openChangeStyleDialog: function(olFeature) {
            var widget = this;
            var layer = olFeature.layer;
            var styleMap = layer.options.styleMap;
            var styles = styleMap.styles;
            var defaultStyleData = olFeature.style ? olFeature.style : _.extend({}, styles["default"].defaultStyle);

            if(olFeature.styleId) {
                _.extend(defaultStyleData, styles[olFeature.styleId].defaultStyle);
            }

            var styleOptions = {
                data:      defaultStyleData,
                commonTab: false
            };

            if(olFeature.geometry.CLASS_NAME == "OpenLayers.Geometry.LineString") {
                styleOptions.fillTab = false;
            }

            var styleEditor = $("<div/>")
                .featureStyleEditor(styleOptions)
                .bind('featurestyleeditorsubmit', function(e, context) {
                    var styleData = styleEditor.formData();
                    var schemaName = widget.currentSettings.schemaName;
                    styleEditor.disableForm();
                    widget._applyStyle(styleData, olFeature);
                    if (olFeature.fid) {
                        widget._saveStyle(schemaName, styleData, olFeature)
                            .done(function(response) {
                                widget._applyStyle(response.style, olFeature);
                                styleEditor.enableForm();
                            });
                    } else {
                        // defer style saving until the feature itself is saved, and has an id to associate with
                        var styleDataCopy = $.extend({}, styleData);
                        olFeature.saveStyleDataCallback = $.proxy(widget._saveStyle, widget, schemaName, styleDataCopy);
                    }
                    styleEditor.featureStyleEditor("close");
                });
            return styleEditor;
        },
        _applyStyle: function(styleData, olFeature) {
            var style = new OpenLayers.Style(styleData);
            var styleMap = olFeature.layer.options.styleMap;
            var styleId = styleData.id || Mapbender.Util.UUID();
            var oldStyleId = olFeature.styleId || null;
            styleMap.styles[styleId] = style;
            olFeature.styleId = styleId;
            olFeature.layer.drawFeature(olFeature, styleId);
            if (oldStyleId && oldStyleId != styleId) {
                delete styleMap.styles[oldStyleId];
            }
        },
        _saveStyle: function(schemaName, styleData, olFeature) {
            return this.query('style/save', {
                style:     styleData,
                featureId: olFeature.fid,
                schema:    schemaName
            });
        },
        _setup: function() {
            var frames = [];
            var widget = this;
            var element = $(widget.element);
            var titleElement = $("> div.title", element);
            var selector = widget.selector = $("select.selector", element);
            var options = widget.options;
            var map = widget.map = $('#' + options.target).data('mapbenderMbMap').map.olMap;
            var hasOnlyOneScheme = _.size(options.schemes) === 1;

            if(hasOnlyOneScheme) {
                titleElement.html(_.toArray(options.schemes)[0].label);
                selector.css('display', 'none');
            } else {
                titleElement.css('display', 'none');
            }

            // assign key in "schemes" object to each schema as schemaName property (if not already set) for
            // introspection / reverse lookup
            $.each(options.schemes, function(s, schemaName) {
                s.schemaName = s.schemaName || schemaName;
            });
            function createSubMenu(olFeature) {
                var layer = olFeature.layer;
                var schema = widget.findSchemaByLayer(layer);
                var subItems = {
                    zoomTo: {
                        name:   translate('feature.zoomTo'),
                        action: function(key, options, parameters) {
                            widget.zoomToJsonFeature(parameters.olFeature);
                        }
                    }
                };


                if(schema.allowCustomerStyle) {
                    subItems['style'] = {
                        name:   translate('feature.style.change'),
                        action: function(key, options, parameters) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    };
                }

                if(schema.allowEditData) {
                    subItems['edit'] = {
                        name:   translate('feature.edit'),
                        action: function(key, options, parameters) {
                            widget._openFeatureEditDialog(parameters.olFeature);
                        }
                    }
                }

                if(schema.allowDelete) {
                    subItems['remove'] = {
                        name:   translate('feature.remove'),
                        action: function(key, options, parameters) {
                            widget.removeFeature(parameters.olFeature);
                        }
                    }
                }

                return {
                    name:      "Feature #" + olFeature.fid,
                    olFeature: olFeature,
                    items:     subItems
                };
            }

            /**
             * Set map context menu
             */
            $(map.div).contextMenu({
                selector: 'div',
                events: {
                    show: function(options) {
                        var schema = widget.currentSettings;
                        return schema.useContextMenu;
                    }
                },
                build:    function(trigger, e) {
                    var items = {};
                    var schema = widget.currentSettings;
                    var feature = schema.layer.getFeatureFromEvent(e);
                    var features;

                    if(feature._sketch){
                        return items;
                    }

                    if(!feature) {
                        items['no-items'] = {name: "Nothing selected!"}
                    } else {
                        features = feature.cluster ? feature.cluster : [feature];
                        //features = widget._getFeaturesFromEvent(e.clientX, e.clientY);

                        _.each(features, function(feature) {
                            if(!feature.layer) {
                                feature.layer = olFeature.layer;
                            }
                            items[feature.fid] = createSubMenu(feature);
                        });
                    }

                    return {
                        items:    items,
                        callback: function(key, options) {
                            var selectedElement = options.$selected;
                            if(!selectedElement) {
                                return
                            }
                            var parameters = options.items[selectedElement.parent().closest('.context-menu-item').data('contextMenuKey')];

                            if(!parameters){
                                return;
                            }

                            if(parameters.items[key].action) {
                                parameters.items[key].action(key, options, parameters);
                            }
                        }
                    };
                }
            });

            $(element).contextMenu({
                selector: '.mapbender-element-result-table > div > table > tbody > tr',
                events: {
                    show: function(options) {
                        var tr = $(options.$trigger);
                        var resultTable = tr.closest('.mapbender-element-result-table');
                        var api = resultTable.resultTable('getApi');
                        var olFeature = api.row(tr).data();
                        var schema = widget.findFeatureSchema(olFeature);
                        return schema.useContextMenu;
                    }
                },
                build:    function($trigger, e) {
                    var tr = $($trigger);
                    var resultTable = tr.closest('.mapbender-element-result-table');
                    var api = resultTable.resultTable('getApi');
                    var olFeature = api.row(tr).data();
                    var schema = widget.findFeatureSchema(olFeature);
                    var items = {};

                    items['changeStyle'] = {name: translate('feature.style.change')};
                    items['zoom'] = {name: translate('feature.zoomTo')};
                    if(schema.allowDelete) {
                        items['removeFeature'] = {name:  translate('feature.remove')};
                    }

                    if(schema.allowEditData) {
                        items['edit'] = {name:  translate('feature.edit')};
                    }

                    return {
                        callback: function(key, options) {
                            switch (key) {
                                case 'removeFeature':
                                    widget.removeFeature(olFeature);
                                    break;

                                case 'zoom':
                                    widget.zoomToJsonFeature(olFeature);
                                    break;

                                case 'edit':
                                    widget._openFeatureEditDialog(olFeature);
                                    break;

                                case 'exportGeoJson':
                                    widget.exportGeoJson(olFeature);
                                    break;

                                case 'changeStyle':
                                    widget.openChangeStyleDialog(olFeature);
                                    break;
                            }
                        },
                        items:    items
                    };
                }
            });

            if(options.tableTranslation) {
                translateObject(options.tableTranslation);
            } else {
                options.tableTranslation = {
                    sSearch:       translate("search.title") + ':',
                    sEmptyTable:   translate("search.table.empty"),
                    sZeroRecords:  translate("search.table.zerorecords"),
                    sInfo:         translate("search.table.info.status"),
                    sInfoEmpty:    translate("search.table.info.empty"),
                    sInfoFiltered: translate("search.table.info.filtered")
                };
                //translateObject(options.tableTranslation);
            }

            // build select options
            $.each(options.schemes, function(schemaName){
                var schema = this;
                var option = $("<option/>");
                var layer = schema.layer = widget.createSchemaFeatureLayer(schema);
                //schema.clusterStrategy = layer.strategies[0];


                // Merge settings with default values from options
                for (var k in options) {
                    if(k == "schemes" || k == "target" || k == "create" || k == 'jsSrc' || k == 'disabled') {
                        continue;
                    }
                    schema[k] = schema.hasOwnProperty(k) ? schema[k] : options[k];
                }

                var buttons = [];

                buttons.push({
                    title:     translate('feature.edit'),
                    className: 'edit',
                    onClick:   function(olFeature, ui) {
                        widget._openFeatureEditDialog(olFeature);
                    }
                });

                if(schema.allowCustomerStyle) {
                    buttons.push({
                        title:     translate('feature.style.change'),
                        className: 'style',
                        onClick:   function(olFeature, ui) {
                            widget.openChangeStyleDialog(olFeature);
                        }
                    });
                }

                if(schema.allowChangeVisibility) {
                    buttons.push({
                        title:     'Objekt anzeigen/ausblenden', //translate('feature.visibility.change'),
                        className: 'visibility',
                        onClick:   function(olFeature, ui, b, c) {
                            var layer = olFeature.layer;
                            if(!olFeature.renderIntent || olFeature.renderIntent != 'invisible') {
                                layer.drawFeature(olFeature, 'invisible');
                                ui.addClass("icon-invisibility");
                                ui.closest('tr').addClass('invisible-feature');
                            } else {
                                if(olFeature.styleId) {
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

                if(schema.allowPrintMetadata) {
                    buttons.push({
                        title:     'Sachdaten drucken',
                        className: 'printmetadata-inactive',
                        onClick:   function(olFeature, ui, b, c) {
                            if(!olFeature.printMetadata || olFeature.printMetadata == false) {
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

                if(schema.allowDelete) {
                    buttons.push({
                        title:     translate("feature.remove"),
                        className: 'remove',
                        cssClass:  'critical',
                        onClick:   function(olFeature, ui) {
                            widget.removeFeature(olFeature);
                        }
                    });
                }

                option.val(schemaName).html(schema.label);
                map.addLayer(layer);

                var frame = schema.frame = $("<div/>").addClass('frame').data("schemaSettings", schema);
                var columns = [];
                var newFeatureDefaultProperties = {};
                var listTheme = Mapbender.theme.mb.digitizer.featureListings;
                var fieldRefs = listTheme.schemaFields[schemaName];
                var fieldTypePool = listTheme.fieldTypes;
                var _escapeHtml = function(x) {
                    /** @todo: handle booleans? (=> need translations) */
                    /** @todo: display null as "n/a"? (=> need translations) */
                    if (x === null || x === undefined) {
                        return '';
                    } else {
                        return escapeHtml('' + x);
                    }
                };
                $.each(fieldRefs, function(ix, fieldName) {
                    newFeatureDefaultProperties[fieldName] = "";
                    var fieldOptions = fieldTypePool[fieldName];
                    if (!fieldOptions) {
                        console.log("No field options for " + fieldName + " field for schema " + schemaName);
                    }
                    if (!fieldOptions.data) {
                        fieldOptions.data = function(row) {
                            return row.data[fieldName];
                        };
                    }
                    if (fieldOptions.render && typeof(fieldOptions.render) === 'string') {
                        fieldOptions.render = eval(fieldOptions.render);
                    }
                    if (!fieldOptions.render) {
                        fieldOptions.render = _escapeHtml; //escapeRowField.bind(null, fieldName);
                    }
                    columns.push(fieldOptions);
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
                    columns:  columns,
                    buttons: buttons
                };

                if(options.tableTranslation) {
                    resultTableSettings.oLanguage = options.tableTranslation;
                }

                var table = schema.table = $("<div/>").resultTable(resultTableSettings);
                var searchableColumnTitles = _.pluck(_.reject(resultTableSettings.columns, function(column) {
                    if(!column.sTitle) {
                        return true;
                    }

                    if(column.hasOwnProperty('searchable') && column.searchable == false) {
                        return true;
                    }
                }), 'sTitle');
                table.find(".dataTables_filter input[type='search']").attr('placeholder', searchableColumnTitles.join(', '));

                schema.schemaName = schemaName;

                var toolset = widget.toolsets[schema.featureType.geomType];
                if(schema.hasOwnProperty("toolset")){
                    toolset = schema.toolset;
                }
                if(!schema.allowDelete){
                    $.each(toolset,function(k,tool){
                        if(tool.type == "removeSelected"){
                            toolset.splice(k,1);
                        }
                    })
                }

                frame.generateElements({
                    children: [{
                        type:         'digitizingToolSet',
                        children:     toolset,
                        layer:        layer,
                        translations: {
                            drawPoint:             "Punkt setzen",
                            drawLine:              "Linie zeichnen",
                            drawPolygon:           "Polygon zeichnen",
                            drawRectangle:         "Rechteck zeichen",
                            drawCircle:            "Kreis zeichen",
                            drawEllipse:           "Ellipse zeichen",
                            drawDonut:             "Polygon mit Enklave zeichnen",
                            selectAndEditGeometry: "Objekt Position/Größe beabeiten",
                            moveGeometry:          "Objekt bewegen",
                            selectGeometry:        "Objekt selektieren",
                            removeSelected:        "Selektierte objekte löschen",
                            removeAll:             "Alle Objekte löschen"
                        },

                        // http://dev.openlayers.org/docs/files/OpenLayers/Control-js.html#OpenLayers.Control.events
                        controlEvents: {
                            featureadded: function(event) {
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

                                if(schema.openFormAfterEdit) {
                                    widget._openFeatureEditDialog(olFeature);
                                }

                                //return true;
                            },
                            onModification: function(event) {
                                var feature = findFeatureByPropertyValue(event.layer, 'id', event.id);
                                widget.unsavedFeatures[event.id] = feature;
                            },
                            // http://dev.openlayers.org/docs/files/OpenLayers/Control/DragFeature-js.html
                            onComplete: function(event) {
                                var feature = findFeatureByPropertyValue(event.layer, 'id', event.id);
                                widget.unsavedFeatures[event.id] = feature;
                            }
                        }
                    }, {
                        type:     'checkbox',
                        cssClass: 'onlyExtent',
                        title:    translate('toolset.current-extent'),
                        checked:  schema.searchType == "currentExtent",
                        change:   function(e) {
                            schema.searchType = $(e.originalEvent.target).prop("checked") ? "currentExtent" : "all";
                            widget._getData();
                        }
                    }]
                });
                var toolSetView = $(".digitizing-tool-set",frame);

                if(!schema.allowDigitize){
                    toolSetView.css('display','none');
                    toolSetView = $("<div class='digitizing-tool-sets'/>");
                    toolSetView.insertBefore(frame.find('.onlyExtent'));
                }


                toolSetView.generateElements({
                    type:     'fieldSet',
                    cssClass: 'right',
                    children: [{
                        type:     'button',
                        cssClass: 'fa fa-eye-slash',
                        title:    'Alle ausblenden',
                        click:    function(e) {
                            var tableApi = table.resultTable('getApi');
                            tableApi.rows(function(idx, feature, row) {
                                var $row = $(row);
                                var visibilityButton = $row.find('.button.icon-visibility');
                                visibilityButton.addClass('icon-invisibility');
                                $row.addClass('invisible-feature');
                                feature.layer.drawFeature(feature, 'invisible');
                            });
                        }
                    }, {
                        type:  'button',
                        title: 'Alle einblenden',
                        cssClass: 'fa fa-eye',
                        click: function(e) {
                            var tableApi = table.resultTable('getApi');
                            tableApi.rows(function(idx, feature, row) {
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

                frame.append('<div style="clear:both;"/>');


                frame.append(table);

                frames.push(schema);
                frame.css('display','none');

                frame.data("schemaSettings", schema);

                element.append(frame);
                option.data("schemaSettings",schema);
                selector.append(option);

                var selectControl = new OpenLayers.Control.SelectFeature(layer, {
                    hover:        true,
                    clickFeature: function(feature) {
                        var features = feature.cluster ? feature.cluster : [feature];

                        if(_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true})) {
                            return;
                        }
                        widget._openFeatureEditDialog(features[0]);
                    },
                    overFeature:  function(feature) {
                        widget._highlightSchemaFeature(schema, feature, true);
                    },
                    outFeature:   function(feature) {
                        widget._highlightSchemaFeature(schema, feature, false);
                    }
                });

                // Workaround to move map by touch vector features
                if(typeof(selectControl.handlers) != "undefined") { // OL 2.7
                    selectControl.handlers.feature.stopDown = false;
                } else if(typeof(selectFeatureControl.handler) != "undefined") { // OL < 2.7
                    selectControl.handler.stopDown = false;
                    selectControl.handler.stopUp = false;
                }

                schema.selectControl = selectControl;
                selectControl.deactivate();
                map.addControl(selectControl);
            });

            function onSelectorChange() {
                var option = selector.find(":selected");
                var schema = option.data("schemaSettings");
                var table = schema.table;
                var tableApi = table.resultTable('getApi');


                widget._trigger("beforeChangeDigitizing", null, {next: schema, previous: widget.currentSettings});

                if(widget.currentSettings) {
                    widget.deactivateFrame(widget.currentSettings);
                }

                widget.activateFrame(schema);

                table.off('mouseenter', 'mouseleave', 'click');

                table.delegate("tbody > tr", 'mouseenter', function() {
                    var tr = this;
                    var row = tableApi.row(tr);
                    widget._highlightFeature(row.data(), true);
                });

                table.delegate("tbody > tr", 'mouseleave', function() {
                    var tr = this;
                    var row = tableApi.row(tr);
                    widget._highlightFeature(row.data(), false);
                });

                table.delegate("tbody > tr", 'click', function() {
                    var tr = this;
                    var row = tableApi.row(tr);
                    widget.zoomToJsonFeature(row.data());
                });

                widget._getData();
            }

            selector.on('change',onSelectorChange);

            map.events.register("moveend", this, function() {
                widget._getData();
            });
            map.events.register("zoomend", this, function(e) {
                widget._getData();
                widget.updateClusterStrategies();
            });
            map.resetLayersZIndex();
            widget._trigger('ready');

            element.bind("mbdigitizerbeforechangedigitizing", function(e, sets) {
                var previousSettings = sets.previous;
                if(previousSettings){
                    var digitizerToolSetElement = $("> div.digitizing-tool-set", previousSettings.frame);
                    digitizerToolSetElement.digitizingToolSet("deactivateCurrentController");
                }
            });
            onSelectorChange();

            // Check position and react by
            var containerInfo = new MapbenderContainerInfo(widget, {
                onactive:   function() {
                    widget.activate();
                },
                oninactive: function() {
                    widget.deactivate();
                }
            });

            widget.updateClusterStrategies();
        },

        /**
         * On save button click
         *
         * @param {OpenLayers.Feature} feature OpenLayers feature
         * @private
         */
        saveFeature: function(feature) {
            if(feature.disabled){
                return;
            }

            var widget = this;
            var schema = feature.schema;
            var dialog = feature.editDialog;
            var table = schema.table;
            var tableWidget = table.data('visUiJsResultTable');
            var tableApi = table.resultTable('getApi');
            var formData = dialog && dialog.formData() || initialFormData(feature);
            var wkt = new OpenLayers.Format.WKT().write(feature);
            var srid = widget.map.getProjectionObject().proj.srsProjNumber;
            var request = {
                properties: formData,
                geometry:   wkt,
                srid:       srid,
                type:       "Feature"
            };

            tableApi.draw({"paging": "page"});

            if(!feature.isNew && feature.fid) {
                request.id = feature.fid;
            }

            var errorInputs = $(".has-error", dialog);
            var hasErrors = errorInputs.size() > 0;

            if(!hasErrors) {
                feature.disabled = true;
                dialog && dialog.disableForm();
                widget.query('save', {
                    schema:  schema.schemaName,
                    feature: request
                }).done(function(response) {

                    if(response.hasOwnProperty('errors')) {
                        dialog && dialog.enableForm();
                        feature.disabled = false;
                        $.each(response.errors, function(i, error) {
                            $.notify(error.message, {
                                title:     'API Error',
                                autoHide:  false,
                                className: 'error'
                            });
                            console.error(error.message);
                        });
                        return;
                    }

                    var hasFeatureAfterSave = response.features.length > 0;
                    delete widget.unsavedFeatures[feature.id];

                    if(!hasFeatureAfterSave) {
                        widget.reloadFeatures(schema.layer, _.without(schema.layer.features, feature));
                        dialog && dialog.popupDialog('close');
                        return;
                    }

                    var layer = feature.layer;
                    var dbFeature = response.features[0];
                    feature.fid = dbFeature.id;
                    feature.state = null;
                    if (feature.saveStyleDataCallback) {
                        // console.log("Late-saving style for feature", feature);
                        feature.saveStyleDataCallback(feature);
                        delete feature["saveStyleDataCallback"];
                    }
                    $.extend(feature.data, dbFeature.properties);

                    var geoJsonReader = new OpenLayers.Format.GeoJSON();
                    var newFeatures = geoJsonReader.read(response);
                    var newFeature = _.first(newFeatures);

                    _.each(['fid', 'disabled', 'state', 'data', 'layer', 'schema', 'isNew', 'renderIntent', 'styleId'], function(key) {
                        newFeature[key] = feature[key];
                    });

                    widget.reloadFeatures(schema.layer, _.union(_.without(layer.features, feature), [newFeature]));
                    feature = newFeature;

                    tableApi.row(tableWidget.getDomRowByData(feature)).invalidate();
                    tableApi.draw();

                    delete feature.isNew;

                    dialog && dialog.enableForm();
                    feature.disabled = false;
                    dialog && dialog.popupDialog('close');
                    $.notify(translate("feature.save.successfully"), 'info');
                });
            }
        },

        /**
         * Open edit feature dialog
         *
         * @param olFeature open layer feature
         * @private
         */
        _openFeatureEditDialog: function(olFeature) {
            var widget = this;
            var schema = olFeature.schema;
            var buttons = [];

            if(widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

            if(schema.printable) {
                var printButton = {
                    text:  translate("feature.print"),
                    click: function() {
                        var printWidget = $('.mb-element-printclient').data('mapbenderMbPrintClient');
                        if(printWidget) {
                            var dialog = $(this).closest(".ui-dialog-content");
                            var olFeature = dialog.data('feature');
                            printWidget.printDigitizerFeature(olFeature.schema.featureTypeName ? olFeature.schema.featureTypeName : olFeature.schema.schemaName, olFeature.fid);
                        } else {
                            $.notify("Druck element ist nicht verfügbar!");
                        }
                    }
                };
                buttons.push(printButton);
            }

            if(schema.allowCustomerStyle) {
                var styleButton = {
                    text:   translate('feature.style.change'),
                    click: function(e) {
                        var dialog = $(this).closest(".ui-dialog-content");
                        var feature = dialog.data('feature');
                        widget.openChangeStyleDialog(feature);
                    }
                };
                buttons.push(styleButton);
            }
            if(schema.allowEditData) {
                var saveButton = {
                    text:  translate("feature.save"),
                    click: function() {
                        var dialog = $(this).closest(".ui-dialog-content");
                        var feature = dialog.data('feature');
                        widget.saveFeature(feature);
                    }
                };
                buttons.push(saveButton);
            }
            if(schema.allowDelete) {
                buttons.push({
                    text:  translate("feature.remove"),
                    'class': 'critical',
                    click: function() {
                        var dialog = $(this).closest(".ui-dialog-content");
                        var olFeature = dialog.data('feature');
                        widget.removeFeature(olFeature);
                        widget.currentPopup.popupDialog('close');
                    }
                });
            }
            buttons.push({
                text:  translate("cancel"),
                click: function() {
                    widget.currentPopup.popupDialog('close');
                }
            });
            var popupConfiguration = {
                title: translate("feature.attributes"),
                width: widget.featureEditDialogWidth,
            };

            if(schema.popup) {
                if(!schema.popup.buttons) {
                    schema.popup.buttons = [];
                }
                $.extend(popupConfiguration, schema.popup);

                if(popupConfiguration.buttons && !schema._popupButtonsInitialized) {
                    // Initialize custom button events
                    _.each(popupConfiguration.buttons, function(button) {
                        if(button.click) {
                            var eventHandlerCode = button.click;
                            button.click = function(e) {
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

                    // Merge default and custom buttons
                    _.each(buttons, function(button) {
                        popupConfiguration.buttons.push(button);
                    });

                    schema._popupButtonsInitialized = true;
                }
            }

            var dialog = $("<div/>");
            olFeature.editDialog = dialog;

            if(!schema.elementsTranslated){
                translateStructure(widget.currentSettings.formItems);
                schema.elementsTranslated = true;
            }
            var formItems = widget._getPopupFormItems(schema);
            dialog.generateElements({children: formItems});
            dialog.popupDialog(popupConfiguration);
            schema.editDialog = dialog;
            widget.currentPopup = dialog;
            dialog.data('feature', olFeature);

            setTimeout(function() {
                dialog.formData(olFeature.data);
            }, 21);

            return dialog;
        },
        _getPopupFormItems: function(schema) {
            var schemaName = schema && (typeof schema === 'string' && schema || schema.schemaName) || this.schemaName;
            if (!this._popupFormItemsByScheme[schemaName]) {
                this._popupFormItemsByScheme[schemaName] = this._buildPopupFormItems(schemaName);
            }
            return this._popupFormItemsByScheme[schemaName];
        },
        _buildPopupFormItems: function(schemaName) {
            // copy initial definition
            var definitionCopy = [];
            $.each(this.options.schemes[schemaName].formItems, function() {
                // strip legacy server-side dynamic elements
                if (this.type && this.type === 'text' || this.type === 'breakLine') {
                    // do nothing
                } else {
                    definitionCopy.push(this);
                }
            });
            DataUtil.eachItem(definitionCopy, function(item) {
                if(item.type == "select" && item.dataStore && item.dataStore.editable && item.dataStore.popupItems) {

                    item.type = "fieldSet";
                    // TODO: merge item with new select
                    item.children = [{
                        type:    "select",
                        id:      item.id,
                        options: item.options,
                        name:    item.name

                    }, {
                        type:  "button",
                        title: "Edit",
                        click: function() {
                            var dataItemId = $(this).siblings().find('select').val();
                            var selectRef = $(this).siblings().find('select');

                            var dataStoreId = item.dataStore.id;
                            widget.query("datastore/get", {
                                schema:     widget.schemaName,
                                id:         dataStoreId,
                                dataItemId: dataItemId
                            }).done(function(data) {
                                widget._openEditDialog(data, item.dataStore.popupItems, item, selectRef);
                            });

                            return false;
                        }
                    }, {
                        type:  "button",
                        title: "New",
                        click: function() {
                            var selectRef = $(this).siblings().find('select');
                            widget._openEditDialog({}, item.dataStore.popupItems, item, selectRef);

                            return false;
                        }
                    }]
                }

                if(item.type == "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + olFeature.fid + "&field=" + item.name;
                    if(item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                        item.dbSrc = olFeature.data[item.name];
                        if(schema.featureType.files) {
                            $.each(schema.featureType.files, function(k, fileInfo) {
                                if(fileInfo.field && fileInfo.field == item.name) {
                                    if(fileInfo.formats) {
                                        item.accept = fileInfo.formats;
                                    }
                                }
                            });
                        }
                    }

                }

                if(item.type == 'image') {

                    if(!item.origSrc) {
                        item.origSrc = item.src;
                    }

                    if(item.hasOwnProperty("name") && olFeature.data.hasOwnProperty(item.name) && olFeature.data[item.name]) {
                        item.dbSrc = olFeature.data[item.name];
                        if(schema.featureType.files) {
                            $.each(schema.featureType.files, function(k, fileInfo) {
                                if(fileInfo.field && fileInfo.field == item.name) {

                                    if(fileInfo.uri) {
                                        item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                    } else {
                                        item.dbSrc = widget.options.fileUri + "/" + schema.featureType.table + "/" + item.name + "/" + item.dbSrc;
                                    }
                                }
                            });
                        }
                    }

                    var src = item.dbSrc ? item.dbSrc : item.origSrc;
                    if(item.relative) {
                        item.src = src.match(/^(http[s]?\:|\/{2})/) ? src : Mapbender.configuration.application.urls.asset + src;
                    } else {
                        item.src = src;
                    }
                }
            });

            // merge elements defined in theme
            var themeData = Mapbender.theme.mb.digitizer.popupData;
            var themeItems = Array.prototype.concat(
                themeData['__all__pre__'] || [],
                themeData[schemaName] || [],
                themeData['__all__post__'] || []);
            $.each(themeItems, function() {
                /**
                 * Workaround HACK for vis-ui: "text" type entries ONLY SUPPORT eval'd strings, BUT NO CALLABLES
                 * @todo: fork vis-ui, fix it
                 */
                if (this.text && typeof this.text === 'function') {
                    if (!window.vis_ui_hack_wrappers) {
                        window.vis_ui_hack_wrappers = {'_n': 0};
                    }
                    var bound_hack_name = 'wrap' + window.vis_ui_hack_wrappers['_n'];
                    window.vis_ui_hack_wrappers[bound_hack_name] = (function(data) { return this(data); }).bind(this.text);
                    var evalThat = '(window.vis_ui_hack_wrappers["' + bound_hack_name + '"](data))';
                    window.vis_ui_hack_wrappers['_n'] += 1;
                    this.text = evalThat;
                }
                definitionCopy.push(this);
            });
            return definitionCopy;
        },

        /**
         * Query intersect by bounding box
         *
         * @param request Request for ajax
         * @param bbox Bounding box or some object, which has toGeometry() method.
         * @param debug Drag
         *
         * @returns ajax XHR object
         *
         * @private
         *
         */
        _queryIntersect: function(request, bbox, debug) {
            var widget = this;
            var geometry = bbox.toGeometry();
            var _request = $.extend(true, {intersectGeometry: geometry.toString()}, request);

            if(debug){
                if(!widget._boundLayer) {
                    widget._boundLayer = new OpenLayers.Layer.Vector("bboxGeometry");
                    widget.map.addLayer(widget._boundLayer);
                }

                var feature = new OpenLayers.Feature.Vector(geometry);
                widget._boundLayer.addFeatures([feature], null, {
                    strokeColor:   "#ff3300",
                    strokeOpacity: 0,
                    strokeWidth:   0,
                    fillColor:     "#FF9966",
                    fillOpacity:   0.1
                });
            }
            return widget.query('select', _request, 'GET').done(function(featureCollection) {
                var schema = widget.options.schemes[_request["schema"]];
                widget._onFeatureCollectionLoaded(featureCollection, schema, this);
            });
        },

        /**
         * Analyse changed bounding box geometrie and load features as FeatureCollection.
         *
         * @private
         */
        _getData: function() {
            var widget = this;
            var schema = widget.currentSettings;
            var map = widget.map;
            var projection = map.getProjectionObject();
            var extent = map.getExtent();
            var request = {
                srid:       projection.proj.srsProjNumber,
                maxResults: schema.maxResults,
                schema:     schema.schemaName
            };

            switch (schema.searchType){
                case  "currentExtent":
                    if(schema.hasOwnProperty("lastBbox")) {
                        var bbox = extent.toGeometry().getBounds();
                        var lastBbox = schema.lastBbox;

                        var topDiff = bbox.top - lastBbox.top;
                        var leftDiff = bbox.left - lastBbox.left;
                        var rightDiff = bbox.right - lastBbox.right;
                        var bottomDiff = bbox.bottom - lastBbox.bottom;

                        var sidesChanged = {
                            left:   leftDiff < 0,
                            bottom: bottomDiff < 0,
                            right:  rightDiff > 0,
                            top:    topDiff > 0
                        };

                        if(sidesChanged.left) {
                            widget._queryIntersect(request, new OpenLayers.Bounds(bbox.left, bbox.bottom, bbox.left + leftDiff * -1, bbox.top));
                        }
                        if(sidesChanged.right) {
                            widget._queryIntersect(request, new OpenLayers.Bounds(bbox.right - rightDiff, bbox.bottom, bbox.right, bbox.top));
                        }
                        if(sidesChanged.top) {
                            widget._queryIntersect(request, new OpenLayers.Bounds(bbox.left - leftDiff, bbox.top - topDiff, bbox.right - rightDiff, bbox.top));
                        }
                        if(sidesChanged.bottom) {
                            widget._queryIntersect(request, new OpenLayers.Bounds(bbox.left - leftDiff, bbox.bottom + bottomDiff * -1, bbox.right - rightDiff, bbox.bottom));
                        }

                        if(!sidesChanged.left && !sidesChanged.right && !sidesChanged.top && !sidesChanged.bottom) {
                            widget._queryIntersect(request, extent);
                        }
                    } else {
                        widget._queryIntersect(request, extent);
                    }
                    schema.lastBbox = $.extend(true, {}, extent.toGeometry().getBounds());
                    break;

                default: // all
                    widget.query('select', request, 'GET').done(function(featureCollection) {
                        widget._onFeatureCollectionLoaded(featureCollection, schema, this);
                    });
                    break;
            }
        },
        _initialFormData: function(feature) {
            return initialFormData(feature);
        },

        /**
         * Highlight schema feature on the map and table view
         *
         * @param {object} schema
         * @param {OpenLayers.Feature} feature
         * @param {boolean} highlight
         * @private
         */
        _highlightSchemaFeature: function(schema, feature, highlight) {
            var widget = this;
            var table = schema.table;
            var tableWidget = table.data('visUiJsResultTable');
            var isSketchFeature = !feature.cluster && feature._sketch && _.size(feature.data) == 0;
            var features = feature.cluster ? feature.cluster : [feature];
            var layer = feature.layer;
            var domRow;

            if(feature.renderIntent && feature.renderIntent == 'invisible') {
                return;
            }

            if(isSketchFeature) {
                return;
            }

            var styleId = feature.styleId ? feature.styleId : 'default';

            if(feature.attributes && feature.attributes.label) {
                layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
            }else{
                layer.drawFeature(feature, highlight ? 'select' : styleId);
            }

            for (var k in features) {
                domRow = tableWidget.getDomRowByData(features[k]);
                if(domRow && domRow.size()) {
                    tableWidget.showByRow(domRow);
                    if(highlight) {
                        domRow.addClass('hover');
                    } else {
                        domRow.removeClass('hover');
                    }
                    break;
                }
            }
        },

        /**
         * Highlight feature on the map
         *
         * @param {OpenLayers.Feature} feature
         * @param {boolean} highlight
         * @private
         */
        _highlightFeature: function(feature, highlight) {

            if(!feature || (feature && !feature.layer)) {
                return;
            }

            if(feature.renderIntent && feature.renderIntent == 'invisible') {
                return;
            }

            var layer = feature.layer;
            var isFeatureVisible = _.contains(feature.layer.features, feature);
            var features = [];

            if(isFeatureVisible) {
                features.push(feature);
            } else {
                _.each(feature.layer.features, function(_feature) {
                    if(_feature.cluster && _.contains(_feature.cluster, feature)) {
                        features.push(_feature);
                        return false;
                    }
                });
            }

            _.each(features, function(feature) {
                var styleId = feature.styleId ? feature.styleId : 'default';

                if(feature.attributes && feature.attributes.label) {
                    layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
                } else {
                    layer.drawFeature(feature, highlight ? 'select' : styleId);
                }

            })
        },

        /**
         * Get target OpenLayers map object
         *
         * @returns  {OpenLayers.Map}
         */
        getMap: function(){
            return this.map;
        },

        /**
         * Zoom to JSON feature
         *
         * @param {OpenLayers.Feature} feature
         */
        zoomToJsonFeature: function(feature) {
            var widget = this;
            var olMap = widget.getMap();
            var schema = widget.findFeatureSchema(feature);

            olMap.zoomToExtent(feature.geometry.getBounds());
            if(schema.hasOwnProperty('zoomScaleDenominator')) {
                olMap.zoomToScale(schema.zoomScaleDenominator);
            }
        },

        /**
         * Open feature edit dialog
         *
         * @param {OpenLayers.Feature} feature
         */
        exportGeoJson: function(feature) {
            var widget = this;
            widget.query('export', {
                schema:  widget.schemaName,
                feature: feature,
                format:  'GeoJSON'
            }).done(function(response) {

            })
        },

        /**
         * Find schema definition by open layer object
         *
         * @param layer
         */
        findSchemaByLayer: function(layer) {
            return _.find(this.options.schemes, {layer: layer});
        },

        /**
         * Update cluster strategies
         */
        updateClusterStrategies: function() {

            var widget = this;
            var options = widget.options;
            var scale = Math.round(widget.map.getScale());
            var map = widget.map;
            var clusterSettings;
            var closestClusterSettings;

            $.each(options.schemes, function(i, schema) {
                clusterSettings = null;

                if(!schema.clustering) {
                    return
                }

                $.each(schema.clustering, function(y, _clusterSettings) {
                    if(_clusterSettings.scale == scale) {
                        clusterSettings = _clusterSettings;
                        return false;
                    }

                    if(_clusterSettings.scale < scale) {
                        if(closestClusterSettings && _clusterSettings.scale > closestClusterSettings.scale) {
                            closestClusterSettings = _clusterSettings;
                        } else {
                            if(!closestClusterSettings){
                                closestClusterSettings = _clusterSettings;
                            }
                        }
                    }
                });

                if(!clusterSettings && closestClusterSettings) {
                    clusterSettings = closestClusterSettings
                }

                if(clusterSettings) {

                    if(clusterSettings.hasOwnProperty('disable') && clusterSettings.disable) {
                        schema.clusterStrategy.distance = -1;
                        var features = schema.layer.features;
                        widget.reloadFeatures(schema.layer,[]);
                        schema.clusterStrategy.deactivate();
                        //schema.layer.redraw();
                        schema.isClustered = false;
                        widget.reloadFeatures(schema.layer,features);

                    } else {
                        schema.clusterStrategy.activate();
                        schema.isClustered = true;
                    }
                    if(clusterSettings.hasOwnProperty('distance')) {
                        schema.clusterStrategy.distance = clusterSettings.distance;
                    }

                } else {
                    //schema.clusterStrategy.deactivate();
                }
            });
        },

        /**
         * Get schema style map
         *
         * @param schema
         * @returns {OpenLayers.StyleMap}
         */
        getSchemaStyleMap: function(schema) {
            var widget = this;
            var styles = schema.styles ? schema.styles : {};
            for (var k in widget.styles) {
                styles[k] = new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style[k], styles[k] ? styles[k] : widget.styles[k]));
            }
            return new OpenLayers.StyleMap(styles, {extendDefault: true});
        },

        /**
         * Find olFeature schema by olFeature data
         *
         * @param olFeature
         * @returns {*}
         */
        findFeatureSchema: function(olFeature) {
            var widget = this;
            var options = widget.options;
            return _.find(options.schemes, {layer: olFeature.layer});
        },

        /**
         * Create vector feature layer
         *
         * @param schema
         * @returns {OpenLayers.Layer.Vector}
         */
        createSchemaFeatureLayer: function(schema) {
            var widget = this;
            var styles = schema.styles ? schema.styles : {};
            var isClustered = schema.isClustered = schema.hasOwnProperty('clustering');
            var strategies = [];
            var styleMap = new OpenLayers.StyleMap({
                'default': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["default"], styles['default'] ? $.extend({}, widget.styles.default, styles['default']) : widget.styles.default), {
                    context: {
                        label: function(feature) {
                            if(feature.attributes.hasOwnProperty("label")){
                                return feature.attributes.label;
                            }
                            return feature.cluster && feature.cluster.length > 1 ? feature.cluster.length : "";
                        }
                    }
                }),
                'select':    new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["select"], styles['select'] ? styles['select'] : widget.styles.select)) //,
                // 'invisible':
            }, {extendDefault: true});

            styleMap.styles.invisible = new OpenLayers.Style({
                strokeWidth: 1,
                fillColor:   "#F7F79A",
                strokeColor: '#6fb536',
                display: 'none'
            });
            styleMap.styles.labelText = new OpenLayers.Style({
                strokeWidth:   0,
                fillColor:     '#cccccc',
                fillOpacity:   0,
                strokeColor:   '#5e1a2b',
                strokeOpacity: 0,
                pointRadius:   15,
                label:         '${label}',
                fontSize:      15
            });
            styleMap.styles.labelTextHover = new OpenLayers.Style({
                strokeWidth: 0,
                fillColor:   '#cccccc',
                strokeColor: '#2340d3',
                fillOpacity: 1,
                pointRadius: 15,
                label:       '${label}',
                fontSize:    15
            });

            if(isClustered) {
                var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
                strategies.push(clusterStrategy);
                schema.clusterStrategy = clusterStrategy;
            }
            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap:   styleMap,
                visibility: false, // rendererOptions: {zIndexing: true},
                strategies: strategies
            });

            layer.name = schema.label;
            return layer;
        },

        /**
         * Remove OL feature
         *
         * @version 0.2
         * @returns {*}
         * @param  {OpenLayers.Feature} olFeature
         */
        removeFeature: function(olFeature) {
            var widget = this;
            var schema = widget.findFeatureSchema(olFeature);
            var isNew = olFeature.hasOwnProperty('isNew');
            var layer = olFeature.layer;
            var featureData = olFeature.attributes;

            if(!schema) {
                $.notify("Feature remove failed.", "error");
                return;
            }

            function _removeFeatureFromUI() {
                //var clonedFeature = jQuery.extend(true, {}, olFeature);
                var existingFeatures = schema.isClustered ? _.flatten(_.pluck(layer.features, "cluster")) : layer.features;
                widget.reloadFeatures(layer, _.without(existingFeatures, olFeature));

                widget._trigger('featureRemoved', null, {
                    schema:  schema,
                    feature: featureData
                });
            }

            if(isNew) {
                _removeFeatureFromUI()
            } else {
                Mapbender.confirmDialog({
                    html:      translate("feature.remove.from.database"),
                    onSuccess: function() {
                        widget.query('delete', {
                            schema:  schema.schemaName,
                            feature: featureData
                        }).done(function(fid) {
                            _removeFeatureFromUI();
                            $.notify(translate('feature.remove.successfully'), 'info');
                        });
                    }
                });
            }

            return olFeature;
        },

        /**
         * Get OL feature by X:Y coordinates.
         *
         * Dirty but works.
         *
         * @param x
         * @param y
         * @returns {Array}
         * @private
         */
        _getFeaturesFromEvent: function(x, y) {
            var features = [], targets = [], layers = [];
            var layer, target, feature, i, len;
            var map = this.map;

            //map.resetLayersZIndex();

            // go through all layers looking for targets
            for (i = map.layers.length - 1; i >= 0; --i) {
                layer = map.layers[i];
                if(layer.div.style.display !== "none") {
                    if(layer === this.activeLayer) {
                        target = document.elementFromPoint(x, y);
                        while (target && target._featureId) {
                            feature = layer.getFeatureById(target._featureId);
                            if(feature) {
                                features.push(feature);
                                target.style.visibility = 'hidden';
                                targets.push(target);
                                target = document.elementFromPoint(x, y);
                            } else {
                                target = false;
                            }
                        }
                    }
                    layers.push(layer);
                    layer.div.style.display = "none";
                }
            }

            // restore feature visibility
            for (i = 0, len = targets.length; i < len; ++i) {
                targets[i].style.display = "";
                targets[i].style.visibility = 'visible';
            }

            // restore layer visibility
            for (i = layers.length - 1; i >= 0; --i) {
                layers[i].div.style.display = "block";
            }

            //map.resetLayersZIndex();
            return features;
        },

        /**
         * Handle feature collection by ajax response.
         *
         * @param featureCollection FeatureCollection
         * @param schema
         * @param xhr ajax request object
         * @private
         * @version 0.2
         */
        _onFeatureCollectionLoaded: function(featureCollection, schema, xhr) {

            if(!featureCollection || !featureCollection.hasOwnProperty("features")) {
                Mapbender.error(translate("features.loading.error"), featureCollection, xhr);
                return;
            }
            var widget = this;
            var geoJsonReader = new OpenLayers.Format.GeoJSON();
            var currentExtentOnly = schema.searchType == "currentExtent";
            var layer = schema.layer;
            var map = layer.map;
            var extent = map.getExtent();
            var bbox = extent.toGeometry().getBounds();
            var existingFeatures = schema.isClustered ? _.flatten(_.pluck(layer.features, "cluster")) : layer.features;
            var visibleFeatures = currentExtentOnly ? _.filter(existingFeatures, function(olFeature) {
                return olFeature && (olFeature.hasOwnProperty('isNew') || olFeature.geometry.getBounds().intersectsBounds(bbox));
            }) : existingFeatures;
            var visibleFeatureIds = _.pluck(visibleFeatures, "fid");
            var filteredNewFeatures = _.filter(featureCollection.features, function(feature) {
                return !_.contains(visibleFeatureIds, feature.id);
            });
            var newUniqueFeatures = geoJsonReader.read({
                type:     "FeatureCollection",
                features: filteredNewFeatures
            });

            var _features = _.union(newUniqueFeatures, visibleFeatures);

            if(schema.group && schema.group == "all") {
                _features = geoJsonReader.read({
                    type:     "FeatureCollection",
                    features: featureCollection.features
                });
            }

            var features = [];
            var polygones = [];
            var lineStrings = [];
            var points = [];

            _.each(_features, function(feature) {
                if(!feature.geometry){
                    return;
                }
                switch (feature.geometry.CLASS_NAME) {
                    case  "OpenLayers.Geometry.Polygon":
                        polygones.push(feature);
                        break;
                    case  "OpenLayers.Geometry.LineString":
                        lineStrings.push(feature);
                        break;
                    case  "OpenLayers.Geometry.Point":
                        points.push(feature);
                        // if(feature.attributes.label) {
                        //     feature.style = new OpenLayers.Style({
                        //         'label': '${label}'
                        //     });
                        // }
                        break;
                    default:
                        features.push(feature);
                }
            });

            widget.reloadFeatures(layer, _.union(features, polygones, lineStrings, points));
        },

        /**
         * Reload or replace features from the layer and feature table
         * - Fix OpenLayer bug by clustered features.
         *
         * @param layer
         * @version 0.2
         */
        reloadFeatures: function(layer, _features) {
            var widget = this;
            var schema = widget.findSchemaByLayer(layer);
            var tableApi = schema.table.resultTable('getApi');
            var features = _features ? _features : layer.features;

            if(features.length && features[0].cluster) {
                features = _.flatten(_.pluck(layer.features, "cluster"));
            }

            var featuresWithoutDrawElements = _.difference(features, _.where(features, {_sketch: true}));

            layer.setVisibility(widget._getLayerVisibility(schema));

            layer.removeAllFeatures();
            layer.addFeatures(features);

            // Add layer to feature
            _.each(features, function(feature) {
                feature.layer = layer;
                feature.schema = schema;

                if(feature.attributes && feature.attributes.label) {
                    feature.styleId = "labelText";
                    widget._highlightFeature(feature);
                    return;
                }

                if(schema.featureStyles && schema.featureStyles[feature.fid]) {
                    if(!feature.styleId){
                        var styleData = schema.featureStyles[feature.fid];
                        var styleMap = layer.options.styleMap;
                        var styles = styleMap.styles;
                        var styleId = styleData.id;
                        var style = new OpenLayers.Style(styleData, {uid: styleId});
                        // style.id = styleId;
                        styles[styleId] = style;
                        feature.styleId = styleId;
                        widget._highlightFeature(feature);
                    }
                }

            });

            layer.redraw();

            tableApi.clear();
            tableApi.rows.add(featuresWithoutDrawElements);
            tableApi.draw();

            if(widget.options.__disabled){
                widget.deactivate();
            }

            // var tbody = $(tableApi.body());

            // Post handling
            var nodes = tableApi.rows(function(idx, data, row) {
                var isInvisible = data.renderIntent == 'invisible';
                if(isInvisible) {
                    var $row = $(row);
                    var visibilityButton = $row.find('.button.icon-visibility');
                    visibilityButton.addClass('icon-invisibility');
                    $row.addClass('invisible-feature');
                }
                return true;
            });
        },


        _openEditDialog: function(dataItem, formItems, schema, ref) {
            var schemaName = this.schemaName;
            var widget = this;
            var uniqueKey = schema.dataStore.uniqueId;
            var buttons = [];

            if(widget.currentPopup.currentPopup) {
                widget.currentPopup.currentPopup.popupDialog('close');
                widget.currentPopup.currentPopup = null;
            }

            var saveButton = {
                text:  translate("mb.data.store.save", true),
                click: function() {
                    var form = $(this).closest(".ui-dialog-content");
                    var errorInputs = $(".has-error", dialog);
                    var hasErrors = errorInputs.size() > 0;

                    if(!hasErrors) {
                        var formData = form.formData();
                        var uniqueIdKey = schema.dataStore.uniqueId;
                        var isNew = !dataItem.hasOwnProperty(uniqueIdKey) && !!dataItem[uniqueIdKey];

                        if(!isNew) {
                            formData[uniqueIdKey] = dataItem[uniqueIdKey];
                        } else {
                            delete formData[uniqueIdKey];
                        }

                        form.disableForm();
                        widget.query('datastore/save', {
                            schema:     schemaName,
                            dataItem:   formData,
                            id:         schema.dataStore.id,
                            dataItemId: dataItem[uniqueKey]
                        }).done(function(response) {
                            if(response.hasOwnProperty('errors')) {
                                form.enableForm();
                                $.each(response.errors, function(i, error) {
                                    $.notify(error.message, {
                                        title:     'API Error',
                                        autoHide:  false,
                                        className: 'error'
                                    });
                                    console.error(error.message);
                                });
                                return;
                            }
                            _.extend(dataItem, response.dataItem);
                            if(isNew) {
                                var textKey = item.dataStore.text;
                                var uniqueKey = item.dataStore.uniqueId;

                                ref.append('<option value="' + dataItem[uniqueKey] + '">' + dataItem[textKey] + '</option>');
                            }
                            widget.currentPopup.currentPopup.popupDialog('close');
                            widget.currentPopup.currentPopup = null;
                            $.notify(translate("mb.data.store.save.successfully", true), 'info');
                        }).done(function() {
                            form.enableForm();
                        });
                    }
                }
            };
            buttons.push(saveButton);

            buttons.push({
                text:    translate("mb.data.store.remove", true),
                'class': 'critical',
                click:   function() {
                    widget.query('datastore/remove', {
                        schema:     schemaName,
                        dataItem:  dataItem,
                        id:         schema.dataStore.id,

                    }).done(function(response) {

                        //widget.removeData(dataItem);
                        widget.currentPopup.currentPopup.popupDialog('close');
                        widget.currentPopup.currentPopup = null;
                    })
                }
            });

            buttons.push({
                text:  translate("cancel"),
                click: function() {
                    widget.currentPopup.currentPopup.popupDialog('close');
                    widget.currentPopup.currentPopup = null;
                }
            });
            var dialog = $("<div/>");
            dialog.on("popupdialogopen", function(event, ui) {
                setTimeout(function() {
                    dialog.formData(dataItem);

                }, 1);
            });

            /*   if(!schema.elementsTranslated) {
             translateStructure(widget.currentSettings.formItems);
             schema.elementsTranslated = true;
             } */

            DataUtil.eachItem(widget.currentSettings.formItems, function(item) {
                if(item.type == "file") {
                    item.uploadHanderUrl = widget.elementUrl + "file-upload?schema=" + schema.schemaName + "&fid=" + dataItem.fid + "&field=" + item.name;
                    if(item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                        item.dbSrc = dataItem.data[item.name];
                        if(schema.featureType.files) {
                            $.each(schema.featureType.files, function(k, fileInfo) {
                                if(fileInfo.field && fileInfo.field == item.name) {
                                    if(fileInfo.formats) {
                                        item.accept = fileInfo.formats;
                                    }
                                }
                            });
                        }
                    }

                }

                if(item.type == 'image') {

                    if(!item.origSrc) {
                        item.origSrc = item.src;
                    }

                    if(item.hasOwnProperty("name") && dataItem.data.hasOwnProperty(item.name) && dataItem.data[item.name]) {
                        item.dbSrc = dataItem.data[item.name];
                        if(schema.featureType.files) {
                            $.each(schema.featureType.files, function(k, fileInfo) {
                                if(fileInfo.field && fileInfo.field == item.name) {

                                    if(fileInfo.uri) {
                                        item.dbSrc = fileInfo.uri + "/" + item.dbSrc;
                                    } else {
                                    }
                                }
                            });
                        }
                    }

                    var src = item.dbSrc ? item.dbSrc : item.origSrc;
                    if(item.relative) {
                        item.src = src.match(/^(http[s]?\:|\/{2})/) ? src : Mapbender.configuration.application.urls.asset + src;
                    } else {
                        item.src = src;
                    }
                }
            });
            /*  if(schema.popup.buttons) {
             buttons = _.union(schema.popup.buttons, buttons);
             } */
            var popupConfig = _.extend({
                title: translate("edit.title"),
                width: widget.featureEditDialogWidth,
            }, schema.popup);

            popupConfig.buttons = buttons;

            dialog.generateElements({children: formItems});
            dialog.popupDialog(popupConfig);
            dialog.addClass("data-store-edit-data");
            widget.currentPopup.currentPopup = dialog;
            return dialog;
        },

        save: function(dataItem) {
            //dataItem.uniqueId
        },

        /**
         * Digitizer API connection query
         *
         * @param uri suffix
         * @param data object or null
         * @param method string (default 'POST'; @todo: 'GET' should be default)
         * @return xhr jQuery XHR object
         * @version 0.2
         */
        query: function(uri, data, method) {
            var widget = this;
            return $.ajax({
                url:         widget.elementUrl + uri,
                method:      method || 'POST',
                contentType: "application/json; charset=utf-8",
                dataType:    "json",
                data:        data && (method === 'GET' && data || JSON.stringify(data)) || null
            }).error(function(xhr) {
                var errorMessage = translate('api.query.error-message');
                var errorDom = $(xhr.responseText);

                if(errorDom.size() && errorDom.is(".sf-reset")) {
                    errorMessage += "\n" + errorDom.find(".block_exception h2").text() + "\n";
                    errorMessage += "Trace:\n";
                    _.each(errorDom.find(".traces li"), function(li) {
                        errorMessage += $(li).text() + "\n";
                    });

                } else if(errorDom.has(".loginBox.login").size()) {
                    var loginURL = errorDom.find(".loginBox.login form").attr("action").replace(/\/check$/, '');
                    location.href = loginURL;
                    // $("<div/>")
                    //     .popupDialog({
                    //         modal:  true,
                    //         height: 400,
                    //         width:  "600px"
                    //     })
                    //     .append($("<iframe src='" + loginURL + "'> "))
                    $.notify("Bitte loggen sie sich ein.");
                } else {
                    errorMessage += JSON.stringify(xhr.responseText);
                }

                $.notify(errorMessage, {
                    autoHide: false
                });
                console.log(errorMessage, xhr);
            });
        },

        activate: function() {
            var widget = this;
            widget.options.__disabled = false;
            widget.activateFrame(widget.currentSettings);
        },

        deactivate: function() {
            var widget = this;
            // clear unsaved features to prevent multiple confirmation popups
            var unsavedFeatures = widget.unsavedFeatures;
            widget.unsavedFeatures = {};
            var always = function() {
                widget.options.__disabled = true;
                if(!widget.currentSettings.displayOnInactive) {
                    widget.deactivateFrame(widget.currentSettings);
                }
            };
            if (widget.options.confirmSaveOnDeactivate) {
                widget._confirmSave(unsavedFeatures, always);
            } else {
                always();
            }
        },
        _confirmSave: function(unsavedFeatures, callback) {
            var widget = this;
            var numUnsaved = _.size(unsavedFeatures);
            if (numUnsaved) {
                var html = "<p>Sie haben "
                    + ((numUnsaved > 1) ?
                        "" + numUnsaved + " &Auml;nderungen"
                        : "eine &Auml;nderung")
                    + " vorgenommen und noch nicht gespeichert.</p>"
                    + "<p>Wollen sie diese jetzt speichern oder verwerfen?</p>";
                var confirmOptions = {
                    okText:     "Jetzt Speichern",
                    cancelText: "Verwerfen",
                    html:       html,
                    title:      "Ungespeicherte Änderungen",
                    onSuccess: function() {
                        _.forEach(unsavedFeatures, function(feature) {
                            widget.saveFeature(feature);
                        });
                        callback();
                    },
                    onCancel: function() {
                        var layersToReset = {};
                        _.forEach(unsavedFeatures, function(feature) {
                            if (feature.isNew) {
                                widget.removeFeature(feature);
                            } else if (feature.layer) {
                                layersToReset[feature.layer.id] = feature.layer;
                            }
                        });
                        if (_.size(layersToReset)) {
                            _.forEach(layersToReset, function(layer) {
                                // _getData will skip existing features, so we need
                                // to clean up first before ...
                                layer.removeAllFeatures();
                            });
                            // ... we reload (from server) and reinitialize all features
                            widget._getData();
                        }
                        callback();
                    }
                };
                Mapbender.confirmDialog(confirmOptions);
            } else {
                callback();
            }
        },
        activateFrame:   function(schema) {
            var widget = this;
            var frame = schema.frame;
            var layer = schema.layer;

            if(widget.options.__disabled){
                return;
            }

            widget.activeLayer = schema.layer;
            widget.schemaName = schema.schemaName;
            widget.currentSettings = schema;

            widget.query('style/list', {schema: schema.schemaName}, 'GET').done(function(r) {
                schema.featureStyles = r.featureStyles;
                widget.reloadFeatures(layer);
                layer.setVisibility(widget._getLayerVisibility(schema));
                frame.css('display', 'block');
                schema.selectControl.activate();
            });

        },

        deactivateFrame: function(schema) {
            var widget = this;
            var frame = schema.frame;
            //var tableApi = schema.table.resultTable('getApi');
            var layer = schema.layer;

            frame.css('display', 'none');

            if(!schema.displayPermanent) {
                layer.setVisibility(false);
            }

            schema.selectControl.deactivate();

            // https://trac.wheregroup.com/cp/issues/4548
            if(widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }
        },
        _getLayerVisibility: function(schema) {
            var visible = true;
            if (schema.zoomDependentVisibility && !schema.displayPermanent) {
                var zoomConfig = schema.zoomDependentVisibility;
                var scale = Math.ceil(this.map.getScale());
                visible &= !zoomConfig.max || zoomConfig.max >= scale;
                visible &= !zoomConfig.min || zoomConfig.min <= scale;
            }
            return visible;
        }
    });

})(jQuery);
