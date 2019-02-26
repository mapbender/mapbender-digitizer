(function($) {

    $.widget("digitizer.resultTable", $["vis-ui-js"].resultTable, {




        // Allow Button disable
        genNavigation: function(elements) {
            var html = $('<div class="button-navigation"/>');
            $.each(elements, function(idx, element) {

                var type = 'button';
                if(_.has(element,'type')){
                    type = element.type;
                }else if(_.has(element,'html')){
                    type = 'html';
                }

                switch(type){
                    case 'html':
                        html.append(element.html);
                        break;
                    case 'button':
                        var title = element.title?element.title:(element.text?element.text:'');
                        var disabled = !!element.disabled ? 'disabled' : '';
                        var button = $('<button class="button" '+disabled+' title="' + title + '">' + title + '</button>');
                        if(_.has(element,'cssClass')){
                            button.addClass(element.cssClass);
                        }
                        if(_.has(element,'className')){
                            button.addClass("icon-"+element.className);
                            button.addClass( element.className);
                        }

                        html.append(button);
                        break;
                }
            });
            return html;
        }


    });


})(jQuery);
