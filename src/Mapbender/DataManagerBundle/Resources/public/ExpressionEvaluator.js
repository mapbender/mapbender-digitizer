!(function ($) {
    "use strict";

    window.Mapbender = Mapbender || {};
    Mapbender.DataManager = Mapbender.DataManager || {};

    /**
     * Utility class for evaluating dynamic expressions with data context
     */
    class ExpressionEvaluator {
        /**
         * Check if a string contains a dynamic expression
         * @param {string} expression
         * @return {boolean}
         */
        static isDynamicExpression(expression) {
            if (typeof expression !== 'string') {
                return false;
            }
            return expression.includes('function()') || 
                   expression.includes('function ()') || 
                   expression.includes('data.') || 
                   expression.includes('${');
        }

        /**
         * Evaluate a dynamic expression with data context
         * @param {string} expression - The expression to evaluate
         * @param {Object} data - The data context object
         * @return {*} The evaluated result
         * @throws {Error} If evaluation fails
         */
        static evaluate(expression, data) {
            if (expression.includes('${')) {
                // Template literal style: "Editing ${data.title} - ${data.gid}"
                return new Function('data', `return \`${expression}\`;`)(data);
            } else {
                // Function expression or simple expression style
                return (function(data_) {
                    return eval(expression);
                })(data);
            }
        }

        /**
         * Safely evaluate an expression with error handling
         * @param {string} expression - The expression to evaluate
         * @param {Object} data - The data context object
         * @param {*} [fallback=''] - Fallback value if evaluation fails
         * @return {*} The evaluated result or fallback value
         */
        static evaluateSafe(expression, data, fallback) {
            if (fallback === undefined) {
                fallback = '';
            }
            try {
                return this.evaluate(expression, data);
            } catch (e) {
                console.warn('Failed to evaluate expression:', expression, e);
                return fallback;
            }
        }

        /**
         * Evaluate an expression if it's dynamic, otherwise return as-is
         * @param {string} value - The value or expression
         * @param {Object} data - The data context object
         * @param {*} [fallback] - Fallback value if evaluation fails (defaults to original value)
         * @return {*} The evaluated result or original value
         */
        static evaluateIfDynamic(value, data, fallback) {
            if (this.isDynamicExpression(value)) {
                if (fallback === undefined) {
                    fallback = value;
                }
                return this.evaluateSafe(value, data, fallback);
            }
            return value;
        }
    }

    Mapbender.DataManager.ExpressionEvaluator = ExpressionEvaluator;

}(jQuery));
