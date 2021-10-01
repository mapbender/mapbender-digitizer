;!(function () {
    "use strict";

    var wktFormat_;
    function getWktFormat_() {
        wktFormat_ = wktFormat_ || new OpenLayers.Format.WKT();
        return wktFormat_;
    }
    var FeaturePatch = {
        clone: function() {
            return new Ol2FeatureEx(this.geometry && this.geometry.clone() || null, this.attributes, this.style);
        },
        getId: function() {
            return this.fid;
        },
        setId: function(value) {
            this.fid = value;
        },
        set: function(key, value, silent) {
            var oldValue = !silent && this.get(key);
            if (key === 'data') {
                this.attributes = value;
            } else {
                this.data_ = this.data_ || {};
                this.data_[key] = value;
            }
            if (!silent && oldValue !== value) {
                this.dispatchEvent({type: 'propertychange', key: key, oldValue: oldValue, target: this});
                this.dispatchEvent({type: ['change', key].join(':'), key: key, oldValue: oldValue, target:this});
            }
        },
        get: function(key) {
            if (key === 'data') {
                return this.attributes;
            } else {
                return (this.data_ || {})[key];
            }
        },
        on: function(type, listener) {
            var types = !Array.isArray(type) && [type] || type;
            for (var i = 0; i < types.length; ++i) {
                this.listeners_[types[i]] = this.listeners_[types[i]] || [];
                this.listeners_[types[i]].push(listener);
            }
        },
        dispatchEvent: function(evt) {
            var listeners = this.listeners_[evt.type] || [];
            for (var i = 0; i < listeners.length; ++i) {
                if (false === listeners[i].call(this, evt)) {
                    break;
                }
            }
        },
        getGeometry: function() {
            return this.geometry;
        }
    };


    function Ol2FeatureEx() {
        OpenLayers.Feature.Vector.apply(this, arguments);
        this.listeners_ = {};
    }
    Ol2FeatureEx.prototype = Object.create(OpenLayers.Feature.Vector.prototype);
    Ol2FeatureEx.prototype.constructor = Ol2FeatureEx;
    Object.assign(Ol2FeatureEx.prototype, FeaturePatch);

    window.Mapbender = window.Mapbender || {};
    Mapbender.Digitizer = Mapbender.Digitizer || {};
    Mapbender.Digitizer.EngineUtil = {
        dumpWkt: function(geometry) {
            // OpenLayer.Format.WKT.write needs a feature
            var dummyFeature = new OpenLayers.Feature.Vector(geometry);
            return this.dumpFeatureWkt(dummyFeature);
        },
        dumpFeatureWkt: function(feature) {
            return getWktFormat_().write(feature);
        },
        featureFromWkt: function(wkt) {
            return new Ol2FeatureEx(this.geometryFromWkt(wkt));
        },
        geometryFromWkt: function(wkt) {
            return OpenLayers.Geometry.fromWKT(wkt);
        },
        onLayerFeatureAdded: function(layer, callback, syncExisting) {
            layer.events.register('featureadded', null, function(data) {
                callback(data.feature);
            });
            if (syncExisting) {
                layer.features.forEach(callback);
            }
        },
        onLayerFeatureRemoved: function(layer, callback) {
            layer.events.register('featureremoved', null, function(data) {
                callback(data.feature);
            });
        },
        patchFeature: function(feature) {
            if (typeof (feature.getId) !== 'function') {
                feature.listeners_ = {};
                Object.assign(feature, FeaturePatch);
            }
        },
        getGeometryType: function(geometry) {
            // Class name splitting is seriously the "official" way to do this
            // see https://github.com/openlayers/ol2/blob/master/lib/OpenLayers/Format/WKT.js#L140
            return geometry.CLASS_NAME.split('.')[2];
        },
        __dummy__: null
    };
})();
