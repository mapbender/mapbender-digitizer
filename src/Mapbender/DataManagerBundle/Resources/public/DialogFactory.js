!(function ($) {
    "use strict";
    /** @external jQuery */

    window.Mapbender = Mapbender || {};
    Mapbender.DataManager = Mapbender.DataManager || {};

    Mapbender.DataManager.DialogFactory = {
        baseDialog_: function(content, options) {
            var $content = $((typeof content === 'string') ? $.parseHTML(content) : content);
            var defaults = {
                classes: {
                    'ui-dialog': 'ui-dialog data-manager-dialog',
                    'ui-button': 'ui-button button btn'
                },
                resizable: false
            };
            var options_ = Object.assign({}, defaults, options || {}, {
                classes: Object.assign({}, defaults.classes, (options || {}).classes || {})
            });
            $content.dialog(options_);
            // Hide text labels on .ui-button-icon-only, with or without jqueryui css
            $('.ui-dialog-titlebar .ui-button-icon-only', $content.closest('.ui-dialog')).each(function() {
                var $button = $(this);
                var $icon = $('.ui-button-icon', this);
                $button.empty().append($icon);
            });
            $content.on('dialogclose', function() {
                window.setTimeout(function() { if ($content.dialog('instance')) { $content.dialog('destroy');} }, 500);
            });

            return $content;
        },

        /**
         *
         * @param {String} title
         * @param {*} content
         * @return {Promise}
         */
        confirm: function(title, content) {
            var $content = $(document.createElement('div'))
                .append(content || null)
            ;
            var deferred = $.Deferred();
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
        },
        dialog: function(content, options) {
            var buttons = (options || {}).buttons || [];
            for (var b = 0; b < buttons.length; ++b) {
                var classes = buttons[b].class && buttons[b].class.split(/\s+/) || [];
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
        },
        __dummy__: null
    };
}(jQuery));

