(function () {
    "use strict";
    if (window.ol && !ol.MapEventType) {
        // HACK: monkey patch event types not present in current OL6 repackage build
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/MapEventType.js
        ol.MapEventType = {
            POSTRENDER: 'postrender',
            MOVESTART: 'movestart',
            MOVEEND: 'moveend'
        };
    }
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
    if (window.ol && ol.interaction && !ol.interaction.ModifyEventType) {
        // HACK: monkey patch event types not present in current OL6 repackage build
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Modify.js#L64
        ol.interaction.ModifyEventType = {
            MODIFYSTART: 'modifystart',
            MODIFYEND: 'modifyend'
        };
    }
    if (window.ol && ol.interaction && !ol.interaction.TranslateEventType) {
        // HACK: monkey patch event types not present in current OL6 repackage build
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Translate.js#L12
        ol.interaction.TranslateEventType = {
            TRANSLATESTART: 'translatestart',
            TRANSLATING: 'translating',
            TRANSLATEEND: 'translateend'
        };
    }
    if (window.ol && ol.interaction && !ol.interaction.DrawEventType) {
        // DrawEventType not exported by Openlayers 6, but present in ol/interaction/Draw module; new 'DRAWABORT' value added
        // @see https://github.com/openlayers/openlayers/blob/v4.6.5/src/ol/interaction/draweventtype.js
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Draw.js#L129
        ol.interaction.DrawEventType = {
            DRAWSTART: 'drawstart',
            DRAWEND: 'drawend',
            // new in Openlayers 6
            DRAWABORT: 'drawabort'
        };
    }
    if (window.ol && ol.interaction && ol.interaction.Draw) {
        if (!ol.interaction.Draw.DrawEvent) {
            // DrawEvent constructor is 1) not exported 2) no longer called Draw.Event in Openlayers 6
            // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Draw.js#L153
            ol.interaction.Draw.DrawEvent = function(type, feature) {
                ol.events.Event.BaseEvent.call(this, type);
                this.feature = feature;
            }
        }
        // alias DrawEvent to ol.interaction.Draw.Event
        if (!ol.interaction.Draw.Event) {
            ol.interaction.Draw.Event = ol.interaction.Draw.DrawEvent;
        }
    }

    if (window.ol && ol.interaction && ol.interaction.Draw) {
        // Mode_ property no longer exists in Openlayers 6, renamed to Mode (no underscore) but same values
        // @see https://github.com/openlayers/openlayers/blob/v4.6.5/src/ol/interaction/draw.js#L865
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/interaction/Draw.js#L117
        if (!ol.interaction.Draw.Mode_) {
            ol.interaction.Draw.Mode_ = {
                POINT: 'Point',
                LINE_STRING: 'LineString',
                POLYGON: 'Polygon',
                CIRCLE: 'Circle'
            };
        }
        if (!ol.interaction.Draw.Mode) {
            ol.interaction.Draw.Mode = ol.interaction.Draw.Mode_;
        }
    }
    if (window.ol && ol.geom && !ol.geom.GeometryType) {
        // HACK: monkey patch type constants not present in current OL6 repackage build
        // @see https://github.com/openlayers/openlayers/blob/main/src/ol/geom/GeometryType.js
        ol.geom.GeometryType = {
            POINT: 'Point',
            LINE_STRING: 'LineString',
            LINEAR_RING: 'LinearRing',
            POLYGON: 'Polygon',
            MULTI_POINT: 'MultiPoint',
            MULTI_LINE_STRING: 'MultiLineString',
            MULTI_POLYGON: 'MultiPolygon',
            GEOMETRY_COLLECTION: 'GeometryCollection',
            CIRCLE: 'Circle'
        };
    }
})();
