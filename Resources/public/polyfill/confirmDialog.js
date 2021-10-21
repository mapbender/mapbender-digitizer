(function () {
    "use strict";

    Mapbender.confirmDialog = Mapbender.confirmDialog || function (options) {
        var dialog = $("<div></div>").popupDialog({
            title: options.hasOwnProperty('title') ? options.title : "",
            classes: {
                'ui-dialog': 'ui-dialog digitizer-dialog'
            },
            maximizable: false,
            dblclick: false,
            minimizable: false,
            resizable: false,
            collapsable: false,
            modal: true,
            buttons: options.buttons || [{
                text: options.okText || "OK",
                click: function (e) {
                    if (!options.hasOwnProperty('onSuccess') || options.onSuccess(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }, {
                text: options.cancelText || "Abbrechen",
                'class': 'critical',
                click: function (e) {
                    if (!options.hasOwnProperty('onCancel') || options.onCancel(e) !== false) {
                        dialog.popupDialog('close');
                    }
                    return false;
                }
            }]
        });
        dialog.html('<div class="confirm-dialog">'+(options.hasOwnProperty('html') ? options.html : "") + '</div>');
        return dialog;
    };

    Mapbender.elementRegistry.waitReady = Mapbender.elementRegistry.waitReady || function(target) {

        var d = $.Deferred();
        Mapbender.elementRegistry.onElementReady(target,d.resolve);

        return d;

    };


    Mapbender.elementRegistry.waitCreated = Mapbender.elementRegistry.waitCreated ||  Mapbender.elementRegistry.waitReady;

})();
