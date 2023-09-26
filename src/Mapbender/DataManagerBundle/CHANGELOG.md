# 2.0.8
- Allow dialogs to be dragged off screen edges
- Fix Doctrine DBAL 3.x incompatibilty

# 2.0.7
- Fix read-only / disabled inputs form inputs blocking form validation
- Treat read-only inputs as unmapped when submitting form data

# 2.0.6
- Fix handling of web-relative image placeholder url
- Fix file upload group layout
- Limit dialog height to never exceed screen height
- Fix documentation for select values generated via "sql" (showed wrong option nesting)

# 2.0.5
- Fix misleading log warning when generating select item choices from single-column SQL ([#5](https://github.com/mapbender/data-manager/issues/5))
- Forms: Fix missing support for configurable validation error text on required select items
- Forms: Support "mandatory" alias for select item required property (boolean only)
- Forms: Detect column / expression aliases "label" and "value" when generating select item choices from SQL
- Add documentation for [SQL-generated select item choices](./README.md#choice-input-option-formats)

# 2.0.4
- Fix missing `attr` and `required` support on select type form item
- Fix missing `attr` support on radioGroup option
- Fix label margin for radioGroup form type
- Fix alignment of file upload spinning process indicator
- Document "formItems", upload paths and misc other configuration options
- Misc translation fixes

# 2.0.3
- Add interaction button to file inputs to open current attachment in new tab
- Add interaction button to file inputs to remove attachment
- Fix (false positive) cycle detection errors if schema name matches data store / feature type name exactly
- Fix incompatibility with doctrine/dbal >= 2.8 (PHP 8 support)

# 2.0.2
- Fix errors trying to save empty string into columns mapped to type "date" form fields that are not required inputs

NOTE: columns mapped to a non-required date input must be nullable. Conversely, any type "date" form field mapped to non-nullable column must be a required input.

# 2.0.1
- Fix initialization errors if MapbenderDataSourceBundle is not registered in kernel

# 2.0.0
Same as 1.2.2, but with backwards compatibility considerations removed.
Provide only Symfony 4+-conformant Element implementation.
Incompatible / not installable with Mapbender versions before v3.2.6.

# 1.2.9
- Fix read-only / disabled inputs form inputs blocking form validation
- Treat read-only inputs as unmapped when submitting form data

# 1.2.8
- Fix handling of web-relative image placeholder url
- Fix file upload group layout
- Limit dialog height to never exceed screen height
- Fix documentation for select values generated via "sql" (showed wrong option nesting)

# 1.2.7
- Fix misleading log warning when generating select item choices from single-column SQL ([#5](https://github.com/mapbender/data-manager/issues/5))
- Forms: Fix missing support for configurable validation error text on required select items
- Forms: Support "mandatory" alias for select item required property (boolean only)
- Forms: Detect column / expression aliases "label" and "value" when generating select item choices from SQL
- Add documentation for [SQL-generated select item choices](./README.md#choice-input-option-formats)

# 1.2.6
- Fix missing `attr` and `required` support on select type form item
- Fix missing `attr` support on radioGroup option
- Fix label margin for radioGroup form type
- Fix alignment of file upload spinning process indicator
- Document "formItems", upload paths and misc other configuration options
- Misc translation fixes

# 1.2.5
- Add interaction button to file inputs to open current attachment in new tab
- Add interaction button to file inputs to remove attachment
- Fix (false positive) cycle detection errors if schema name matches data store / feature type name exactly
- Fix incompatibility with doctrine/dbal >= 2.8 (PHP 8 support)

# 1.2.4
- Fix errors trying to save empty string into columns mapped to type "date" form fields that are not required inputs

NOTE: columns mapped to a non-required date input must be nullable. Conversely, any type "date" form field mapped to non-nullable column must be a required input.

# 1.2.3
- Fix initialization errors if MapbenderDataSourceBundle is not registered in kernel

# 1.2.2
* Add full service-type element implementation for Symfony 4 / Mapbender >= 3.2.6
* Fix schema config error checking not working as intended

# 1.2.1
* Fix upload preview image broken on new upload, before saving
* Fix progress bar remaining visible after upload (replace with spinner icon)
* Display null database values as empty string in table

# 1.2.0
* Fix broken vertical alignment of "fieldSet" children when displaying validation errors
* Fix form validation message not displaying when field not in currently active tab
* Fix copy to clipboard for multi-select
* Fix multi-select layout break / lack of growth when resizing form dialog
* Fix form dialog file upload buttons not reflecting already stored values
* Fix initial poor preview quality of uploaded images
* Fix non-portable persisted urls for file uploads (previously included http schema + host name)
* Fix revalidation of text inputs with input errors happening only after removing field focus
* Add "readonly" input setting
* Make per-schema `maxResults` setting optional (removes hard-coded 5000 rows limit)
* Decouple / remove deprecated vis-ui.js dependency for Composer 2 compatibility
* Decouple / remove dependency on outdated blueimp server-side upload handling
* Strictness: Throw an exception if a schema references an undefined dataStore / featureType
* Strictness: Detect dataStore / featureType reference cycles and throw an exception
* Strictness: throw exception if dataStore / featureType configures an (client inaccessible) absolute upload path ("uri" / "path"); use web-relative paths only
* Add more client-side (console) warnings about legacy / ambiguous `formItems` contents
* Change allowEdit default false => true (match Digitizer; match own allowCreate / allowDelete default)
* Drop support for "service" select option configuration subtype (impossible with Symfony 4; use sql or statically predefined options if possible; use custom project code otherwise)
* Drop support for "dataStore" / "featureType" select option configuration subtype select options (use sql)
* Drop support for file uploads on IE <= 10
* Misc preparatory restructuring for Mapbender Symfony 4 compatibility

# 1.1.10
- Fix initialization errors if MapbenderDataSourceBundle is not registered in kernel
- Fix bundle configuration changes not applying until forced cache clear
- Change allowEdit default false => true (match Digitizer; match own allowCreate / allowDelete default)

# 1.1.9
- Fix incomplete client-side configuration for central "dataStore" / "featureType" referenced by name

# 1.1.8
- Fix file input regression

# 1.1.7
- Fix missing content in "type: text" fields ([Mapbender #1319](https://github.com/mapbender/mapbender/issues/1319); also affects Digitizer 1.4)

# 1.1.6
- Fix DataTables initialization error when showing column values with null values with filtering enabled
- Default to listing object id if no table columns are defined

# 1.1.5
- Fix multi-select data extraction (convert to scalar by joining with separator)
- Fix radio groups initializing with no radio button checked

# 1.1.4
- Fix backend form browser text searchability through off-screen portions of "schemes" area
- Fix backend form sizing
- Extract backend form block "schemes_row" for customization

# 1.1.3
- Prevent attribute editing dialog from becoming narrower than configured while resizing
- Fix row button alignment dependency on table column width configuration

# 1.1.2
- Fix uploads integration
- Fix loading indicator producing undesired horizontal scrollbars in certain container types

# 1.1.1
- Fix undesirable table pagination reset after deletion

# 1.1.0
- Adopt basic Mapbender 3.2 design sensibilities
- Drop support hacks for legacy vis-ui versions <0.1.80
- Replace vis-ui.js-built.js dependency (provided by abandonware robloach/component-installer) with individual vendor-sourced file references

# 1.0.14
- Fix file input regression

# 1.0.13
- Fix missing content in "type: text" fields ([Mapbender #1319](https://github.com/mapbender/mapbender/issues/1319); also affects Digitizer 1.4)

# 1.0.12
- Fix multi-select data extraction (convert to scalar by joining with separator)
- Fix radio groups initializing with no radio button checked

# 1.0.11
- Fix backend form browser text searchability through off-screen portions of "schemes" area
- Fix backend form sizing
- Extract backend form block "schemes_row" for customization

# 1.0.10
- Prevent attribute editing dialog from becoming narrower than configured while resizing
- Fix row button alignment dependency on table column width configuration

# 1.0.9
- Fix uploads integration
- Fix undesirable table pagination reset after deletion
- Fix loading indicator producing undesired horizontal scrollbars in certain container types

# 1.0.8
- Localize table filtering / result count language
- Fix errors finding item id in file upload fields

# 1.0.7.1
- Fix undesired application reload when pressing enter in an attribute form input
- Fix double-display of http errors occuring on save
- Fix success message language on delete / save
- Replace HTML dump error messages with readable text
- Save / load error messages now remain on screen until clicked away

# 1.0.7
- Fix openEditDialog to use passed schema
- Fix bad server-side access check for item creation; use config value `allowCreate`)
- Fix bad server-side access check for item deletion (use config value `allowDelete`)
- Fix broken "Delete" interaction being offered on newly created item data dialog
- Fix table pagination after saving new data (switch page to make new entry visible)
- Fix reliance on Mapbender template or other Elements to provide vis-ui.js requirement
- Add visual indicator for loading / http activity
- Implement per-schema configurable popup title and width, [as documented](./README.md)
- Extract Element methods support WIP Digitizer 1.4 / other child class customization

# 1.0.6.4
- Fix empty table row "ghosts" appearing when cancelling new item creation
- Fix broken file upload implementation
- Fix popup positioning when switching between object detail forms without manually closing previous popup first
- Fix broken single-scheme operation
- Fix misc client-side memory leaks
- Fix popup staying open when switching to other element in Mapbender sidepane
- Fix schema selector option encoding
- Fix backend configuration popup styling issues on current Mapbender versions
- Improve http response performance when querying single data store
- Improve http response performance when interacting with schemas with complex / expensive form item configurations
- Improve client performance when interacting with large object collections
- Resolve CSS dependencies on Digitizer
- Resolve form type incompatibilites with Symfony 3
- Resolve Mapbender Element API deprecations (backward-compatible)
- Resolve FontAwesome 5 incompatibilities
- Add [event documentation](./events.md)

# 1.0.6.3
- Nothing

# 1.0.6.2
- Extract frontend twig
- Misc updates for Mapbender internal API conventions
