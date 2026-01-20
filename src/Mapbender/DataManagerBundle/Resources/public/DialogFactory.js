(function ($) {
    "use strict";
    /** @external jQuery */

    window.Mapbender = Mapbender || {};
    Mapbender.DataManager = Mapbender.DataManager || {};

    /**
     * Factory class for creating dialogs
     */
    class DialogFactory {
        /**
         * @param {String|HTMLElement|jQuery} content
         * @param {Object} [options]
         * @return {jQuery}
         * @private
         */
        baseDialog_(content, options) {
            const $content = $((typeof content === 'string') ? $.parseHTML(content) : content);
            const defaults = {
                classes: {
                    'ui-dialog': 'ui-dialog data-manager-dialog',
                    'ui-button': 'ui-button button btn'
                },
                closeText: '',
                resizable: false
            };
            const options_ = Object.assign({}, defaults, options || {}, {
                classes: Object.assign({}, defaults.classes, (options || {}).classes || {})
            });
            $content.dialog(options_);
            const $dialog = $content.closest('.ui-dialog');
            // Remove draggable + resizable containments. This cannot be controlled with dialog options :(
            const draggable = $dialog.draggable('instance');
            const resizable = $dialog.resizable('instance');
            if (draggable) {
                draggable.option('containment', false);
                // "If set to true container auto-scrolls while dragging"
                // See https://api.jqueryui.com/draggable/#option-scroll
                // Disable this. It breaks Mapbender's fixed full width / full height layout when
                // dragging dialog off a screen edge.
                draggable.option('scroll', false);
            }
            if (resizable) {
                resizable.option('containment', false);
            }

            // Hide text labels on .ui-button-icon-only, with or without jqueryui css
            $('.ui-dialog-titlebar .ui-button-icon-only', $content.closest('.ui-dialog')).each(function() {
                const $button = $(this);
                const $icon = $('.ui-button-icon', this);
                $button.empty().append($icon);
            });
            $content.on('dialogclose', function() {
                window.setTimeout(function() { if ($content.dialog('instance')) { $content.dialog('destroy');} }, 500);
            });

            Mapbender.restrictPopupPositioning($dialog);

            return $content;
        }

        /**
         * @param {String} title
         * @param {*} content
         * @return {Promise}
         */
        confirm(title, content) {
            const $content = $(document.createElement('div'))
                .append(content || null)
            ;
            const deferred = $.Deferred();
            this.baseDialog_($content, {
                title: title,
                modal: true,
                buttons:[
                    {
                         text: Mapbender.trans('mb.actions.accept'),
                         'class': 'button success btn',
                         click: function() {
                             deferred.resolve();
                             $(this).dialog('close');
                             return false;
                         }
                    }, {
                         text: Mapbender.trans('mb.actions.cancel'),
                         'class': 'button critical btn',
                         click:   function() {
                             deferred.reject();
                             $(this).dialog('close');
                             return false;
                         }
                     }
                ]
            });
            return deferred.promise();
        }

        /**
         * @param {String|HTMLElement|jQuery} content
         * @param {Object} [options]
         * @return {jQuery}
         */
        dialog(content, options) {
            const buttons = (options || {}).buttons || [];
            for (let b = 0; b < buttons.length; ++b) {
                const classes = buttons[b].class && buttons[b].class.split(/\s+/) || [];
                if (!classes.length || -1 === classes.indexOf('btn')) {
                    classes.push('button btn');
                    buttons[b].class = classes.join(' ');
                }
                if (-1 === classes.indexOf('button') && -1 === classes.indexOf('btn')) {
                    classes.push('button');
                }
            }
            return this.baseDialog_(content, Object.assign(options, {
                buttons: buttons,
                resizable: true
            }));
        }
    }

    // Export as singleton instance for backward compatibility
    Mapbender.DataManager.DialogFactory = new DialogFactory();
}(jQuery));

