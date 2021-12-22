(function ($) {
    "use strict";

    Mapbender.Digitizer = Mapbender.Digitizer || {};

    $.fn.dataTable.ext.errMode = 'throw';


    $.widget("mapbender.mbDigitizer", {

        options: {
            classes: {},
            create: null,
            debug: false,
            // disabled: false,
            fileURI: "uploads/featureTypes",
            schemes: {},
        },
        schemes: null,
        map: null,

        styles: {
            'default': {
                strokeWidth: 1,
                strokeColor: '#6fb536',
                fillColor: "#6fb536",
                fillOpacity: 0.3
                //, label: '${label}'
            },
            'select': {
                strokeWidth: 3,
                fillColor: "#F7F79A",
                strokeColor: '#6fb536',
                fillOpacity: 0.5,
                graphicZIndex: 15
            },
            'copy': {
                strokeWidth: 5,
                fillColor: "#f7ef7e",
                strokeColor: '#4250b5',
                fillOpacity: 0.7,
                graphicZIndex: 1000
            },
            'unsaved': {
                strokeWidth: 3,
                fillColor: "#FFD14F",
                strokeColor: '#F5663C',
                fillOpacity: 0.5
            },
            'invisible': {
                display: 'none'
            }
        },

        initialScheme: null,

        printClient: null,

        useAllScheme: false,

        displayOnInactive: false,

        disabled: true,

        isFullyActive: true,

        _create: function () {

            var widget = this.widget = this;
            var element = widget.element;

            widget.id = element.attr("id");

            if (typeof widget.options.useAllScheme !== "undefined") {
                widget.useAllScheme = widget.options.useAllScheme;
            }


            widget.displayOnInactive = widget.options.displayOnInactive;

            var qe = new Mapbender.Digitizer.QueryEngine(widget);
            widget.query = qe.query;
            widget.getElementURL = qe.getElementURL;

            var createSpinner = function () {

                widget.spinner = new function () {
                    var spinner = this;

                    spinner.openRequests = 0;

                    var $parent = $('#' + widget.id).parents('.container-accordion').prev();
                    this.$element = $('<span class="fa fas fa-spin fa-spinner pull-right" style="display:none;">');
                    $parent.prepend(this.$element);

                    spinner.addRequest = function () {
                        spinner.openRequests++;
                        if (spinner.openRequests >= 1) {
                            spinner.$element.show();
                        }
                    };

                    spinner.removeRequest = function () {
                        spinner.openRequests--;
                        if (spinner.openRequests === 0) {
                            spinner.$element.hide();
                        }
                    };


                };
            };

            createSpinner();


            Mapbender.elementRegistry.waitReady('.mb-element-map').then(function(mbMap) {
                widget.map = mbMap.map.olMap;
                widget.setup();
            }, function() {
                Mapbender.checkTarget('mbDigitizer');
            });

            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
                widget.printClient = printClient;
                $.extend(widget.printClient, Mapbender.Digitizer.printPlugin);
            });
        },


        setup: function () {
            var widget = this;
            var element = $(widget.element);
            var options = widget.options;



            widget.selector = $("select.selector", element);

            widget.selector.getSelectedSchema = function() {
                var selector = this;
                var option = selector.find(":selected");
                return option.data("schemaSettings");
            };

            widget.selector.appendSchema = function(schema,prepend) {
                var selector = this;
                var option = $("<option/>");
                option.val(schema.schemaName).html(schema.label);
                option.data("schemaSettings", schema);
                prepend ? selector.prepend(option) : selector.append(option);
            };

            widget.selector.on('change', function () {
                var schema = widget.getCurrentSchema();
                if (widget.currentSchema_ && widget.currentSchema_ !== schema) {
                    widget.deactivateSchema(widget.currentSchema_);
                }
                widget.currentSchema_ = schema;
                widget.activateSchema(schema);
            });

            var initializeSelectorOrTitleElement = function () {

                var options = widget.options;
                var element = $(widget.element);
                var titleElement = $("> div.title", element);


                widget.hasOnlyOneScheme = _.size(options.schemes) === 1;

                if (widget.hasOnlyOneScheme) {
                    titleElement.html(_.toArray(options.schemes)[0].label);
                    widget.selector.hide();
                } else {
                    titleElement.hide();
                }
            };

            var usesAllScheme = function () {
                return !widget.hasOnlyOneScheme && widget.useAllScheme;
            };

            // TODO this is not the proper implementation - fix that
            var isOpenByDefault = function () {
                var sidePane = $(widget.element).closest(".sidePane");

                var accordion = $(".accordionContainer", sidePane);
                return accordion.length === 0;
            };

            var createSchemes = function () {


                var rawSchemes = widget.options.schemes;
                widget.schemes = {};
                var index = 0;
                _.each(rawSchemes, function (rawScheme, schemaName) {
                    rawScheme.schemaName = schemaName;
                    widget.schemes[schemaName] = new Mapbender.Digitizer.Scheme(rawScheme, widget);
                    if (!widget.schemes[schemaName].disableAggregation) {
                        widget.selector.appendSchema(widget.schemes[schemaName])
                    }
                });


                var basicScheme = Object.keys(widget.schemes)[0];


                if (usesAllScheme()) {
                    widget.schemes['all'] = new Mapbender.Digitizer.AllScheme({
                        label: Mapbender.trans('mb.digitizer.schema.allgeometries'),
                        schemaName: 'all'
                    }, widget, index++);
                    widget.selector.appendSchema(widget.schemes['all'],true);
                    basicScheme = 'all';
                }

                widget.selector.val(basicScheme);

                widget.initialScheme = widget.schemes[basicScheme];

                if (isOpenByDefault() && !widget.isFullyActive) {
                    widget.activate();
                }


            };

            var createMapContextMenu = function () {
                var map = widget.map;


                var options = {
                    selector: 'div',
                    events: {
                        show: function (options) {
                            return widget.isFullyActive && widget.getCurrentSchema().mapContextMenu.allowUseContextMenu(options);
                        }
                    },
                    build: function (trigger, e) {
                        return widget.isFullyActive && widget.getCurrentSchema().mapContextMenu.buildContextMenu(trigger, e);
                    }
                };

                $(map.div).contextMenu(options);

            };

            initializeSelectorOrTitleElement();

            createSchemes();

            createMapContextMenu();

            widget.registerMapEvents();

            widget._trigger('ready');

            if (widget.displayOnInactive) {
                widget.activate();
                widget.isFullyActive = false;
            }

        },

        disable: function () {
            var widget = this;
            widget.disabled = true;
        },

        enable: function () {
            var widget = this;
            widget.disabled = false;
        },

        isEnabled: function () {
            var widget = this;
            return !widget.disabled;
        },


        registerMapEvents: function () {
            var widget = this;
            var map = widget.map;

            map.events.register("moveend", this, function () {
                var schema = widget.isEnabled() && widget.getCurrentSchema();
                if (schema && schema.currentExtentSearch) {
                    widget.reloadData(schema);
                }
            });

            map.events.register("mouseover", this, function () {
                widget.isEnabled() && widget.getCurrentSchema().mapContextMenu.enable();
            });

            map.events.register("mouseout", this, function () {
                widget.isEnabled() && widget.getCurrentSchema().mapContextMenu.disable();
            });
            map.resetLayersZIndex();
        },

        getBasicSchemes: function () {
            var widget = this;

            return _.pick(widget.schemes, function (schema, key) {
                return key !== "all";
            });
        },


        getSchemaByName: function (schemaName) {
            var widget = this;
            var scheme = widget.getBasicSchemes()[schemaName];
            if (!scheme) {
                throw new Error("No Basic Scheme exists with the name " + schemaName);
            }
            return scheme;
        },

        getCurrentSchema: function() {
            var selectedData = $('option:selected', $('select.selector', this.element)).data();
            return selectedData && selectedData.schemaSettings || this.initialSchema;
        },

        activate: function () {
            var widget = this;
            widget.enable();
            widget.isFullyActive = true;
            this.currentSchema_ = this.getCurrentSchema();
            this.activateSchema(this.currentSchema_);
        },

        deactivate: function () {
            this.disable();
            this.isFullyActive = false;
            var schema = this.getCurrentSchema();
            this.deactivateSchema(schema);
            if (schema.layer && !this.displayOnInactive) {
                schema.layer.setVisibility(false);
            }
        },
        deactivateSchema: function(schema) {
            if (this.currentPopup) {
                this.currentPopup.popupDialog('close');
                this.currentPopup = null;
            }

            if (schema.layer && !schema.displayPermanent) {
                schema.layer.setVisibility(false);
            }
            schema.selectControl.deactivate();
            schema.menu.frame.hide();
            schema.menu.deactivateControls();
        },
        // Sidepane integration api
        hide: function() {
            this.deactivate();
        },
        reveal: function() {
            this.activate();
        },
        dropFeature: function(feature) {
            var schemas = [this.getCurrentSchema()];
            if (feature.attributes.schemaName) {
                schemas.push(this.getSchemaByName(feature.attributes.schemaName));
            }
            if (this.schemes['all']) {
                schemas.push(this.schemes['all']);
            }
            for (var i = 0; i < schemas.length; ++i) {
                var schema = schemas[i];
                if (feature && schema.layer.features.indexOf(feature) !== -1) {
                    schema.layer.removeFeatures([feature]);
                }
                schema.menu.removeTableRow(feature);
            }
        },
        deleteFeature: function(feature) {
            if (feature.isNew || feature.isCopy) {
                this.dropFeature(feature);
            } else {
                var self = this;
                Mapbender.confirmDialog({
                    html: Mapbender.trans('mb.digitizer.feature.remove.from.database'),
                    onSuccess: function () {
                        self.query('delete', {
                            schema: feature.attributes.schemaName,
                            feature: feature.attributes
                        }).done(function() {
                            self.dropFeature(feature);
                            $.notify(Mapbender.trans('mb.digitizer.feature.remove.successfully'), 'info');
                        });
                    }
                });
            }
        },
        onFeatureAdded: function(schema, feature) {
            var schemaReal = schema.getSchemaByFeature(feature);
            schemaReal.introduceFeature(feature);
            schemaReal.setModifiedState(feature, true);
            if (schemaReal.openFormAfterEdit) {
                schemaReal.openFeatureEditDialog(feature);
            }
        },
        onFeatureModified: function(schema, feature, options) {
            schema.setModifiedState(feature, true, (options || {}).control || null);
            var schemaReal = schema.getSchemaByFeature(feature);
            if (schemaReal.openFormAfterModification) {
                schema.openFeatureEditDialog(feature);
            }
        },
        onMapFeatureClick: function(schema, feature) {
            if (schema.allowEditData || schema.allowOpenEditDialog) {
                schema.openFeatureEditDialog(feature);
            }
        },
        saveStyle: function(feature, styleData) {
            feature.__custom_style__ = styleData || null;
            var currentSchema = this.getCurrentSchema();
            if (-1 !== currentSchema.layer.features.indexOf(feature)) {
                this.redrawFeature(feature, false);
            }
            this.customStyles = this.customStyles || {};
            if (feature.fid) {
                this.customStyles[feature.fid] = styleData;
                this.query('style/save', {
                    schemaName: currentSchema.getSchemaByFeature(feature).schemaName,
                    style: styleData,
                    featureId: feature.fid
                });
            }
        },
        activateSchema: function(schema) {
            var self = this;
            this.reloadData(schema).then(function() {
                schema.menu.frame.show();
                schema.layer.setVisibility(true);
                if (self.isFullyActive) {
                    schema.selectControl.activate();
                }
            });
        },
        redrawLayer: function(layer) {
            for (var i = 0; i < layer.features.length; ++i) {
                this.redrawFeature(layer.features[i], false);
            }
        },
        redrawFeature: function(feature, highlight) {
            var renderIntent =
                (highlight && 'select')
                || (!feature.visible && 'invisible')
                || ((feature.isChanged || feature.isNew) && 'unsaved')
                || (feature.isCopy && 'copy')
                || 'default'
            ;
            feature.style = null;
            feature.renderIntent = renderIntent;
            if (feature.layer) {
                if (renderIntent === 'default' && feature.__custom_style__) {
                    feature.style = feature.layer.styleMap.styles.default.createLiterals(feature.__custom_style__, feature);
                    feature.layer.drawFeature(feature, feature.style);
                } else {
                    feature.layer.drawFeature(feature);
                }
            }
        },
        loadCustomStyles: function() {
            var schemaNames = Object.values(this.getBasicSchemes()).filter(function(schema) {
                return schema.allowCustomStyle;
            }).map(function(schema) {
                return schema.schemaName;
            });
            if (this.customStyles && !this.stylePromise_) {
                var deferred = $.Deferred();
                deferred.resolveWith(null, [this.customStyles || {}]);
                return deferred.promise();
            } else {
                var self = this;
                this.stylePromise_ = this.stylePromise_ || this.query('style/list', {
                    schemaName: schemaNames
                }).then(function(response) {
                    self.customStyles = self.customStyles || {};
                    Object.assign(self.customStyles, response.featureStyles || {});
                    return self.customStyles;
                });
                return this.stylePromise_;
            }
        },
        reloadData: function(schema, options) {
            var self = this;
            schema.lastRequest = null;

            var selectParams = schema.createRequest();
            if (schema.selectXHR && schema.selectXHR.abort) {
                schema.selectXHR.abort();
                schema.selectXHR = null;
            }
            var selectPromise = this.query('select', selectParams);
            return $.when(selectPromise, this.loadCustomStyles()).then(function(featureSelectArgs, styleData) {
                var selectData = featureSelectArgs[0];
                schema.selectXHR = null;
                var newFeatures = self.parseFeatures_(selectData, styleData);
                schema.onFeatureCollectionLoaded(newFeatures, options || {});
                return newFeatures;
            });
        },
        getInitialStyleConfig: function(schema, feature) {
            return Object.assign({}, schema.styles.default, feature.__custom_style__ || {});
        },
        getStyleEditorOptions: function(schema, feature) {
            return {
                data: this.getInitialStyleConfig(schema, feature)
            };
        },
        editStyle: function(feature) {
            var schema = this.getCurrentSchema().getSchemaByFeature(feature);
            var editorOptions = this.getStyleEditorOptions(schema, feature);
            var _ = new Mapbender.Digitizer.FeatureStyleEditor(feature, schema, editorOptions);
        },
        parseFeatures_: function(featureDataList, styleData) {
            this.customStyles = this.customStyles || {};
            Object.assign(this.customStyles, styleData || {});
            var allCustomStyles = this.customStyles;
            return featureDataList.map(function(featureData) {
                var geometry = featureData.geometry && OpenLayers.Geometry.fromWKT(featureData.geometry) || null;
                var feature = new OpenLayers.Feature.Vector(geometry, featureData.properties);
                feature.fid = featureData.id;
                if (allCustomStyles[feature.fid]) {
                    feature.__custom_style__ = allCustomStyles[feature.fid];
                }
                return feature;
            });
        },
        getStyleConfig: function(schema, renderIntent) {
            var styleOL = OpenLayers.Feature.Vector.style[renderIntent] || OpenLayers.Feature.Vector.style['default'];
            var style = Object.assign({}, styleOL || {}, this.styles[renderIntent] || {}, schema.styles[renderIntent] || {});
            if (schema.clusteringLabel) {
                style.label = '${label}';
            }
            return style;
        },
        getStyleMatchingRules: function(schema, renderIntent) {
            var self = this;
            if (schema.isAllScheme) {
                return _.map(this.getBasicSchemes(), function(scheme) {
                    return new OpenLayers.Rule({
                        symbolizer: self.getStyleConfig(scheme, renderIntent),
                        evaluate: function (feature) {
                            return feature.attributes.schemaName === scheme.schemaName;
                        }
                    });
                });
            } else {
                return [];
            }
        },
        getStyleOptions: function(schema, renderIntent) {
            var options = {
                rules: this.getStyleMatchingRules(schema, renderIntent)
            };
            if (options.rules.length) {
                var fallbackStyle = Object.assign({},
                    OpenLayers.Feature.Vector.style["default"],
                    OpenLayers.Feature.Vector.style[renderIntent],
                    this.styles[renderIntent] || {},
                    schema.styles[renderIntent] || {}
                );
                options.rules.splice(0, 0, new OpenLayers.Rule({
                    symbolizer: fallbackStyle
                }));
            }
            return options;
        },
        createStyleMap: function(schema) {
            var self = this;
            var styles = {};
            this.getKnownRenderIntents_().forEach(function (intent) {
                var style = self.getStyleConfig(schema, intent);
                var options = self.getStyleOptions(schema, intent);
                styles[intent] = new OpenLayers.Style(style, options);
            });
            if (!schema.markUnsavedFeatures) {
                styles.unsaved = styles.default;
            }
            return new OpenLayers.StyleMap(styles, {extendDefault: true});
        },
        getKnownRenderIntents_: function() {
            return ['default', 'select', 'unsaved', 'invisible', 'copy'];
        }
    });
})(jQuery);
