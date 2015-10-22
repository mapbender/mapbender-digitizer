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
            buttons:     [{
                text:  "OK",
                click: function(e) {
                    if(!options.hasOwnProperty('onSuccess') || options.onSuccess(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }, {
                text:    "Abbrechen",
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
            openFormAfterEdit: true,
            maxResults: 5001,
            oneInstanceEdit: true,
            searchType: "currentExtent",
            inlineSearch: false,
            useContextMenu: false,
            clustering: [
                {scale: 5000000, distance: 30}
            ]
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

        /**
         * Default styles merged by schema styles if defined
         */
        styles: {
            'default': {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor:   "#6fb536",
                fillOpacity: 0.3,
                label: '${label}'
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

            function createSubMenu(olFeature) {
                var layer = olFeature.layer;
                var schema = widget.findSchemaByLayer(layer);
                var subItems = {
                    zoomTo: {
                        name:   "Zoom to",
                        action: function(key, options, parameters) {
                            widget.zoomToJsonFeature(parameters.olFeature);
                        }
                    }
                };

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
                build:    function(trigger, e) {
                    var items = {};
                    var schema = widget.currentSettings;
                    var feature = schema.layer.getFeatureFromEvent(e);
                    var features;

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
                            var parameters = options.items[options.$selected.parent().closest('.context-menu-item').data('contextMenuKey')];
                            if(parameters.items[key].action) {
                                parameters.items[key].action(key, options, parameters);
                            }
                        }
                    };
                }
            });

            $.contextMenu({
                selector: '.mapbender-element-result-table > div > table > tbody > tr',
                build:    function($trigger, e) {
                    var tr = $($trigger);
                    var resultTable = tr.closest('.mapbender-element-result-table');
                    var api = resultTable.resultTable('getApi');
                    var olFeature = api.row(tr).data();
                    var schema = widget.findFeatureSchema(olFeature);
                    var items = {};

                    if(schema.useContextMenu) {
                        items['zoom'] = {name: "Zoom to"};
                        if(schema.allowDelete) {
                            items['removeFeature'] = {name: "Remove"};
                        }

                        if(schema.allowEditData) {
                            items['edit'] = {name: "Edit"};
                        }
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
                            }
                        },
                        items:    items
                    };
                }
            });

            if(options.tableTranslation) {
                translateObject(options.tableTranslation);
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
                if( !schema.hasOwnProperty("tableFields")){
                    console.error(translate("table.fields.not.defined"),schema );
                }

                $.each(schema.tableFields, function(fieldName, fieldSettings) {
                    newFeatureDefaultProperties[fieldName] = "";
                    fieldSettings.title = fieldSettings.label;
                    fieldSettings.data = "data." + fieldName;
                    columns.push(fieldSettings);
                });


                var resultTableSettings = {
                    lengthChange: false,
                    pageLength: 10,
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
                        type:           'digitizingToolSet',
                        children:       toolset,
                        layer:    layer,

                        // http://dev.openlayers.org/docs/files/OpenLayers/Control-js.html#OpenLayers.Control.events
                        controlEvents: {
                            featureadded: function(event) {
                                var olFeature = event.feature;
                                var layer = event.object.layer;
                                var schema = widget.findSchemaByLayer(layer);
                                var digitizerToolSetElement = $(".digitizing-tool-set", frame);
                                var properties = jQuery.extend(true, {}, newFeatureDefaultProperties); // clone from newFeatureDefaultProperties
                                //
                                //if(schema.isClustered){
                                //    $.notify('Create new feature is by clusterring not posible');
                                //    return false;
                                //}

                                olFeature.isNew = true;
                                olFeature.attributes = olFeature.data = properties;
                                olFeature.layer = layer;

                                //widget.reloadFeatures(layer);
                                window.setTimeout(function(){

                                },1000);
                                layer.redraw();

                                digitizerToolSetElement.digitizingToolSet("deactivateCurrentController");

                                if(schema.openFormAfterEdit) {
                                    widget._openFeatureEditDialog(olFeature);
                                }

                                //return true;
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

                if(!schema.allowDigitize){
                    $(".digitizing-tool-set",frame).css('display','none');
                }

                frame.append(table);

                frames.push(schema);
                frame.css('display','none');

                frame.data("schemaSettings", schema);

                element.append(frame);
                option.data("schemaSettings",schema);
                selector.append(option);

                var tableWidget = table.data('visUiJsResultTable');
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
                        var features = feature.cluster ? feature.cluster : [feature];
                        var lastFeatureRow;

                        _.each(features, function(feature) {
                            var domRow = tableWidget.getDomRowByData(feature);
                            tableWidget.showByRow(domRow);
                            domRow.addClass('hover');
                            lastFeatureRow = domRow;
                        });
                        tableWidget.showByRow(lastFeatureRow);

                        layer.drawFeature(feature, 'select');
                    },
                    outFeature:   function(feature) {
                        var features = feature.cluster ? feature.cluster : [feature];

                        _.each(features, function(feature) {
                            var domRow = tableWidget.getDomRowByData(feature);
                            domRow.removeClass('hover');
                        });

                        layer.drawFeature(feature, 'default');
                    }
                });

                schema.selectControl = selectControl;
                selectControl.deactivate();
                map.addControl(selectControl);
            });

            function deactivateFrame(schema) {
                var frame = schema.frame;
                //var tableApi = schema.table.resultTable('getApi');
                var layer = schema.layer;

                frame.css('display', 'none');

                if(!schema.displayPermanent){
                    layer.setVisibility(false);
                }

                schema.selectControl.deactivate();

                // https://trac.wheregroup.com/cp/issues/4548
                if(widget.currentPopup){
                    widget.currentPopup.popupDialog('close');
                }


                //layer.redraw();
                //layer.removeAllFeatures();
                //tableApi.clear();
            }

            function activateFrame(schema) {
                var frame = schema.frame;
                var layer = schema.layer;

                widget.activeLayer = schema.layer;
                widget.schemaName = schema.schemaName;
                widget.currentSettings = schema;
                layer.setVisibility(true);
                //layer.redraw();
                frame.css('display', 'block');

                schema.selectControl.activate();
            }

            function onSelectorChange() {
                var option = selector.find(":selected");
                var schema = option.data("schemaSettings");
                var table = schema.table;
                var tableApi = table.resultTable('getApi');


                widget._trigger("beforeChangeDigitizing", null, {next: schema, previous: widget.currentSettings});

                if(widget.currentSettings) {
                    deactivateFrame(widget.currentSettings);
                }

                activateFrame(schema);

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
            //widget.map.resetLayersZIndex();
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
                    activateFrame(widget.currentSettings);
                },
                oninactive: function() {
                    if(!widget.currentSettings.displayOnInactive) {
                        deactivateFrame(widget.currentSettings);
                    }
                }
            });

            widget.updateClusterStrategies();

        },

        /**
         * Open edit feature dialog
         *
         * @param olFeature open layer feature
         * @private
         */

        _openFeatureEditDialog: function(olFeature) {
            var widget = this;

            if(widget.currentPopup) {
                widget.currentPopup.popupDialog('close');
            }

            var schema = widget.findSchemaByLayer(olFeature.layer);
            var table = schema.table;
            var tableApi = table.resultTable('getApi');
            var buttons = [];

            if(schema.allowEditData){
                var saveButton = {
                    text: translate("feature.save"),
                    click: function() {
                        var form = $(this).closest(".ui-dialog-content");
                        var formData = form.formData();
                        var wkt = new OpenLayers.Format.WKT().write(olFeature);
                        var srid = widget.map.getProjectionObject().proj.srsProjNumber;
                        var request = {
                            properties: formData,
                            geometry:   wkt,
                            srid:       srid,
                            type:       "Feature"
                        };

                        $.extend(olFeature.data, formData);
                        tableApi.draw({"paging":"page"});

                        if(!olFeature.isNew && olFeature.fid){
                            request.id = olFeature.fid;
                        }

                        var errorInputs = $(".has-error", dialog);
                        var hasErrors = errorInputs.size() > 0;

                        if( !hasErrors ){
                            form.disableForm();
                            widget.query('save', {
                                schema:  widget.schemaName,
                                feature: request
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

                                var hasFeatureAfterSave = response.features.length > 0;

                                if(!hasFeatureAfterSave) {
                                    widget.reloadFeatures( schema.layer, _.without(schema.layer.features, olFeature));
                                    widget.currentPopup.popupDialog('close');
                                    return;
                                }

                                var dbFeature = response.features[0];
                                olFeature.fid = dbFeature.id;
                                olFeature.state = null;
                                $.extend(olFeature.data, dbFeature.properties);

                                tableApi.draw();

                                delete olFeature.isNew;

                                form.enableForm();
                                widget.currentPopup.popupDialog('close');
                                $.notify(translate("feature.save.successfully"), 'info');

                            });
                        }
                    }
                };
                buttons.push(saveButton);
            }
            if(schema.allowDelete) {
                buttons.push({
                    text:  translate("feature.remove"),
                    'class': 'critical',
                    click: function() {
                        widget.removeFeature(olFeature);
                        widget.currentPopup.popupDialog('close');
                    }
                });
            }
            buttons.push({
                text:  translate("mb.digitizer.cancel",true),
                click: function() {
                    widget.currentPopup.popupDialog('close');
                }
            });
            var popupConfiguration = {
                title: translate("feature.attributes"),
                width: widget.featureEditDialogWidth,
                buttons: buttons
            };

            if(widget.currentSettings.hasOwnProperty('popup')){
                $.extend(popupConfiguration,widget.currentSettings.popup);
            }

            var dialog = $("<div/>");

            if(!schema.elementsTranslated){
                translateStructure(widget.currentSettings.formItems);
                schema.elementsTranslated = true;
            }

            DataUtil.eachItem(widget.currentSettings.formItems, function(item) {
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

            dialog.generateElements({children: widget.currentSettings.formItems});
            dialog.popupDialog(popupConfiguration);
            widget.currentPopup = dialog;
            setTimeout(function() {
                dialog.formData(olFeature.data);
            }, 21);

            return dialog;
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
            return widget.query('select', _request).done(function(featureCollection) {
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

                    if(schema.searchType == "currentExtent") {
                        schema.allFeaturesQueued = false;
                    }

                    if(!schema.allFeaturesQueued) {
                        schema.allFeaturesQueued = true;
                        widget.query('select', request).done(function(featureCollection) {
                            widget._onFeatureCollectionLoaded(featureCollection, schema, this);
                        });
                    }
                    break;
            }
        },

        _highlightFeature: function(olFeature, highlight) {
            if(!olFeature) {
                return;
            }

            var layer = olFeature.layer;
            var isClustered = !!layer.features[0].cluster;


            if(isClustered){
                var cluster;
                _.each(layer.features,function(clusteredFeature){
                    _.each(clusteredFeature.cluster, function(_feature){
                        if(_feature == olFeature){
                            cluster = clusteredFeature;
                            return false;
                        }
                    });
                    if(cluster){
                        layer.drawFeature(olFeature, highlight ? 'select' : 'default');
                        return false;
                    }
                });
            }else{
                layer.drawFeature(olFeature, highlight ? 'select' : 'default');
            }


            //olFeature.renderIntent = highlight ? 'select' : 'default';
            //olFeature.layer.redraw();
        },

        /**
         * Zoom to JSON feature
         *
         * @param olFeature
         */
        zoomToJsonFeature: function(olFeature) {
            var widget = this;
            var olMap = widget.map;
            var schema = widget.findFeatureSchema(olFeature);

            olMap.zoomToExtent(olFeature.geometry.getBounds());

            if(schema.hasOwnProperty('zoomScaleDenominator')) {
                olMap.zoomToScale(schema.zoomScaleDenominator);
            }
        },

        /**
         * Open feature edit dialog
         *
         * @param feature
         */
        exportGeoJson: function(feature) {
            var widget = this;
            widget.query('export', {
                schema:  widget.schemaName,
                feature: feature,
                format:  'GeoJSON'
            }).done(function(response) {
                debugger;
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
         * Get features from cluster
         *
         * @param olFeaturesRaw
         * @returns {Array}
         */
        getFeaturesFromCluster: function(olFeaturesRaw) {
            var olFeatures = [];
            $.each(olFeaturesRaw, function(i, olFeature) {
                if(olFeature.cluster) {
                    $.each(olFeature.cluster, function(i, _olFeature) {
                        _olFeature.layer = olFeature.layer;
                        olFeatures.push(_olFeature);
                    })
                } else {
                    olFeatures.push(olFeature);
                }
            });
            return olFeatures;
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
         * Normalize open layer feature
         * @param _olFeature
         * @returns {*}
         */
        normalizeOpenLayerFeature: function(_olFeature) {
            var olFeature = _olFeature;
            if(_olFeature.cluster) {
                olFeature = _.last(_olFeature.cluster);
                olFeature.layer = _olFeature.layer;
            }
            return olFeature;
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
                            return feature.cluster && feature.cluster.length > 1 ? feature.cluster.length : "";
                        }
                    }
                }),
                'select':  new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["select"], styles['select'] ? styles['select'] : widget.styles.select))
            }, {extendDefault: true});

            if(isClustered) {
                var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 40});
                strategies.push(clusterStrategy);
                schema.clusterStrategy = clusterStrategy;
            }
            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap:   styleMap,
                strategies: strategies
            });

            layer.name = schema.label;
            return layer;
        },

        /**
         * Remove OL feature
         *
         * @param feature
         * @version 0.2
         * @returns {*}
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

            widget.reloadFeatures(layer, _.union(newUniqueFeatures, visibleFeatures));
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

            layer.removeAllFeatures();
            layer.addFeatures(features);

            // Add layer to feature
            _.each(features, function(feature) {
                feature.layer = layer;
            });

            layer.redraw();

            tableApi.clear();
            tableApi.rows.add(features);
            tableApi.draw();
        },

        /**
         * Digitizer API connection query
         *
         * @param uri suffix
         * @param request query
         * @return xhr jQuery XHR object
         * @version 0.2
         */
        query: function(uri, request) {
            var widget = this;
            return $.ajax({
                url:         widget.elementUrl + uri,
                type:        'POST',
                contentType: "application/json; charset=utf-8",
                dataType:    "json",
                data:        JSON.stringify(request)
            }).error(function(xhr) {
                var errorMessage = translate('api.query.error-message');
                $.notify(errorMessage + JSON.stringify(xhr.responseText));
                console.log(errorMessage, xhr);
            });
        }
    });

})(jQuery);
