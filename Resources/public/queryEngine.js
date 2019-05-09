(function () {
    "use strict";

    Mapbender.Digitizer.QueryEngine = function(widget) {


        this.getElementURL = function() {
            return Mapbender.configuration.application.urls.element + '/' + widget.id + '/';
        };

        /**
         * Digitizer API connection query
         *
         * @param uri suffix
         * @param request query
         * @return xhr jQuery XHR object
         * @version 0.2
         */
        this.query = function (uri, request) {
            var elementUrl = this.getElementURL();
            widget.spinner.addRequest();
            return $.ajax({
                url: elementUrl + uri,
                type: 'POST',
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data: JSON.stringify(request)
            }).fail(function (xhr) {
                // this happens on logout: error callback with status code 200 'ok'
                if (xhr.status === 200 && xhr.getResponseHeader("Content-Type").toLowerCase().indexOf("text/html") >= 0) {
                    window.location.reload();
                }
            }).fail(function (xhr) {
                if (xhr.statusText === 'abort') {
                    return;
                }
                var errorMessage = Mapbender.DigitizerTranslator.translate('api.query.error-message');
                var errorDom = $(xhr.responseText);

                // https://stackoverflow.com/a/298758
                var exceptionTextNodes = $('.sf-reset .text-exception h1', errorDom).contents().filter(function () {
                    return this.nodeType === (Node && Node.TEXT_NODE || 3) && ((this.nodeValue || '').trim());
                });
                if (exceptionTextNodes && exceptionTextNodes.length) {
                    errorMessage = [errorMessage, exceptionTextNodes[0].nodeValue.trim()].join("\n");
                }
                $.notify(errorMessage, {
                    autoHide: false
                });
            }).always( function() {
                widget.spinner.removeRequest();
            });
        };

    };


})();