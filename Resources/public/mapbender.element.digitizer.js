(function ($) {
    "use strict";

    $.fn.dataTable.ext.errMode = 'throw';

    $.widget("mapbender.mbDigitizer", $.mapbender.mbDataManager, {

        options: {
            classes: {},
            create: null,
            debug: false,
            fileURI: "uploads/featureTypes",
            schemes: {},
            target: null
        },
        mbMap: null,
        printClient: null,
        active: false,
        controlFactory: null,

        _create: function () {
            this._super();
            var widget = this;
            var target = this.options.target;
            Mapbender.elementRegistry.waitReady(target).then(function(mbMap) {
                widget.mbMap = mbMap;
                widget.setup();
                // Let data manager base method trigger "ready" event and start loading data
                widget._start();
            }, function() {
                Mapbender.checkTarget("mbDigitizer", target);
            });
        },
        _afterCreate: function() {
            // Invoked only by data manager _create
            // do nothing; deliberately do NOT call parent method
        },
        _schemaFactory: function(schemaConfig) {
            var schemaConfig_ = this._super(schemaConfig);
            if (!schemaConfig_.featureType || !schemaConfig_.featureType.connection || !schemaConfig_.featureType.table || !schemaConfig_.featureType.geomType) {
                throw new Error("Feature Type not correctly specified in Configuration of scheme")
            }
            if (schemaConfig_.popup && schemaConfig_.popup.buttons) {
                _.each(schemaConfig_.popup.buttons, function (button) {
                    console.error("Using Javascript code in the configuration is deprecated:", button);
                });
            }
            return new Mapbender.Digitizer.Scheme(schemaConfig_, this);
        },
        setup: function() {
            var self = this;
            Mapbender.elementRegistry.waitCreated('.mb-element-printclient').then(function (printClient) {
                self.printClient = printClient;
                $.extend(self.printClient, Mapbender.Digitizer.printPlugin);
            });
            this.widget = new Mapbender.Digitizer(self.element, self.options);
            this.contextMenu = this._createContextMenu(this.mbMap.model.olMap);
            this.controlFactory = new Mapbender.Digitizer.DigitizingControlFactory(this.mbMap.getModel().olMap);
            if (this.options.displayOnInactive) {
                this.activate();
            }
        },
        // reveal / hide = automatic sidepane integration API
        reveal: function() {
            this.activate();
        },
        hide: function() {
            this.deactivate();
        },
        _createContextMenu: function(olMap) {
            return new Mapbender.Digitizer.MapContextMenu(olMap, this);
        },
        _initializeEvents: function() {
            this._super();
            var self = this;
            this.element.on('click', '.-fn-toggle-tool[data-toolname]', function() {
                var $button = $(this);
                var toolName = $button.attr('data-toolname');
                var schema = $button.data('schema');
                var oldState = $button.hasClass('active');
                if (!oldState) {
                    var $activeOthers = $('.-fn-toggle-tool.active', $button.siblings()).not($button);
                    $activeOthers.each(function() {
                        var $other = $(this);
                        self._toggleDrawingTool(schema, $other.attr('data-toolname'), false);
                    });
                    $activeOthers.removeClass('active');
                }
                $button.toggleClass('active', !oldState);
                self._toggleDrawingTool(schema, toolName, true);
            });
        },
        activate: function() {
            if (!this.active) {
                this._activateSchema(this._getCurrentSchema());
                this.active = true;
            }
        },
        deactivate: function() {
            this._deactivateSchema(this._getCurrentSchema());
            this.active = false;
        },
        _activateSchema: function(schema) {
            this._super(schema);
            // HACK: externally patch renderer onto schema post-construction
            if (!schema.renderer) {
                schema.renderer = new Mapbender.Digitizer.FeatureRenderer(this.mbMap.getModel().olMap, schema);
            }
            // HACK: externally patch editor onto schema post-construction
            if (schema.allowDigitize && !schema.geometryEditor) {
                var layer = schema.renderer.getLayer();
                schema.geometryEditor = new Mapbender.Digitizer.FeatureEditor(layer, this.controlFactory);
            }

            this._toggleSchemaInteractions(schema, true);
            schema.renderer.layer.setVisible(true);
        },
        _toggleDrawingTool: function(schema, toolName, state) {
            var interaction = schema.geometryEditor.getDrawingTool(toolName, schema);
            // @todo: disable selectControl if drawing active and vice-versa
            interaction.setActive(!!state);
        },
        _deactivateSchema: function(schema) {
            this._super(schema);
            this._toggleSchemaInteractions(schema, false);
            if (!(this.options.displayOnInactive || !schema.displayPermanent)) {
                schema.renderer.layer.setVisible(false);
            }
        },
        _toggleSchemaInteractions: function(schema, state) {
            if (schema.geometryEditor) {
                schema.geometryEditor.setActive(state);
            }
            schema.renderer.highlightControl.setActive(state);
            schema.renderer.selectControl.setActive(state);
            if (state && schema.useContextMenu) {
                this.contextMenu.enable();
            } else {
                this.contextMenu.disable();
            }
        },
        _getDataStoreFromSchema: function(schema) {
            // Digitizer schema config aliases "dataStore" (upstream) as "featureType"
            return schema.featureType;
        },
        _allowDirectItemCreation: function(schema) {
            // Digitizer never allows item creation directly through a form. Creation can only happen with a drawing tool.
            // Returning constant false suppresses the data-manager upstream direct-to-form creation tool
            return false;
        },
        _updateToolset: function($container, schema) {
            this._super($container, schema);
            if (!schema.allowDigitize) {
                return;
            }
            var geomType = schema.featureType.geomType;
            var toolButtonConfigs = schema.toolset || Mapbender.Digitizer.Utilities.getDefaultToolsetByGeomType(geomType);
            for (var i = 0; i < toolButtonConfigs.length; ++i) {
                var rawButton = toolButtonConfigs[i];
                var toolName = rawButton.type;
                var toolExists = typeof (Mapbender.Digitizer.DigitizingControlFactory.prototype[toolName]) === 'function';
                if (!toolExists) {
                    console.warn("interaction " + toolName + " does not exist");
                    continue;
                }
                var iconClass = "icon-" + rawButton.type.replace(/([A-Z])+/g, '-$1').toLowerCase(); // @todo: use font awesome css
                var $icon = $(document.createElement('span')).addClass(iconClass);
                var tooltip = Mapbender.trans('mb.digitizer.toolset.' + geomType + '.' + rawButton.type);
                var $button = $(document.createElement('button'))
                    .attr({
                        type: 'button',
                        'data-toolname': toolName,
                        title: tooltip
                    })
                    .addClass('-fn-toggle-tool')
                    .addClass('btn btn-sm') // match DataManager
                    .append($icon)
                    .data({
                        schema: schema
                    })
                ;
                $container.append($button);
           }
        },
        // Support method for custom Scheme class
        getProjectionCode: function() {
            return this.mbMap.getModel().getCurrentProjectionCode();
        },
        _buildTableRowButtons: function(schema) {
            var schema_ = this.widget.createScheme_(schema);
            var menu = schema_.menu;
            return menu.generateResultDataTableButtons();
        },
        __formatting_dummy: null
    });

})(jQuery);
