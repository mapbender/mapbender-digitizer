(function () {
    "use strict";

    Mapbender.Digitizer = function ($element, options) {
        var widget  = this;

        $.extend(widget, options);

        widget.id = $element.attr("id");

        var $spinner = (function() {
            var $parent = $('#' + widget.id).parents('.container-accordion').prev().find('.tablecell');
            var spinner = $("<div class='spinner' style='display:none'></div>");
            $parent.prepend(spinner);
            return spinner;
        })();

        var qe = new Mapbender.DataManager.QueryEngine(widget.id, this.createSpinner_($spinner));
        widget.query = qe.query;
        widget.getElementURL = qe.getElementURL;
    };

    Mapbender.Digitizer.prototype.TYPE = "Digitizer";

    Mapbender.Digitizer.prototype.setup = function () {
        var widget = this;
        widget.contextMenu = new Mapbender.Digitizer.MapContextMenu(widget);

        var rawSchemes = widget.schemes;
        widget.schemes = {};
        $.each(rawSchemes, function (schemaName,options) {
            options.schemaName = schemaName;
            var schema = widget.schemes[schemaName] = widget.createScheme_(options);
            schema.createMenu($element);
        });
        Object.freeze(widget.schemes);
    };

    Mapbender.Digitizer.prototype.isInExtent = function(feature) {
        var widget = this;
        return ol.extent.intersects(widget.map.getView().calculateExtent(), feature.getGeometry().getExtent());
    };

    Mapbender.Digitizer.prototype.refreshConnectedDigitizerFeatures = function(schemaName){
        $(".mb-element-digitizer").not(".mb-element-data-manager").each(function(index,element){
            var foreignDigitizer = $(element).data("mapbenderMbDigitizer");

            try {
                foreignDigitizer.schemes[schemaName].layer.getSource().refresh();
            } catch(e) {
                console.error("No active Digitizer Scheme '"+schemaName+"'",e);
            }
        });


    };

    Mapbender.Digitizer.prototype.getProjectionCode = function() {
        var widget = this;
        return widget.map.getView().getProjection().getCode().split(':').pop();
    };
    Mapbender.Digitizer.prototype.getCurrentSchema = function() {
        var widget = this;
        return widget.selector.getSelectedSchema();
    }

    Mapbender.Digitizer.prototype.createSpinner_ = function ($spinner) {
        var spinner = new function () {
            var spinner = this;

            spinner.openRequests = 0;

            spinner.$element = $spinner;

            spinner.addRequest = function () {
                spinner.openRequests++;
                if (spinner.openRequests >= 1) {
                    spinner.$element.trigger("show");
                }
            };

            spinner.removeRequest = function () {
                spinner.openRequests--;
                if (spinner.openRequests === 0) {
                    spinner.$element.trigger("hide");
                }
            };


        };

        return spinner;
    };

})();
