(function () {
    "use strict";

    Mapbender.Digitizer = function ($element, options) {
        var widget  = this;

        $.extend(widget, options);

        widget.id = $element.attr("id");
        var spinner = this.createSpinner_();
        // @todo: this doesn't work in Mapbender 3.2 (no tableCell class on accordions)
        // @todo: loading indicator should not depend on sidepane style (accordion vs tabs), should live
        //        completely inside element DOM
        // @todo: loading indicator should go upstream into data-manager
        var $parent = $('#' + widget.id).parents('.container-accordion').prev().find('.tablecell');
        $parent.prepend(spinner.$element);

        var qe = new Mapbender.DataManager.QueryEngine(widget.id, spinner);
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

    Mapbender.Digitizer.prototype.createSpinner_ = function () {
        var spinner = new function () {
            var spinner = this;

            spinner.openRequests = 0;

            spinner.$element = $("<div class='spinner' style='display:none'></div>");

            spinner.update_ = function() {
                spinner.$element.toggle(spinner.openRequests >= 1);
            }

            spinner.addRequest = function () {
                spinner.openRequests++;
                spinner.update_();
            };

            spinner.removeRequest = function () {
                spinner.openRequests--;
                spinner.update_();
            };
        };

        return spinner;
    };

})();
