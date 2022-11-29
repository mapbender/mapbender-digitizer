(function ($) {
    "use strict";
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};

    Mapbender.Digitizer.Toolset = function(owner) {
        this.owner = owner;
    };

    Mapbender.Digitizer.Toolset.prototype = {
        iconMap_: {
            drawCircle: "icon-draw-circle",
            drawDonut: "icon-draw-donut",
            drawEllipse: "icon-draw-ellipse",
            drawLine: "icon-draw-line",
            drawPoint: "icon-draw-point",
            drawPolygon: "icon-draw-polygon",
            drawRectangle: "icon-draw-rectangle",
            modifyFeature: "icon-modify-feature",
            moveFeature: "icon-move-feature"
        },
        /**
         * @param {Object} schema
         * @return {Array<String>}
         * @static
         */
        getValidToolNames: function(schema) {
            switch (schema.featureType.geomType) {
                case 'point':
                case 'multipoint':
                    return ['drawPoint', 'moveFeature'];
                case 'line':
                case 'multiline':
                    return ['drawLine', 'modifyFeature', 'moveFeature'];
                case 'polygon':
                case 'multipolygon':
                    return ['drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut', 'modifyFeature', 'moveFeature'];
                default:
                    // everything
                    return [
                        'drawPoint',
                        'drawLine',
                        'drawPolygon', 'drawRectangle', 'drawCircle', 'drawEllipse', 'drawDonut',
                        'modifyFeature', 'moveFeature'
                    ];
            }
        },
        pause: function() {
            // @todo: reintegrate with FeatureEditor :)
            $('button.-fn-toggle-tool', this.owner.element).prop('disabled', true);
        },
        resume: function() {
            // @todo: reintegrate with FeatureEditor :)
            $('button.-fn-toggle-tool', this.owner.element).prop('disabled', false);
        },
        getDefaultGeometryToolNames: function(schema) {
            return this.getValidToolNames(schema);
        },
        normalizeToolSet_: function(schema) {
            var seen = {};
            var toolSpecs = [];
            var subSchemas = this.owner.expandCombination(schema);
            var standardTools = ['modifyFeature', 'moveFeature'];
            var addModify = false;
            var addMove = false;
            for (var s = 0; s < subSchemas.length; ++s) {
                // Ignore tools if geometry editing not allowed
                if (!subSchemas[s].allowDigitize) {
                    continue;
                }
                var validNames = this.getValidToolNames(subSchemas[s]);
                // Note: Modify not allowed on single point geometries
                //       Move allowed on everything
                addModify = addModify || -1 !== validNames.indexOf('modifyFeature');
                addMove = true;
                var subSchemaTools = (subSchemas[s].toolset || this.getDefaultGeometryToolNames(schema)).map(function(tc) {
                    var obj = (typeof tc === 'string') && {type: tc} || Object.assign({}, tc);
                    obj.schema = obj.schema || subSchemas[s].schemaName;
                    return obj;
                }).filter(function(toolSpec) {
                    return (!seen[toolSpec.type])
                        && -1 === standardTools.indexOf(toolSpec.type)
                        && -1 !== validNames.indexOf(toolSpec.type)
                    ;
                });
                for (var t = 0; t < subSchemaTools.length; ++t) {
                    var toolSpec = subSchemaTools[t];
                    if (!seen[toolSpec.type]) {
                        toolSpecs.push(toolSpec);
                        seen[toolSpec.type] = true;
                    }
                }
            }
            if (addModify) {
                toolSpecs.push({type: 'modifyFeature'});
            }
            if (addMove) {
                toolSpecs.push({type: 'moveFeature'});
            }
            return toolSpecs;
        },
        renderGeometryToolButtons: function(schema) {
            var toolSpecs = this.normalizeToolSet_(schema);
            var buttons = [];
            for (var i = 0; i < toolSpecs.length; ++i) {
                var toolName = toolSpecs[i].type;
                var iconClass = this.iconMap_[toolName];
                var $icon = $(document.createElement('span')).addClass(iconClass);
                var tooltip = Mapbender.trans(toolSpecs[i].label || ('mb.digitizer.toolset.' + toolName));
                var btnSchema = this.owner.options.schemes[toolSpecs[i].schema] || schema;
                var $button = $(document.createElement('button'))
                    .attr({
                        type: 'button',
                        'data-toolname': toolName,
                        title: tooltip
                    })
                    .addClass('-fn-toggle-tool btn btn-default')
                    .append($icon)
                    .data({
                        schema: btnSchema
                    })
                ;
                buttons.push($button);
            }
            return buttons;
        },
        registerEvents: function() {
            var widget = this.owner;
            widget.element.on('click', '.-fn-visibility-all', function() {
                var state = !!$(this).attr('data-visibility');
                widget.renderer.forAllSchemaFeatures(widget._getCurrentSchema(), function (feature) {
                    if (widget.getItemSchema(feature).allowChangeVisibility) {
                        feature.set('hidden', !state);
                    }
                });
            });
        }
    };
})(jQuery);
