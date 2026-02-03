(function ($) {
    "use strict";
    /** @external jQuery */

    window.Mapbender = Mapbender || {};
    Mapbender.DataManager = Mapbender.DataManager || {};

    /**
     * Utility class for form operations
     */
    class FormUtil {
        /**
         * @param {(HTMLElement|jQuery)} form
         * @param {bool} [filterSubmit]
         * @return {Object}
         */
        extractValues(form, filterSubmit) {
            const values = {};
            const radioMap = {};
            const $allNamedInputs = $(':input[name]', form);
            $allNamedInputs.get().forEach(function(input) {
                const type = input.type;
                if (filterSubmit && (input.readOnly)) {
                    // Treat read-only input as "unmapped" and omit it when
                    // running storage.
                    return;
                }
                let value;
                switch (type) {
                    case 'radio':
                        // Radio inputs repeat with the same name. Do not evaluate them individually. Evaluate the
                        // whole group.
                        if (radioMap[input.name]) {
                            // already done
                            return;
                        }
                        value = $allNamedInputs.filter('[type="radio"][name="' + input.name + '"]:checked').val();
                        radioMap[input.name] = true;
                        break;
                    case 'checkbox':
                        value = input.checked && input.value;
                        break;
                    case 'select-multiple':
                        const separator = $(input).attr('data-multiselect-separator') || ',';
                        /** @var {Array<String>|null} valueList */
                        const valueList = $(input).val();
                        value = valueList && valueList.join(separator) || null;
                        break;
                    default:
                        value = input.value;
                        // Date special: if date is not required and empty, convert empty string to null
                        // This fixes errors saving empty string into SQL DATE columns. OTOH this
                        // means non-required date fields can only map to nullable columns.
                        if (value === '' && !input.required && input.type === 'date' || $(input).is('.js-datepicker')) {
                            value = null;
                        }
                        break;
                }
                values[input.name] = value;
            });
            return values;
        }

        /**
         * @param {(HTMLElement|jQuery)} form
         * @param {Object} values
         */
        setValues(form, values) {
            const valueKeys = Object.keys(values);
            for (let i = 0; i < valueKeys.length; ++i) {
                const inputName = valueKeys[i];
                let value = values[inputName];
                const $input = $(':input[name="' + inputName + '"]', form);
                if (!$input.length) {
                    continue;
                }
                switch ($input.get(0).type) {
                    case 'select-multiple':
                        if (!Array.isArray(value)) {
                            const separator = $input.attr('data-multiselect-separator') || ',';
                            value = (value || '').split(separator);
                        }
                        $input.val(value);
                        break;
                    case 'radio':
                        const $check = $input.filter(function() {
                            return this.value === value;
                        });
                        $check.prop('checked', true);
                        break;
                    case 'checkbox':
                        // Legacy fun time: database may contain stringified booleans "false" or even "off"
                        value = !!value && (value !== 'false') && (value !== 'off');
                        $input.prop('checked', value);
                        break;
                    default:
                        $input.val(value);
                        break;
                }
                switch ($input.get(0).type) {
                    case 'text':
                        $input.trigger('input.colorpicker').trigger('change.colorpicker');
                        break;
                    case 'select':
                    case 'select-multiple':
                        $input.trigger('change.select2');
                        break;
                    default:
                        break;
                }
            }
        }

        /**
         * @param {(HTMLElement|jQuery)} form
         * @return {boolean}
         */
        validateForm(form) {
            const self = this;
            const invalidInputs = $(':input[name]', form).get().filter(function(input) {
                return !self.validateInput(input);
            });
            // If there are erros, switch tab container (if any) to reveal the first affected input
            /** @see https://github.com/mapbender/vis-ui.js/blob/0.2.84/src/js/utils/fn.formData.js#L166 */
            const $firstInvalid = invalidInputs.length && $(invalidInputs[0]);
            const $tabElement = $firstInvalid && $firstInvalid.closest('.ui-tabs');
            if ($tabElement && $tabElement.length) {
                const tabIndex = $firstInvalid.closest('.ui-tabs-panel').index('.ui-tabs-panel');
                $tabElement.tabs({active: tabIndex});
            }
            if ($firstInvalid) {
                $firstInvalid.focus();
            }
            return !invalidInputs.length;
        }

        /**
         * @param {HTMLElement} input
         * @return {boolean}
         * @see https://github.com/mapbender/vis-ui.js/blob/0.2.84/src/js/utils/fn.formData.js#L13
         */
        validateInput(input) {
            const $input = $(input);
            if ($input.attr('type') === 'radio') {
                // Individual radio buttons cannot be invalid and cannot be validated
                return true;
            }
            // NOTE: hidden, disabled and read-only inputs must be explicitly excluded
            //       from jQuery validation. They always come back as invalid, even without
            //       any required / pattern constraints
            //       see https://stackoverflow.com/questions/51534473/jquery-validate-not-working-on-hidden-input
            const isValid =
                ($input.is(':valid') || input.type === 'hidden' || input.readOnly || input.disabled)
                && this.validateCustom_($input)
            ;
            this.markValidationState($input, isValid);
            if (!isValid) {
                const self = this;
                // Re-validate once on change, to make error message disappear
                $input.one('change input', function() {
                    self.validateInput(input);
                });
            }
            return isValid;
        }

        /**
         * @param {jQuery} $input
         * @param {boolean} isValid
         */
        markValidationState($input, isValid) {
            const $formGroup = $input.closest('.mb-3');
            $formGroup.toggleClass('has-error', !isValid);
            $formGroup.toggleClass('has-success', isValid);
            /** @todo: ensure message container is always present in the right place */
            let $messageContainer = $('.invalid-feedback', $formGroup);
            const invalidMessage = $input.attr('data-custom-validation-message');
            if (!isValid && invalidMessage && $input.attr('type') !== 'checkbox') {
                if (!$messageContainer.length) {
                    $messageContainer = $(document.createElement('div')).addClass('help-block invalid-feedback');
                    $formGroup.append($messageContainer);
                }
                $messageContainer.text(invalidMessage || '');
            }
            $messageContainer.toggle(!isValid);
        }

        /**
         * @param {jQuery} $input
         */
        copyToClipboard($input) {
            let text = $input.val() || '';
            if (text && Array.isArray(text)) {
                // select[multple]
                const separator = $input.attr('data-multiselect-separator') || ',';
                /** @var {Array<String>|null} valueList */
                text = text.join(separator) || '';
            }
            /** @see https://github.com/mapbender/vis-ui.js/blob/0.2.84/src/js/jquery.form.generator.js#L157 */
            if (window.clipboardData && window.clipboardData.setData) {
                /** @see https://caniuse.com/mdn-api_clipboardevent_clipboarddata */
                return clipboardData.setData("Text", text);
            } else {
                const textarea = document.createElement("textarea");
                textarea.textContent = text;
                textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    return document.execCommand("copy");  // Security exception may be thrown by some browsers.
                } catch (ex) {
                    console.warn("Copy to clipboard failed.", ex);
                    return false;
                } finally {
                    document.body.removeChild(textarea);
                }
            }
        }

        /**
         * @param {jQuery} $input
         * @return {boolean}
         * @private
         */
        validateCustom_($input) {
            /** @todo: use a more reasonable data key than "warn" */
            const validationCallback = $input.data('warn');
            if (validationCallback) {
                const value = $input.val();
                // Legacy quirk: pass null instead of empty string to validation callback
                if (value === '') {
                    return !!validationCallback(null);
                } else {
                    return !!validationCallback(value);
                }
            } else {
                return true;
            }
        }
    }

    // Export as singleton instance for backward compatibility
    Mapbender.DataManager.FormUtil = new FormUtil();

}(jQuery));

