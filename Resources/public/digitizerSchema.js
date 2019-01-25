Scheme = OpenLayers.Class({

    label: '',
    inlineSearch: true,
    maxResults: 500,
    abc: 'd',

    initialize: function (options) {
        this.displayClass = this.CLASS_NAME;

        OpenLayers.Util.extend(this, options);

        this.events = new OpenLayers.Events(this);
        if(this.eventListeners instanceof Object) {
            this.events.on(this.eventListeners);
        }
        if (this.id == null) {
            this.id = OpenLayers.Util.createUniqueID(this.CLASS_NAME + "_");
        }
    },

    _highlightSchemaFeature : function (feature, highlight) {
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


    _addSelectControl: function(layer) {
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
        if (typeof(selectControl.handlers) != "undefined") { // OL 2.7
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


    CLASS_NAME: "Mapbender.Digitizer.Schema"


});