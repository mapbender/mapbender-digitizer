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
         * @return {Mapbender.Popup}
         * @private
         */
        baseDialog_(content, options) {
            const $content = $((typeof content === 'string') ? $.parseHTML(content) : content);
            const defaults = {
                modal: true,
                closeButton: true,
                draggable: true,
                resizable: false,
                scrollable: true,
                detachOnClose: true,
                destroyOnClose: false
            };
            const options_ = Object.assign({}, defaults, options || {});
            
            // Map buttons to Mapbender.Popup format
            if (options_.buttons && options_.buttons.length) {
                options_.buttons = options_.buttons.map(btn => ({
                    label: btn.text,
                    cssClass: btn.class || 'btn',
                    callback: btn.click
                }));
            }
            
            // Store cssClass for content element (not popup wrapper)
            const contentCssClass = options_.cssClass;
            delete options_.cssClass;  // Don't apply to popup wrapper
            
            // Set content
            options_.content = $content;
            
            // Create popup
            const popup = new Mapbender.Popup(options_);
            
            // Store reference to original content element for data access
            // (since Popup.setContent uses .html() which loses jQuery data)
            popup.$contentElement = $content;
            
            // Apply CSS class to popupContent element
            if (contentCssClass && popup.$element) {
                $('.popupContent', popup.$element).addClass(contentCssClass);
            }
            
            // Apply position if specified (jQuery UI position format to CSS)
            // Note: Mapbender.Popup doesn't support position option natively,
            // so we apply it as CSS after creation
            if (options.position && popup.$element) {
                const pos = options.position;
                const cssPos = {};
                
                // Handle jQuery UI position format: {my: "center", at: "center", of: window}
                // For now, support simple numeric/string positions
                if (typeof pos.left !== 'undefined') {
                    cssPos.left = typeof pos.left === 'number' ? pos.left + 'px' : pos.left;
                }
                if (typeof pos.top !== 'undefined') {
                    cssPos.top = typeof pos.top === 'number' ? pos.top + 'px' : pos.top;
                }
                if (typeof pos.right !== 'undefined') {
                    cssPos.right = typeof pos.right === 'number' ? pos.right + 'px' : pos.right;
                }
                if (typeof pos.bottom !== 'undefined') {
                    cssPos.bottom = typeof pos.bottom === 'number' ? pos.bottom + 'px' : pos.bottom;
                }
                
                if (Object.keys(cssPos).length > 0) {
                    popup.$element.css(cssPos);
                }
            }
            
            return popup;
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
            const popup = this.baseDialog_($content, {
                title: title,
                modal: true,
                buttons:[
                    {
                         text: Mapbender.trans('mb.actions.accept'),
                         'class': 'button success btn',
                         click: function() {
                             deferred.resolve();
                             popup.close();
                             return false;
                         }
                    }, {
                         text: Mapbender.trans('mb.actions.cancel'),
                         'class': 'button critical btn',
                         click:   function() {
                             deferred.reject();
                             popup.close();
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
         * @return {Mapbender.Popup}
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

