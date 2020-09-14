(function () {
    "use strict";
    if (window.ol && ol.source && !ol.source.VectorEventType) {
        // HACK: monkey patch event types not present in current OL6 repackage build
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/source/VectorEventType.js
        ol.source.VectorEventType = {
            ADDFEATURE: 'addfeature',
            CHANGEFEATURE: 'changefeature',
            CLEAR: 'clear',
            REMOVEFEATURE: 'removefeature'
        };
    }
    if (window.ol && !ol.ObjectEventType) {
        // HACK: monkey patch event types not present in current OL6 repackage build
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/ObjectEventType.js
        ol.ObjectEventType = {
            PROPERTYCHANGE: 'propertychange'
        };
    }
})();
