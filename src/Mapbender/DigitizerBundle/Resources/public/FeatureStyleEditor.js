(function () {
    "use strict";

    /**
     * @param {*} owner jQueryUI widget
     * @param {Mapbender.DataManager.DialogFactory} dialogFactory
     */
    class FeatureStyleEditor {
        constructor(owner, dialogFactory) {
            this.owner = owner;
            this.template_ = $.get([this.owner.elementUrl, 'style-editor'].join(''));
            this.dialogFactory = dialogFactory;
        }

        openDialog_($content) {
            var promise = $.Deferred();
            var editor = this;
            var popup = this.dialogFactory.dialog($content, {
                title: "Style manager",
                width: '500px',
                resizable: true,
                cssClass: 'data-manager-edit-data digitizer-style-editor content-padding',
                position: { left: '30%', top: '20%' },
                buttons: [{
                    text: Mapbender.trans('mb.digitizer.actions.save'),
                    title: Mapbender.trans('mb.data-manager.actions.save_tooltip'),
                    class: 'btn btn-primary',
                    click: function (e) {
                        var values = editor.getFormData(popup.$element);
                        promise.resolveWith(null, [values]);
                        popup.close();
                    }
                }]
            });
            return promise;
        }

        openEditor(schema, feature, values) {
            var self = this;
            this.currentSchema = schema;
            this.currentFeature = feature;
            this.currentStyleName = values && values._savedStyleName ? values._savedStyleName : null;
            var valuesPromise = $.Deferred();
            this.template_.then(function(html) {
                var $content = $(document.createElement('div')).append(html);
                self.configureContent($content, schema, feature);
                var formData = self.extendDefaults(schema, values);
                $(':input', $content).filter('[name]').each(function() {
                    if (typeof formData[this.name] !== 'undefined' && formData[this.name] !== null) {
                        $(this).val(formData[this.name]);
                    }
                });

                if (self.currentStyleName) {
                    $('<input type="hidden" name="_savedStyleName">').val(self.currentStyleName).appendTo($content);
                }

                $('input[type="range"]', $content).each(function() {
                    var $input = $(this);
                    var $vp = $('.value-preview', $input.closest('.mb-3'));
                    var update = function($el) {
                        var value = parseFloat($input.val());
                        if (!isNaN(value)) { $vp.text(value.toFixed(2)); }
                    };
                    update($input);
                    $input.on('change', function() { update($(this)); });
                });

                self._bindUserStyleButtons($content, valuesPromise);
                self._initPreview($content, feature);
                self._bindPreviewUpdates($content);

                var dlgPromise = self.openDialog_($content);
                $('.-js-colorpicker', $content).colorpicker({format: 'hex'});
                dlgPromise.always(function() {
                    $('.-js-colorpicker', $content).colorpicker('destroy');
                });
                dlgPromise.then(function(values) {
                    valuesPromise.resolveWith(null, [values]);
                }, function() {
                    valuesPromise.rejectWith(this, arguments);
                });
            });
            return valuesPromise;
        }

        _bindUserStyleButtons($content, valuesPromise) {
            var self = this;
            var userStyleManager = this.owner.userStyleManager;
            if (!userStyleManager) return;

            var $styleNameDisplay = $content.find('.current-style-name-display');
            var $styleNameText = $styleNameDisplay.find('.style-name-text');
            var ignoreChanges = true;

            if (this.currentStyleName) {
                $styleNameText.text(Mapbender.trans('mb.digitizer.userStyle.currentStyle') + ': ' + this.currentStyleName);
                $styleNameDisplay.show();
            }

            setTimeout(function() { ignoreChanges = false; }, 500);

            $content.on('input change', ':input[name]', function() {
                if (ignoreChanges) return;
                $styleNameDisplay.fadeOut(200);
                $content.find('[name="_savedStyleName"]').val('');
            });

            $content.on('click', '.-fn-load-saved-styles', function() {
                userStyleManager.openStyleSelector().then(function(styleConfig, styleName) {
                    $(':input', $content).filter('[name]').each(function() {
                        if (typeof styleConfig[this.name] !== 'undefined' && styleConfig[this.name] !== null) {
                            $(this).val(styleConfig[this.name]);
                            if (this.type === 'range') {
                                var $vp = $('.value-preview', $(this).closest('.mb-3'));
                                var v = parseFloat($(this).val());
                                if (!isNaN(v)) $vp.text(v.toFixed(2));
                            }
                        }
                    });
                    $('.-js-colorpicker', $content).each(function() {
                        var newVal = $(this).find('input').val();
                        if (newVal) $(this).colorpicker('setValue', newVal);
                    });
                    if (styleName) {
                        var $hidden = $content.find('[name="_savedStyleName"]');
                        if (!$hidden.length) $hidden = $('<input type="hidden" name="_savedStyleName">').appendTo($content);
                        $hidden.val(styleName);
                        $styleNameText.text(Mapbender.trans('mb.digitizer.userStyle.currentStyle') + ': ' + styleName);
                        $styleNameDisplay.fadeIn(200);
                    }
                    self._updatePreview($content);
                });
            });

            $content.on('click', '.-fn-save-current-style', function() {
                userStyleManager.promptSaveStyle(self.getFormData($content)).then(function(savedStyle) {
                    var $hidden = $content.find('[name="_savedStyleName"]');
                    if (!$hidden.length) $hidden = $('<input type="hidden" name="_savedStyleName">').appendTo($content);
                    $hidden.val(savedStyle.name);
                    self.currentStyleName = savedStyle.name;
                    $styleNameText.text(Mapbender.trans('mb.digitizer.userStyle.currentStyle') + ': ' + savedStyle.name);
                    $styleNameDisplay.fadeIn(200);
                });
            });
        }

        _initPreview($content, feature) {
            var canvas = $content.find('.style-preview-canvas')[0];
            if (!canvas) return;
            this._previewCanvas = canvas;
            this._previewGeomType = feature.getGeometry().getType();
            this._precomputePreviewCoords(canvas, feature);
            this._updatePreview($content);
        }

        _precomputePreviewCoords(canvas, feature) {
            var geometry = feature.getGeometry();
            var geomType = geometry.getType();
            var padding = 15;
            var w = canvas.width, h = canvas.height;
            var coords = [];

            if (geomType === 'Point') {
                coords = [geometry.getCoordinates()];
            } else if (geomType === 'LineString') {
                coords = geometry.getCoordinates();
            } else if (geomType === 'Polygon') {
                coords = geometry.getCoordinates()[0];
            } else if (geomType === 'MultiPolygon') {
                var polys = geometry.getCoordinates();
                if (polys.length > 0 && polys[0].length > 0) coords = polys[0][0];
            } else if (geomType === 'MultiLineString') {
                var lines = geometry.getCoordinates();
                if (lines.length > 0) coords = lines[0];
            }

            if (!coords.length) { this._previewCoords = []; return; }

            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            coords.forEach(function(c) {
                minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]);
                maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]);
            });

            var gW = maxX - minX || 1, gH = maxY - minY || 1;
            var scale = Math.min((w - 2 * padding) / gW, (h - 2 * padding) / gH);
            var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
            var canvasCx = w / 2, canvasCy = h / 2;

            this._previewCoords = coords.map(function(c) {
                return [canvasCx + (c[0] - cx) * scale, canvasCy - (c[1] - cy) * scale];
            });
        }

        _bindPreviewUpdates($content) {
            var self = this;
            $content.on('input change', ':input[name]', function() { self._updatePreview($content); });
            $content.on('changeColor', '.-js-colorpicker', function() { self._updatePreview($content); });
        }

        _updatePreview($content) {
            var canvas = this._previewCanvas;
            if (!canvas) return;

            var ctx = canvas.getContext('2d');
            var w = canvas.width, h = canvas.height;
            var coords = this._previewCoords || [];

            var style = {};
            $(':input', $content).filter('[name]').each(function() { style[this.name] = $(this).val(); });

            ctx.clearRect(0, 0, w, h);

            var fillColor = style.fillColor || '#ff0000';
            var fillOpacity = parseFloat(style.fillOpacity) || 1;
            var strokeColor = style.strokeColor || '#ffffff';
            var strokeOpacity = parseFloat(style.strokeOpacity) || 1;
            var strokeWidth = parseFloat(style.strokeWidth) || 1;
            var pointRadius = parseFloat(style.pointRadius) || 5;
            var dashMap = { dash:[8,4], dot:[2,4], dashdot:[8,4,2,4], longdash:[12,4], longdashdot:[12,4,2,4] };

            ctx.setLineDash(dashMap[style.strokeDashstyle] || []);
            ctx.lineCap = style.strokeLinecap || 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = strokeWidth;

            function hexToRgba(hex, opacity) {
                var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return r ? 'rgba(' + parseInt(r[1],16) + ',' + parseInt(r[2],16) + ',' + parseInt(r[3],16) + ',' + opacity + ')' : hex;
            }

            ctx.fillStyle = hexToRgba(fillColor, fillOpacity);
            ctx.strokeStyle = hexToRgba(strokeColor, strokeOpacity);

            var cx = w / 2, cy = h / 2;
            var geomType = this._previewGeomType;

            if (geomType === 'Point') {
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(pointRadius, 3), 0, 2 * Math.PI);
                ctx.fill();
                if (strokeWidth > 0) ctx.stroke();
            } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                if (coords.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(coords[0][0], coords[0][1]);
                    for (var i = 1; i < coords.length; i++) ctx.lineTo(coords[i][0], coords[i][1]);
                    ctx.stroke();
                }
            } else {
                if (coords.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(coords[0][0], coords[0][1]);
                    for (var j = 1; j < coords.length; j++) ctx.lineTo(coords[j][0], coords[j][1]);
                    ctx.closePath();
                    ctx.fill();
                    if (strokeWidth > 0) ctx.stroke();
                }
            }
        }

        configureContent($content, schema, feature) {
            var geomType = feature.getGeometry().getType();
            if (geomType !== 'Point') {
                $('[data-style-group="point"]', $content).hide();
            }
            if (geomType === "LineString") {
                $('[data-style-group="fill"]', $content).hide();
            }
        }

        getFormData($scope) {
            var data = {};
            $(':input', $scope).filter('[name]').each(function() {
                data[this.name] = $(this).val();
            });
            return data;
        }

        extendDefaults(schema, values) {
            var defaults = this.getDefaults(schema);
            var merged = Object.assign({}, defaults, values);
            // Fix empty values that cannot be allowed (breaks colorpickers
            // and rendering)
            ['fillColor', 'strokeColor', 'fontColor'].forEach(function(nonEmpty) {
                if (!merged[nonEmpty]) {
                    merged[nonEmpty] = defaults[nonEmpty];
                }
            });
            return merged;
        }

        getDefaults(schema) {
            return {
                fillColor: '#ff0000',
                fillOpacity: 1.0,
                pointRadius: 5,
                strokeColor: '#ffffff',
                strokeOpacity: 1.0,
                strokeWidth: 1,
                strokeLinecap: 'round',
                strokeDashstyle: 'solid',
                label: null,
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: 11,
                fontWeight: 'regular',
                fontColor: '#000000',
                fontOpacity: 1.0
            };
        }
    }

    Mapbender.Digitizer.FeatureStyleEditor = FeatureStyleEditor;
})();


