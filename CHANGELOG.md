## dev-release/1.4 @ ec24700
* Fix donut drawing creating a magical new feature form instead of behaving like modification
* Fix "Save all" immediately becoming active when drawing a new feature
* Fix empty features table after deactivating and reactivating Digitizer element
* Fix inconsistent tool button state after deactivating, then reactivating Digitizer element in sidepane
* Fix errors caused by (potentially multiple) drawing tools remaining active after repeated schema switches
* Do not offer inappropriate vertex modification tool for point types (prefer moving points workflow)
* Fix missing toolset button translations for some geometry types
* Fix broken default geometry toolsets for multipoint / multiline / multipolygon types
* Fix broken in-map feature hovering while editing a geometry
* Fix broken editing style on non-polygon geometries
* Fix right-click context menu interfering with drawing tools
* Fix right-click context menu remaining open on schema change
* Fix right-click context menu remaining active when editing feature attributes
* Fix feature editing style remaining active when feature with updated geometry is saved via form
* Fix feature briefly showing with editing styles when switching schema while editing and then switching back
* Additional fixes for undesirable button color changes on focus
* When selecting a feature for editing, switch table pagination to show it

## 1.4-beta2
* Fix saving features to table with SRS different from current map view
* Fix missing response to Mapbender SRS switch
* Fix undesired map zoom when ending polygon drawing with double-click
  * Note: issue still occurs when ending polygon _editing_ with double-click
* Fix poor visualization of currently active tool button
* Fix poor visualization of save interaction acitve / disabled button states
* Add missing function of "Save all" button
* Page table view to currently edited feature when editing started via left click or context menu
* Misc translation fixes
* Misc design inconsistency fixes vs Mapbender 3.2

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
