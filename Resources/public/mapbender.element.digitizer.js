(function($) {

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
     * Regular Expression to get checked if string should be translated
     *
     * @type {RegExp}
     */
    var translationReg = /^trans:\w+\.(\w|-|\.{1}\w+)+\w+$/;

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
     * Check and replace values recursive if they should be translated.
     * For checking used "translationReg" variable
     *
     *
     * @param items
     */
    function eachItem(items, callback) {
        var isArray = items instanceof Array;
        if(isArray) {
            for (var k in items) {
                eachItem(items[k], callback);
            }
        } else {
            if(typeof items["type"] !== 'undefined'){
                callback(items);
            }
            if(typeof items["children"] !== 'undefined') {
                eachItem(items["children"], callback);
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
            maxResults: 1000,
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
        styles: {
            'default': {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor:   "#6fb536",
                fillOpacity: 0.3
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
        _create:                function() {
            var widget = this;
            this.widget = this;
            if(!Mapbender.checkTarget("mbDigitizer", widget.options.target)){
                return;
            }
            var element = widget.element;
            widget.elementUrl = Mapbender.configuration.application.urls.element + '/' + element.attr('id') + '/';
            Mapbender.elementRegistry.onElementReady(widget.options.target, $.proxy(widget._setup, widget));
        },

        /**
         * Find feature schema by feature data
         *
         * @param feature
         * @returns {*}
         */
        findFeatureSchema: function(feature){
            var widget = this;
            var schema = null;
            var options = widget.options;

            // find schema by feature
            $.each(options.schemes, function(k, _schema) {
                $.each(_schema.features, function(i, featureCollection) {
                    $.each(featureCollection, function(i, _feature) {
                        if(_feature == feature) {
                            schema = _schema;
                            return false;
                        }
                    });
                    if(schema){
                        return false;
                    }
                });
                if(schema){
                    return false;
                }
            });
            return schema;
        },

        /**
         * Remove feature
         *
         * @param feature
         * @returns {*}
         */
        removeFeature: function(feature) {
            var widget = this;
            var olFeature = null;
            var schema = widget.findFeatureSchema(feature);
            var layer = schema.layer;
            var tableApi = schema.table.resultTable('getApi');
            var row = tableApi.row(schema.table.resultTable("getDomRowByData", feature));

            if(!schema) {
                $.notify("Feature remove failed.", "error");
                return;
            }

            function _removeFeatureFromUI() {
                // remove from map
                olFeature.layer.removeFeatures(olFeature);

                // remove from table
                row.remove().draw();

                widget._trigger('featureRemoved', null, {
                    feature:   feature,
                    schema:    schema,
                    olFeature: olFeature
                });
            }

            if(feature.hasOwnProperty('isNew')) {
                olFeature = layer.getFeatureById(feature.id);
                _removeFeatureFromUI()
            } else {
                olFeature = layer.getFeatureByFid(feature.id);
                Mapbender.confirmDialog({
                    html:      translate("feature.remove.from.database"),
                    onSuccess: function() {
                        console.log("LÖSCHT!");
                        widget.query('delete', {
                            schema:  schema.schemaName,
                            feature: feature
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
         * Create vector feature layer
         *
         * @param schema
         * @returns {OpenLayers.Layer.Vector}
         */
        createSchemaFeatureLayer: function(schema, strategies) {
            var widget = this;
            var styles = schema.styles ? schema.styles : {};
            var styleMap = new OpenLayers.StyleMap({
                'default': new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["default"], styles['default'] ? styles['default'] : widget.styles.default)),
                'select':  new OpenLayers.Style($.extend({}, OpenLayers.Feature.Vector.style["select"], styles['select'] ? styles['select'] : widget.styles.select))
            }, {extendDefault: true});

            var clusterStrategy = new OpenLayers.Strategy.Cluster({distance: 0});
            var layer = new OpenLayers.Layer.Vector(schema.label, {
                styleMap:   styleMap,
                //strategies: [clusterStrategy]
            });
            layer.name = schema.label;

            //debugger;
            //clusterStrategy.deactivate();
            //layer.refresh({force: true});
            return layer;
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

            /**
             * Set map context menu
             */

            $(map.div).contextMenu({
                selector: 'div',
                build:    function(trigger, e) {
                    var items = {};
                    var olFeatures = widget._getFeaturesFromEvent(e.clientX, e.clientY);

                    if(olFeatures.length) {
                        for (var i in olFeatures) {
                            var olFeature = olFeatures[i];
                            var layer = olFeature.layer;
                            var schema = widget.findSchemaByLayer(layer);

                            if(!schema.useContextMenu){
                                continue;
                            }

                            var subItems = {
                                zoomTo: {
                                    name:   "Zoom to",
                                    action: function(key, options, parameters) {
                                        widget.zoomToJsonFeature(widget.findFeatureByOpenLayerFeature(parameters.olFeature));
                                    }
                                }
                            };

                            if(schema.allowEditData) {
                                subItems['edit'] = {
                                    name: translate('feature.edit'),
                                    action: function(key, options, parameters) {
                                        widget._openFeatureEditDialog(parameters.olFeature);
                                    }
                                }
                            }
                            if(schema.allowDelete) {
                                subItems['remove'] = {
                                    name: translate('feature.remove'),
                                    action: function(key, options, parameters) {
                                        widget.removeFeature(widget.findFeatureByOpenLayerFeature(parameters.olFeature));
                                    }
                                }
                            }

                            items[olFeature.fid] = {
                                name:      "Feature #" + olFeature.fid,
                                olFeature: olFeature,
                                items:     subItems
                            };
                        }
                    }

                    if(!_.size(items)) {
                        items['no-items'] = {name: "Nothing selected!"}
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
                    var feature = api.row(tr).data();
                    var schema = widget.findFeatureSchema(feature);
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
                                    widget.removeFeature(feature);
                                    break;

                                case 'zoom':
                                    widget.zoomToJsonFeature(feature);
                                    break;

                                case 'edit':
                                    widget.openFeatureEditDialog(feature);
                                    break;

                                case 'exportGeoJson':
                                    widget.exportGeoJson(feature);
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
                    onClick:   function(feature, ui) {
                        widget.openFeatureEditDialog(feature);
                    }
                });

                if(schema.allowDelete) {
                    buttons.push({
                        title:     translate("feature.remove"),
                        className: 'remove',
                        cssClass:  'critical',
                        onClick:   function(feature, ui) {
                            widget.removeFeature(feature);
                        }
                    });
                }

                option.val(schemaName).html(schema.label);
                widget.map.addLayer(layer);

                var frame = schema.frame = $("<div/>").addClass('frame').data("schemaSettings", schema);
                var columns = [];
                var newFeatureDefaultProperties = {};
                if( !schema.hasOwnProperty("tableFields")){
                    console.error(translate("table.fields.not.defined"),schema );
                }

                $.each(schema.tableFields, function(fieldName, fieldSettings) {
                    newFeatureDefaultProperties[fieldName] = "";
                    fieldSettings.title = fieldSettings.label;
                    fieldSettings.data = "properties." + fieldName;
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
                }

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
                            featureadded: function(event, feature) {
                                var olFeature = event.feature;
                                var geoJSON = new OpenLayers.Format.GeoJSON();
                                var srid = olFeature.layer.map.getProjectionObject().proj.srsProjNumber;
                                var digitizerToolSetElement = $(".digitizing-tool-set", frame);
                                var properties = jQuery.extend(true, {}, newFeatureDefaultProperties); // clone from newFeatureDefaultProperties
                                var jsonGeometry;

                                eval("jsonGeometry=" + geoJSON.write(olFeature.geometry));

                                var jsonFeature = {
                                    id:         olFeature.id,
                                    isNew:      true,
                                    properties: properties,
                                    geometry:   jsonGeometry,
                                    type:       "Feature",
                                    srid:       srid
                                };
                                var tableApi = table.resultTable('getApi');
                                tableApi.rows.add([jsonFeature]);

                                tableApi.draw();

                                digitizerToolSetElement.digitizingToolSet("deactivateCurrentController");

                                if(schema.openFormAfterEdit) {
                                    widget._openFeatureEditDialog(olFeature);
                                }
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
                schema.features = {
                    loaded:   {},
                    modified: {},
                    created:  {}
                }
            });

            function deactivateFrame(settings) {
                var frame = settings.frame;
                //var tableApi = settings.table.resultTable('getApi');
                var layer = settings.layer;

                frame.css('display', 'none');

                if(!settings.displayPermanent){
                    layer.setVisibility(false);
                }

                // https://trac.wheregroup.com/cp/issues/4548
                if(widget.currentPopup){
                    widget.currentPopup.popupDialog('close');
                }

                //layer.redraw();
                //layer.removeAllFeatures();
                //tableApi.clear();
            }

            function activateFrame(settings) {
                var frame = settings.frame;
                var layer = settings.layer;

                widget.activeLayer = settings.layer;
                widget.schemaName = settings.schemaName;
                widget.currentSettings = settings;
                layer.setVisibility(true);
                //layer.redraw();
                frame.css('display', 'block');
            }

            function onSelectorChange() {
                var option = selector.find(":selected");
                var settings = option.data("schemaSettings");
                var table = settings.table;
                var tableApi = table.resultTable('getApi');


                widget._trigger("beforeChangeDigitizing", null, {next: settings, previous: widget.currentSettings});

                if(widget.currentSettings) {
                    deactivateFrame(widget.currentSettings);
                }

                activateFrame(settings);

                table.off('mouseenter', 'mouseleave', 'click');

                table.delegate("tbody > tr", 'mouseenter', function() {
                    var tr = this;
                    var row = tableApi.row(tr);
                    var jsonData = row.data();
                    if(!jsonData) {
                        return;
                    }
                    widget._highlightFeature(jsonData, true);
                });

                table.delegate("tbody > tr", 'mouseleave', function() {
                    var tr = this;
                    var row = tableApi.row(tr);
                    var jsonData = row.data();
                    if(!jsonData) {
                        return;
                    }
                    widget._highlightFeature(jsonData, false);
                });

                table.delegate("tbody > tr", 'click', function() {
                    var tr = this;
                    var row = tableApi.row(tr);
                    var jsonData = row.data();
                    if(!jsonData) {
                        return;
                    }
                    widget.zoomToJsonFeature(jsonData);
                });

                widget._getData();
            }

            selector.on('change',onSelectorChange);

            var featuresInFocus = [];
            var featureEventHandler = function(e) {

                var olFeature = e.feature.cluster ? _.last(e.feature.cluster) : e.feature;
                var layer = olFeature.layer;
                var schema = widget.findSchemaByLayer(layer);

                if(!schema) {
                    return;
                }


                var table = schema.table;
                var tableWidget = table.data('visUiJsResultTable');

                //if(layer != widget.currentSettings.layer) {
                //    return
                //}

                var jsonFeature = tableWidget.getDataById(olFeature.fid);
                var domRow = tableWidget.getDomRowByData(jsonFeature);

                if(!domRow) {
                    return;
                }

                switch (e.type){
                    case "featureover":
                        tableWidget.showByRow(domRow);
                        domRow.addClass('hover');
                        layer.drawFeature(olFeature, 'select');
                        featuresInFocus.push(e.feature) ;
                        break;
                    case "featureout":
                        domRow.removeClass('hover');
                        layer.drawFeature(olFeature, 'default');

                        featuresInFocus.splice(featuresInFocus.indexOf(e.feature), 1);
                        break;
                    case "featureclick":
                        if(_.find(map.getControlsByClass('OpenLayers.Control.ModifyFeature'), {active: true})) {
                            return;
                        }
                        widget._openFeatureEditDialog(olFeature);
                        break;

                }
            };

            map.events.register('featureover', this, featureEventHandler);
            map.events.register('featureout', this, featureEventHandler);
            map.events.register('featureclick', this, featureEventHandler);
            map.events.register("moveend", this, function() {
                widget._getData();
            });
            map.events.register("zoomend", this, function(e) {
                widget._getData();
                widget.updateClusterStrategies();
            });
            widget.map.resetLayersZIndex();
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
                        var jsonFeature = {
                            properties: formData,
                            geometry:   wkt,
                            srid: srid
                        };

                        if(olFeature.fid){
                            jsonFeature.id = olFeature.fid;
                        }

                        var errorInputs = $(".has-error", dialog);
                        var hasErrors = errorInputs.size() > 0;


                        if( !hasErrors ){
                            form.disableForm();
                            widget.query('save',{
                                schema: widget.schemaName,
                                feature: jsonFeature
                            }).done(function(response){

                                if(response.hasOwnProperty('errors')) {
                                    form.enableForm();
                                    $.each(response.errors, function(i, error) {
                                        $.notify( error.message, {
                                            title:'API Error',
                                            autoHide: false,
                                            className: 'error'
                                        });
                                        console.error(error.message);
                                    });
                                    return;
                                }

                                var hasFeatureAfterSave = response.features.length > 0;

                                if(!hasFeatureAfterSave){
                                    var origFeature = widget.findFeatureByOpenLayerFeature(olFeature);
                                    var row = tableApi.row(schema.table.resultTable("getDomRowByData", origFeature));

                                    // remove from map
                                    olFeature.layer.removeFeatures(olFeature);
                                    // remove from table
                                    row.remove().draw();

                                    widget.currentPopup.popupDialog('close');
                                    return;
                                }

                                var dbFeature = response.features[0];
                                var isNew = !olFeature.hasOwnProperty('fid');
                                var tableJson = null;

                                // search jsonData from table
                                $.each(tableApi.data(),function(i,jsonData){
                                    if(isNew){
                                        if(jsonData.id == olFeature.id){
                                            delete jsonData.isNew;
                                            tableJson = jsonData;
                                            return false
                                        }
                                    }else{
                                        if(jsonData.id == olFeature.fid){
                                            tableJson = jsonData;
                                            return false
                                        }
                                    }
                                });


                                // Merge object2 into object1
                                $.extend( tableJson, dbFeature );

                                // Redraw table fix
                                // TODO: find how to drop table cache...
                                $.each(tableApi.$("tbody > tr"), function (i, tr) {
                                    var row = tableApi.row(tr);
                                    if(row.data() == tableJson){
                                        row.data(tableJson);
                                        return false;
                                    }
                                })
                                tableApi.draw();

                                // Update open layer feature to...
                                olFeature.fid = tableJson.id;
                                olFeature.data = tableJson.properties;
                                olFeature.attributes = tableJson.properties;

                                form.enableForm();
                                widget.currentPopup.popupDialog('close');
                                $.notify(translate("feature.save.successfully"),'info');
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
                        var feature = widget.findFeatureByOpenLayerFeature(olFeature);
                        widget.removeFeature(feature);
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

            eachItem(widget.currentSettings.formItems, function(item) {
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


        _getFeaturesFromEvent: function(x, y) {
            var features = [], targets = [], layers = [];
            var layer, target, feature, i, len;
            var map = this.map;

            map.resetLayersZIndex();

            // go through all layers looking for targets
            for (i=map.layers.length-1; i>=0; --i) {
                layer = map.layers[i];
                if (layer.div.style.display !== "none") {
                    if (layer === this.activeLayer) {
                        target = document.elementFromPoint(x, y);
                        while (target && target._featureId) {
                            feature = layer.getFeatureById(target._featureId);
                            if (feature) {
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
            for (i=0, len=targets.length; i<len; ++i) {
                targets[i].style.display = "";
                targets[i].style.visibility = 'visible';
            }
            // restore layer visibility
            for (i=layers.length-1; i>=0; --i) {
                layers[i].div.style.display = "block";
            }

            map.resetLayersZIndex();
            return features;
        },

        _boundLayer: null,

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
                widget._onFeatureCollectionLoaded(featureCollection, widget.currentSettings, this);
            });
        },

        /**
         * Analyse changed bounding box geometrie and load features as FeatureCollection.
         *
         * @private
         */
        _getData: function() {
            var widget = this;
            var settings = widget.currentSettings;
            var map = widget.map;
            var projection = map.getProjectionObject();
            var extent = map.getExtent();
            var request = {
                srid:       projection.proj.srsProjNumber,
                maxResults: settings.maxResults,
                schema:     settings.schemaName
            };

            switch (settings.searchType){
                case  "currentExtent":
                    if(settings.hasOwnProperty("lastBbox")) {
                        var bbox = extent.toGeometry().getBounds();
                        var lastBbox = settings.lastBbox;

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

                        var maxResultDiff = 0;
                        for(var k in sidesChanged){
                            if( sidesChanged[k]){
                                maxResultDiff++;
                            }
                        }

                        if(maxResultDiff){
                            request.maxResults = request.maxResults / maxResultDiff;
                        }

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
                    settings.lastBbox = $.extend(true, {}, extent.toGeometry().getBounds());
                    break;

                default: // all

                    if(settings.searchType == "currentExtent") {
                        settings.allFeaturesQueued = false;
                    }

                    if(!settings.allFeaturesQueued) {
                        settings.allFeaturesQueued = true;
                        widget.query('select', request).done(function(featureCollection) {
                            widget._onFeatureCollectionLoaded(featureCollection, settings, this);
                        });
                    }
                    break;
            }
        },

        /**
         * Handle feature collection by ajax response.
         *
         * @param featureCollection FeatureCollection
         * @param schema
         * @param xhr ajax request object
         * @todo compare new, existing and loaded features
         * @private
         */
        _onFeatureCollectionLoaded: function(featureCollection, schema, xhr) {
            var widget = this;
            var tableApi = schema.table.resultTable('getApi');
            var features = schema.features;
            var geoJsonReader = new OpenLayers.Format.GeoJSON();
            var loadedFeatures = [];
            var existingFeatures = {};
            var currentExtentOnly =  schema.searchType ==  "currentExtent";

            // Break if something goes wrong
            if(!featureCollection || !featureCollection.hasOwnProperty("features")) {
                Mapbender.error(translate("features.loading.error"), featureCollection, xhr);
                return;
            }

            // get and remove invisible features
            var layer = schema.layer
            var map = layer.map;
            var extent = map.getExtent();
            var bbox = extent.toGeometry().getBounds();

            if(currentExtentOnly){
                for (var i in features.loaded) {
                    var feature = features.loaded[i];
                    existingFeatures[feature.id] = layer.getFeatureByFid(feature.id);
                }
            }

            // Filter feature loaded before
            $.each(featureCollection.features, function(i, feature) {
                if(!features.loaded.hasOwnProperty(feature.id)) {
                    features.loaded[feature.id] = feature;
                    loadedFeatures.push(feature);
                }
            });

            if(loadedFeatures.length) {
                // Replace feature collection
                featureCollection.features = loadedFeatures;

                // Add features to map
                schema.layer.addFeatures(geoJsonReader.read({
                    type:     "FeatureCollection",
                    features: loadedFeatures
                }));

                // Add features to table
                tableApi.rows.add(loadedFeatures);
                tableApi.draw();
            }

            if(currentExtentOnly) {
                var row;
                var removeFeatures = [];
                for (var fid in existingFeatures) {
                    var olFeature = existingFeatures[fid];

                    if(!olFeature){
                        // TODO: by digitizing it's find
                        continue;
                    }

                    if(!olFeature.geometry.getBounds().intersectsBounds(bbox)) {
                        var feature = features.loaded[olFeature.fid];
                        var row = tableApi.row(schema.table.resultTable("getDomRowByData", feature));
                        row.remove();//.draw();
                        removeFeatures.push(olFeature);
                        features.loaded[fid] = null;
                        delete features.loaded[fid];
                    }
                }
                if(row){
                    row.draw();
                }
                layer.removeFeatures(removeFeatures);
            }
            //console.log("removeFeatures", removeFeatures.length);
            //console.log("features.loaded", _.size(features.loaded));
            //debugger;
            if(schema.clusterStrategy && schema.clusterStrategy.active) {
                schema.clusterStrategy.deactivate();
                schema.clusterStrategy.activate();
            }
            layer.refresh({force: true});

            widget._trigger('schemaFeaturesLoaded', null, {
                schema: schema
            });

            return;
        },

        /**
         * Element controller XHR query
         *
         * @param uri
         * @param request
         * @return {*}
         */
        query: function(uri, request) {
            var widget = this;
            //request.schema = this.activeSchemaName;
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
        },

        _highlightFeature: function(jsonFeature, highlight) {
            var layer = this.activeLayer;
            var feature = jsonFeature.hasOwnProperty('isNew') ? layer.getFeatureById(jsonFeature.id) : layer.getFeatureByFid(jsonFeature.id);

            if(!feature) {
                return;
            }

            feature.renderIntent = highlight ? 'select' : 'default';
            this.activeLayer.redraw();
        },

        /**
         * Zoom to JSON feature
         *
         * @param feature
         */
        zoomToJsonFeature: function(feature) {
            var layer = this.activeLayer;
            var olMap = this.map;
            var olFeature = feature.hasOwnProperty('isNew') ? layer.getFeatureById(feature.id) : layer.getFeatureByFid(feature.id);
            var bounds = olFeature.geometry.getBounds();
            var schema = this.findFeatureSchema(feature);

            olMap.zoomToExtent(bounds);

            if(schema.hasOwnProperty('zoomScaleDenominator')){
                olMap.zoomToScale(schema.zoomScaleDenominator);
            }
        },

        /**
         * Open feature edit dialog
         *
         * @param feature
         */
        openFeatureEditDialog: function(feature) {
            var widget = this;
            var olFeature;
            if(feature.hasOwnProperty('isNew') ){
                olFeature =  layer.getFeatureById(feature.id);
            }else{
                olFeature = widget.activeLayer.getFeatureByFid(feature.id);
            }
            widget._openFeatureEditDialog(olFeature);
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
         * Find feature data by open layer feature object
         * @returns {*}
         */
        findFeatureByOpenLayerFeature: function(olFeature) {
            var widget = this;
            var feature = null;
            var data = olFeature.data;
            var isNew = !olFeature.fid;
            var schema = widget.findSchemaByLayer(olFeature.layer);


            $.each(schema.features, function(i, featureCollection) {
                if(!isNew) {
                    if(featureCollection.hasOwnProperty(olFeature.fid)) {
                        feature = featureCollection[olFeature.fid];
                        return false;
                    }
                } else {
                    $.each(featureCollection, function(k, _feature) {
                        if(_feature == data) {
                            feature = data;
                            return false;
                        }
                    });
                }
            });

            return feature;
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

            return;

            $.each(options.schemes, function(i, schema) {
                clusterSettings = null;

                $.each(schema.clustering, function(y, _clusterSettings) {
                    if(_clusterSettings.scale == scale) {
                        clusterSettings = _clusterSettings;
                        return false;
                    }

                    if(_clusterSettings.scale < scale) {
                        if(closestClusterSettings && _clusterSettings.scale > closestClusterSettings.scale) {
                            console.log("closestClusterSettings");
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
                    //debugger;
                    schema.clusterStrategy.distance = clusterSettings.distance;
                    schema.clusterStrategy.activate();
                } else {
                    schema.clusterStrategy.deactivate();
                }
                schema.layer.refresh({force: true});
                console.log(scale, clusterSettings);
            });
        },

        /**
         *
         */
        updateSchemaFeatureLayerVisibility: function(schema){

        }
    });

})(jQuery);
