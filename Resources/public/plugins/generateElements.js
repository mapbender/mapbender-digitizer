(function ($) {
    function has(obj, key) {
        return typeof obj[key] !== 'undefined';
    }

    var eventNameList = [
        'load',
        'focus', 'blur',
        'input', 'change', 'paste',
        'click', 'dblclick', 'contextmenu',
        'keydown', 'keypress', 'keyup',
        'dragstart','ondrag','dragover','drop',
        'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover', 'mouseup',
        'touchstart', 'touchmove', 'touchend','touchcancel'
    ];

    function addEvents(element, declaration) {
        $.each(declaration, function(k, value) {
            if(typeof value == 'function') {
                element.on(k, value);
            } else if(typeof value == "string" && _.contains(eventNameList, k)) {
                var elm = element;
                if(elm.hasClass("form-group")) {
                    elm = elm.find("input,.form-control");
                }
                if(k === 'load'){
                    setTimeout(function(){
                        $(elm).ready(function(e) {
                            var el = elm;
                            var result = false;
                            eval(value);
                            result && e.preventDefault();
                            return result;
                        });
                    },1);
                }else{
                    elm.on(k, function(e) {
                        var el = $(this);
                        var result = false;
                        eval(value);
                        result && e.preventDefault();
                        return result;
                    });
                }
            }
        });
    }

    function copyToClipboard(text) {
        if (window.clipboardData && window.clipboardData.setData) {
            // IE specific code path to prevent textarea being shown while dialog is visible.
            return window.clipboardData.setData("Text", text);

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
                                var isMandatory = evaluated.apply(inputField, []);
                                hasValue = (isMandatory && hasValue) || !isMandatory;
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
            select:    function(item, declarations, widget) {
                var select = $('<select class="form-control"/>');
                var container = declarations.input(item, declarations, widget, select);
                var value = has(item, 'value') ? item.value : null;

                container.addClass('select-container');

                if (has (item,'calculateMaxElevationOnChange')) {
                    select.change(()=>{
                        return $.ajax({
                            url: item.elementUrl + 'getMaxElevation',
                            type: 'POST',
                            dataType:    "json",
                            contentType: "application/json; charset=utf-8",
                            data: JSON.stringify({
                                curveseg_id: select.val(),
                                schema: item.schema,
                                srs: item.srs
                            })
                        }).done((res)=>{
                            item.dialog.formData(res);

                            $('.-fn-coordinates',item.dialog).find("[name=x]").trigger("change");
                            $('.-fn-coordinates',item.dialog).find("[name=y]").trigger("change");

                        }).fail(()=>{
                            console.log("Request failed");
                        });
                    });
                }

                if(has(item, 'multiple') && item.multiple) {
                    select.attr('multiple', 'multiple');
                }

                if(has(item, 'options')) {
                    var isValuePack = _.isArray(_.first(item.options)) && _.size(_.first(item.options)) == 2;
                    _.each(item.options, function(title, value) {
                        if(isValuePack) {
                            value = title[0];
                            title = title[1];
                        } else if(_.isObject(title)) {
                            var a = _.toArray(title);
                            value = a[0];
                            title = a[1];
                        }

                        var option = $("<option/>");
                        option.attr('value', value);
                        option.html(title);
                        select.append(option);
                    });
                }

                window.setTimeout(function() {
                    select.val(value);
                    if(has(item, 'multiple') && item.multiple && (typeof select.select2 === 'function')) {
                        select.select2(item);
                    }
                }, 20);

                return container;
            },



        },


        genElement: function(item) {

            var widget = this;
            var type = has(widget.declarations, item.type) ? item.type : 'html';
            var declaration = widget.declarations[type];
            var element = declaration(item, widget.declarations, widget);

            if(has(item, 'cssClass')) {
                element.addClass(item.cssClass);
            }

            if(has(item, 'attr')) {
                $.each(item.attr, function(key, val) {
                    element.attr(key,val);
                });
            }

            if(typeof item == "object") {
                addEvents(element, item);
            }

            if(has(item, 'css')) {

                element.css(item.css);
            }

            element.data('item', item);

            if(has(item, 'mandatory')){
                // ** This is injected code
                if (typeof item.mandatory == "string") {
                    var func =  eval(item.mandatory);
                    if (typeof func != "function") {
                        return;
                    }
                    if (func.apply()) {
                        element.addClass('has-warning');
                        console.log("applied",func,2123);
                    }
                } else {
                    //**
                    element.addClass('has-warning');
                }

            }

            return element;
        },

    });

})(jQuery);
