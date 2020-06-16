(function ($) {
    function has(obj, key) {
        return typeof obj[key] !== 'undefined';
    }

    function copyToClipboard(text) {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return clipboardData.setData("Text", text);

        } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
            document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand("copy");  // Security exception may be thrown by some browsers.
            } catch (ex) {
                console.warn("Copy to clipboard failed.", ex);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }


    $.widget('digitizer.generateElements', $["vis-ui-js"].generateElements, {
        declarations: {
            input: function (item, declarations, widget, input) {
                var type = has(declarations, 'type') ? declarations.type : 'text';
                var inputField = input ? input : $('<input class="form-control" type="' + type + '"/>');
                var container = $('<div class="form-group"/>');
                var icon = '<span class="glyphicon glyphicon-ok form-control-feedback" aria-hidden="true"></span>';

                // IE8 bug: type can't be changed...
                /// inputField.attr('type', type);
                inputField.data('declaration', item);

                $.each(['name', 'rows', 'placeholder'], function (i, key) {
                    if (has(item, key)) {
                        inputField.attr(key, item[key]);
                    }
                });

                if (has(item, 'value')) {
                    inputField.val(item.value);
                }

                if (has(item, 'disabled') && item.disabled) {
                    inputField.attr('disabled', '');
                }


                if (has(item, 'title')) {
                    container.append(declarations.label(item, declarations));
                    container.addClass('has-title')
                }

                if (has(item, 'mandatory') && item.mandatory) {
                    inputField.data('warn', function (value) {
                        var hasValue = $.trim(value) != '';
                        var isRegExp = item.mandatory !== true;

                        /** This is the inserted Part **/
                        if (isRegExp) {
                            var evaluated = eval(item.mandatory);
                            var isFunction = evaluated instanceof Function;
                            if (isFunction) {
                                hasValue = evaluated.apply(inputField, []);
                                console.log(hasValue, "!");
                            } else {
                                hasValue = evaluated.exec(value) != null;
                            }
                        }
                        /**  **/
                        // if(isRegExp){
                        //     hasValue = eval(item.mandatory).exec(value) != null;
                        // }

                        if (hasValue) {
                            container.removeClass('has-error');
                        } else {
                            if (inputField.is(":visible")) {
                                var text = item.hasOwnProperty('mandatoryText') ? item.mandatoryText : "Please, check!";
                                $.notify(inputField, text, {position: "top right", autoHideDelay: 2000});
                            }
                            container.addClass('has-error');
                        }
                        return hasValue;
                    });
                }

                if (has(item, 'infoText')) {
                    var infoButton = $('<a class="infoText"></a>');
                    infoButton.on('click touch press', function (e) {
                        var button = $(e.currentTarget);
                        $.notify(button.attr('title'), 'info');
                    });
                    infoButton.attr('title', item.infoText);
                    container.append(infoButton);
                }


                if (has(item, 'copyClipboard')) {

                    var copyButton = $('<a class="copy-to-clipboard"><i class="fa fa-clipboard far-clipboard" aria-hidden="true"></i></a>');
                    copyButton.on('click', function (e) {
                        var button = $(e.currentTarget);
                        var data = container.formData(false);
                        copyToClipboard(data[item.name]);
                    });
                    container.append(copyButton);
                }

                container.append(inputField);
                //container.append(icon);

                return container;
            },
        }

    });

})(jQuery);
