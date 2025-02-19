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
            var addMove = false;
            var self = this;
            for (var s = 0; s < subSchemas.length; ++s) {
                var validNames = this.getValidToolNames(subSchemas[s]);
                var subSchemaTools = (subSchemas[s].toolset || this.getDefaultGeometryToolNames(subSchemas[s])).map(function(tc) {
                    var obj = (typeof tc === 'string') && {type: tc} || Object.assign({}, tc);
                    obj.schema = obj.schema || subSchemas[s].schemaName;
                    return obj;
                }).filter(function(toolSpec) {
                    return (!seen[toolSpec.type])
                        && self.checkToolAccess_(subSchemas[s], toolSpec.type)
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
                    .addClass('-fn-toggle-tool btn btn-outline-secondary')
                    .append($icon)
                    .data({
                        schema: btnSchema
                    });
                buttons.push($button);
            }

            if (schema.allowGeometryExport || this.owner.expandCombination(schema).some(subSchema => subSchema.allowGeometryExport)) {
                var $exportBtnIcon = $('<span>').addClass('fa fa-download');
                var $exportBtn = $('<button>')
                    .attr({
                        type: 'button',
                        title: Mapbender.trans('mb.digitizer.toolset.exportSelected')
                    })
                    .addClass('btn btn-outline-secondary -fn-export-selected')
                    .append($exportBtnIcon);
                buttons.push($exportBtn);
            }

            return buttons;
        },
        checkToolAccess_: function(schema, toolName) {
            var isModify = -1 !== ['drawDonut', 'moveFeature', 'modifyFeature'].indexOf(toolName);
            if (isModify) {
                return schema.allowEdit && schema.allowDigitize;
            } else {
                return schema.allowCreate;
            }
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

            // Add an event listener for exporting the currently selected features
            widget.element.on('click', '.-fn-export-selected', function() {
                // Get the selected features
                var exportFeatures = widget.tableRenderer.selectedFeatures || [];

                // Check if there are any features to export
                if (exportFeatures.length === 0) {
                    $.notify(Mapbender.trans('mb.digitizer.feature.export.notFound'));
                    return;
                }

                // Create a new array of features that include geometry and properties
                var strippedFeatures = exportFeatures.map(function(originalFeature) {
                    var geometryClone = originalFeature.getGeometry().clone();
                    var properties = originalFeature.get("data");
                    delete properties.geometry; // Remove the geometry property to avoid duplication
                    return new ol.Feature({
                        geometry: geometryClone,
                        ...properties // Add the properties to the new feature
                    });
                });

                var format = new ol.format.GeoJSON();
                var dataProjection = 'EPSG:4326';

                // Write features as GeoJSON, specifying only geometry
                var geojson = format.writeFeaturesObject(strippedFeatures, {
                    dataProjection: dataProjection,
                    featureProjection: widget.mbMap.getModel().olMap.getView().getProjection()
                });


                widget.createExportData(geojson);



            });

        }
    };
})(jQuery);
