(function ($) {
    'use strict';

    window.Mapbender = window.Mapbender || {};
    window.Mapbender.Digitizer = window.Mapbender.Digitizer || {};

    /**
     * User Style Manager - manages saved user styles for the digitizer.
     */
    Mapbender.Digitizer.UserStyleManager = function(digitizer) {
        this.digitizer = digitizer;
        this.elementUrl = digitizer.elementUrl;
        this.cachedStyles = null;
        this._selectorTemplateCache = null;
    };

    Object.assign(Mapbender.Digitizer.UserStyleManager.prototype, {

        loadStyles: function() {
            var self = this;
            return $.ajax({
                url: this.elementUrl + 'user-styles/list',
                method: 'GET',
                dataType: 'json'
            }).then(function(styles) {
                self.cachedStyles = styles;
                return styles;
            });
        },

        saveStyle: function(name, styleConfig, id) {
            var self = this;
            return $.ajax({
                url: this.elementUrl + 'user-styles/save',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ id: id || null, name: name, styleConfig: styleConfig })
            }).then(function(result) {
                self.cachedStyles = null;
                return result;
            });
        },

        deleteStyle: function(id) {
            var self = this;
            return $.ajax({
                url: this.elementUrl + 'user-styles/delete',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ id: id })
            }).then(function(result) {
                self.cachedStyles = null;
                return result;
            });
        },

        openStyleSelector: function() {
            var self = this;
            var deferred = $.Deferred();
            $.when(
                this._loadSelectorTemplate(),
                this.loadStyles()
            ).then(function(templateHtml, styles) {
                self._showSelectorPopup(templateHtml, styles, deferred);
            }).fail(function() {
                $.notify(Mapbender.trans('mb.digitizer.userStyle.loadError'), 'error');
                deferred.reject();
            });
            return deferred.promise();
        },

        _loadSelectorTemplate: function() {
            if (this._selectorTemplateCache) {
                return $.Deferred().resolve(this._selectorTemplateCache).promise();
            }
            var self = this;
            return $.ajax({
                url: this.elementUrl + 'user-styles/selector',
                dataType: 'html'
            }).then(function(html) {
                self._selectorTemplateCache = html;
                return html;
            });
        },

        promptSaveStyle: function(styleConfig) {
            var self = this;
            var deferred = $.Deferred();
            var $content = $('<div class="user-style-save-form">' +
                '<div class="mb-3">' +
                '<label class="form-label fw-bold">' + Mapbender.trans('mb.digitizer.userStyle.name') + '</label>' +
                '<input type="text" name="styleName" class="form-control" placeholder="' + Mapbender.trans('mb.digitizer.userStyle.namePlaceholder') + '">' +
                '</div>' +
                '</div>');
            var popup = new Mapbender.Popup({
                title: Mapbender.trans('mb.digitizer.userStyle.saveTitle'),
                modal: true,
                content: $content,
                width: 400,
                buttons: [{
                    label: Mapbender.trans('mb.actions.cancel'),
                    cssClass: 'btn btn-sm btn-light popupClose'
                }, {
                    label: Mapbender.trans('mb.digitizer.userStyle.save'),
                    cssClass: 'btn btn-sm btn-primary',
                    callback: function() {
                        var name = $content.find('[name="styleName"]').val().trim();
                        if (!name) {
                            $.notify(Mapbender.trans('mb.digitizer.userStyle.nameRequired'), 'warn');
                            return;
                        }
                        self.saveStyle(name, styleConfig).then(function(result) {
                            $.notify(Mapbender.trans('mb.digitizer.userStyle.saved'), 'success');
                            deferred.resolve(result);
                            popup.close();
                        }).fail(function() {
                            $.notify(Mapbender.trans('mb.digitizer.userStyle.saveError'), 'error');
                        });
                    }
                }]
            });
            popup.$element.on('close', function() { deferred.reject(); });
            return deferred.promise();
        },

        _showSelectorPopup: function(templateHtml, styles, deferred) {
            var self = this;
            var $content = $(templateHtml);
            var $listContainer = $content.find('.style-list-container');
            var $searchName = $content.find('.-fn-search-name');
            var $searchColor = $content.find('.-fn-search-color');
            var $clearColor = $content.find('.-fn-clear-color');
            var $filterMyStyles = $content.find('.-fn-filter-my-styles');
            var selectedColor = '';
            var $colorPicker = $content.find('.-js-color-search');

            setTimeout(function() {
                $colorPicker.colorpicker({ format: 'hex' }).on('changeColor', function(e) {
                    selectedColor = e.color ? e.color.toHex() : '';
                    filterStyles();
                });
            }, 100);

            $clearColor.on('click', function() {
                selectedColor = '';
                $searchColor.val('');
                $colorPicker.colorpicker('setValue', '');
                filterStyles();
            });

            function filterStyles() {
                var nameFilter = $searchName.val().toLowerCase().trim();
                var colorFilter = selectedColor.toLowerCase();
                var myStylesOnly = $filterMyStyles.is(':checked');
                $listContainer.find('.list-group-item').each(function() {
                    var $item = $(this);
                    var style = $item.data('style');
                    var name = (style.name || '').toLowerCase();
                    var config = style.style_config || {};
                    var userMatch = !myStylesOnly || style.canDelete;
                    var nameMatch = !nameFilter || name.indexOf(nameFilter) !== -1;
                    var colorMatch = true;
                    if (colorFilter) {
                        colorMatch = self._isColorSimilar(colorFilter, [
                            (config.fillColor || '').toLowerCase(),
                            (config.strokeColor || '').toLowerCase(),
                            (config.fontColor || '').toLowerCase()
                        ]);
                    }
                    $item.toggle(userMatch && nameMatch && colorMatch);
                });
            }

            $searchName.on('input', filterStyles);
            $filterMyStyles.on('change', filterStyles);

            if (styles.length === 0) {
                $listContainer.html('<p class="text-muted">' + Mapbender.trans('mb.digitizer.userStyle.noStyles') + '</p>');
            } else {
                var $list = $('<ul class="list-group style-list"></ul>');
                styles.forEach(function(style) {
                    var deleteButton = style.canDelete
                        ? '<button type="button" class="btn btn-outline-danger btn-sm -fn-delete" title="' + Mapbender.trans('mb.digitizer.userStyle.delete') + '"><i class="fa fa-trash"></i></button>'
                        : '';
                    var $item = $('<li class="list-group-item">' +
                        '<div class="style-item-header d-flex justify-content-between align-items-center">' +
                        '<span class="style-name fw-bold">' + self._escapeHtml(style.name) + '</span>' +
                        '<div class="btn-group btn-group-sm">' +
                        '<button type="button" class="btn btn-outline-primary btn-sm -fn-apply" title="' + Mapbender.trans('mb.digitizer.userStyle.apply') + '"><i class="fa fa-check"></i></button>' +
                        deleteButton +
                        '</div></div>' +
                        '<div class="style-preview-row">' +
                        '<canvas class="style-preview-mini" data-type="polygon" width="60" height="40"></canvas>' +
                        '<canvas class="style-preview-mini" data-type="line" width="60" height="40"></canvas>' +
                        '<canvas class="style-preview-mini" data-type="point" width="60" height="40"></canvas>' +
                        '<canvas class="style-preview-mini" data-type="label" width="60" height="40"></canvas>' +
                        '</div></li>');
                    $item.data('style', style);
                    $list.append($item);
                    setTimeout(function() { self._renderStylePreviews($item, style.style_config); }, 0);
                });
                $listContainer.append($list);
            }

            var popup = new Mapbender.Popup({
                title: Mapbender.trans('mb.digitizer.userStyle.selectTitle'),
                modal: true,
                content: $content,
                width: 500,
                cssClass: 'user-style-selector-popup',
                buttons: [{ label: Mapbender.trans('mb.actions.close'), cssClass: 'btn btn-sm btn-light popupClose' }]
            });

            $content.on('click', '.-fn-apply', function() {
                var style = $(this).closest('li').data('style');
                deferred.resolve(style.style_config, style.name);
                popup.close();
            });

            $content.on('click', '.-fn-delete', function() {
                var $item = $(this).closest('li');
                var style = $item.data('style');
                if (confirm(Mapbender.trans('mb.digitizer.userStyle.confirmDelete'))) {
                    self.deleteStyle(style.id).then(function() {
                        $item.fadeOut(function() { $item.remove(); });
                        $.notify(Mapbender.trans('mb.digitizer.userStyle.deleted'), 'success');
                    }).fail(function() {
                        $.notify(Mapbender.trans('mb.digitizer.userStyle.deleteError'), 'error');
                    });
                }
            });

            popup.$element.on('close', function() { deferred.reject(); });
        },

        _renderStylePreviews: function($item, styleConfig) {
            var self = this;
            $item.find('.style-preview-mini').each(function() {
                self._drawPreview(this, $(this).data('type'), styleConfig);
            });
        },

        _drawPreview: function(canvas, type, style) {
            var ctx = canvas.getContext('2d');
            var w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            var fillColor = style.fillColor || '#ff0000';
            var fillOpacity = parseFloat(style.fillOpacity) || 1;
            var strokeColor = style.strokeColor || '#ffffff';
            var strokeOpacity = parseFloat(style.strokeOpacity) || 1;
            var strokeWidth = parseFloat(style.strokeWidth) || 1;
            var pointRadius = parseFloat(style.pointRadius) || 5;
            var dashStyle = style.strokeDashstyle || 'solid';
            var dashMap = { dash: [6,3], dot: [2,3], dashdot: [6,3,2,3], longdash: [10,3], longdashdot: [10,3,2,3] };

            ctx.setLineDash(dashMap[dashStyle] || []);
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

            if (type === 'polygon') {
                ctx.beginPath();
                var size = Math.min(w, h) * 0.35;
                for (var i = 0; i < 5; i++) {
                    var a = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    i === 0 ? ctx.moveTo(cx + size * Math.cos(a), cy + size * Math.sin(a))
                            : ctx.lineTo(cx + size * Math.cos(a), cy + size * Math.sin(a));
                }
                ctx.closePath();
                ctx.fill();
                if (strokeWidth > 0) ctx.stroke();
            } else if (type === 'line') {
                ctx.beginPath();
                ctx.moveTo(5, cy + 5); ctx.lineTo(15, cy - 5); ctx.lineTo(30, cy + 5);
                ctx.lineTo(45, cy - 5); ctx.lineTo(55, cy);
                ctx.stroke();
            } else if (type === 'point') {
                ctx.beginPath();
                ctx.arc(cx, cy, Math.min(Math.max(pointRadius, 4), 12), 0, 2 * Math.PI);
                ctx.fill();
                if (strokeWidth > 0) ctx.stroke();
            } else if (type === 'label') {
                var fontColor = style.fontColor || '#000000';
                var fontOpacity = parseFloat(style.fontOpacity) || 1;
                var fontSize = Math.min(parseInt(style.fontSize) || 11, 14);
                var fontFamily = (style.fontFamily || 'Arial, sans-serif').split(',')[0].trim();
                var fw = style.fontWeight || 'regular';
                var fs = (fw === 'bold' ? 'bold ' : (fw === 'italic' ? 'italic ' : ''));
                ctx.font = fs + fontSize + 'px ' + fontFamily;
                ctx.fillStyle = hexToRgba(fontColor, fontOpacity);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Abc', cx, cy);
            }
        },

        _isColorSimilar: function(searchColor, colors) {
            function hexToRgb(hex) {
                var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
            }
            var s = hexToRgb(searchColor);
            if (!s) return true;
            for (var i = 0; i < colors.length; i++) {
                var c = hexToRgb(colors[i]);
                if (c) {
                    var d = Math.sqrt(Math.pow(s.r-c.r,2) + Math.pow(s.g-c.g,2) + Math.pow(s.b-c.b,2));
                    if (d < 100) return true;
                }
            }
            return false;
        },

        _escapeHtml: function(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    });

})(jQuery);
