;!(function () {
    "use strict";
    window.Mapbender = Mapbender || {};
    window.Mapbender.Digitizer = Mapbender.Digitizer || {};
    Mapbender.Digitizer.StyleUtil = {
        placeholderRx_: /\${([^}]+)}/g,
        resolvePlaceholders: function(styleConfig, featureData) {
            var placeholderProps = this.detectDataPlaceholders(styleConfig);
            var resolver = this.getPlaceholderResolver(styleConfig, placeholderProps, function() {
                return featureData;
            });
            return resolver(styleConfig);
        },
        /**
         * @param {Object} data
         * @param {Array<String>} [candidates] to limit scanning to specifically named properties (default: scan all properties)
         * @return {Array<String>}
         */
        detectDataPlaceholders: function(data, candidates) {
            var placeholderRx = this.placeholderRx_;
            return (candidates || Object.keys(data)).filter(function(prop) {
                // Reset global-flagged RegExp state.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test#using_test_on_a_regex_with_the_global_flag
                placeholderRx.lastIndex = 0;
                return placeholderRx.test(data[prop] || '');
            });
        },
        /**
         * @param {Object} styleConfig
         * @param {Array<String>} propertyNames
         * @param {function} featureDataCallback
         * @return {function}
         */
        getPlaceholderResolver: function(styleConfig, propertyNames, featureDataCallback) {
            if (propertyNames.length) {
                var placeholderRx = this.placeholderRx_;
                return function(styleConfig, feature) {
                    var valuesOut = Object.assign({}, styleConfig);
                    var data = featureDataCallback(feature);
                    propertyNames.forEach(function(prop) {
                        var resolved = styleConfig[prop].replace(placeholderRx, function(match, dataProp) {
                            if (!data[dataProp] && prop === 'externalGraphic') {
                                // Empty entire output value (incomplete url expansion)
                                valuesOut[prop] = data[dataProp];
                            }
                            return data[dataProp];
                        });
                        if (resolved && valuesOut[prop]) {
                            valuesOut[prop] = resolved;
                        }
                    });
                    return valuesOut;
                }
            } else {
                return function(unchanged) {
                    return unchanged;
                }
            }
        }
    };
}());
