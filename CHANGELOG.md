## 1.4-beta1
* Compatible with Openlayers 4/5/6 only
* Compatible with Mapbender >=3.2.1 only
* Modified geometries can now be saved without going through the attribute editing form, through the (per-feature) save button, and in bulk through a global save all button
* Per-feature and global visibility toggles are now available by default
* Fix misc FontAwesome 5+ incompatibilities
* Fix "ghost rows" appearing in table when aborting new feature drawing
* Fix aggressive automatic re-pagination of table on feature hover; page only changes to show new row after creating new feature
* Provide reasonable default toolset based on schema's configured geometry type
* Add localization for tool buttons and misc table-related texts
* Removed schema config values:
  * `useContextMenu`; context menu is always on when appropriate
  * `zoomScaleDenominator`; features are buffered automatically
  * `openFormAfterEdit`; always needed to be true to avoid bugs; pure geometry modification of _already_ _saved_ features can be saved explicitly
  * `allowCancelButton`; edit dialogs can always be closed
  * `allowDeleteByCancelNewGeometry`; always needed to be true to avoid dataTables exceptions
  * `featureType`: `maxResults`; any value would eventually become too low and cause errors; use current extent search to limit loaded feature volume

## 1.1.72.1
* Fix 1.1.72 Regression: restore form type compatibility with Mapbender <= 3.0.8.4

## 1.1.72
* Resolve form type incompatibilities with Symfony 3
* Resolve Request evaluation incompatibilities with Symfony 3
* Improve performance of save / schema switch with many complex schemas (SQL-generated select options etc)
* Fix SHIFT+Tab block unindent in backend form
* Extract Element methods for child class customization:
  * getFeatureTypeService
  * getDataStoreService
  * getFeatureTypeConfig
  * getFeatureTypeConfigForSchema
  * getFeatureTypeForSchema
  * getSchemaConfigs
  * getSchemaConfig
  * getFileUri 
