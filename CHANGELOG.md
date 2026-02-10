## next bugfix release
* Add support for DataTables version 2 ([PR#150](https://github.com/mapbender/mapbender-digitizer/pull/150))
* Show message after asynchronous requests for expired sessions with option to retry ([PR#151](https://github.com/mapbender/mapbender-digitizer/pull/151))

## 2.0.7
* Add file type check to form type `file` (key: `allowedFileTypes`) ([PR#147](https://github.com/mapbender/mapbender-digitizer/pull/147))

## 2.0.6
* Show error message when a YAML syntax error occurs in manager ([PR#145](https://github.com/mapbender/mapbender-digitizer/pull/145))
* Fix popup width & height was ignored ([PR#146](https://github.com/mapbender/mapbender-digitizer/pull/146))

## 2.0.5
* Add tooltips to digitizer buttons ([PR#140](https://github.com/mapbender/mapbender-digitizer/pull/140))

## 2.0.4
* Enable dynamic feature data support for type: html ([PR#138](https://github.com/mapbender/mapbender-digitizer/pull/138)) 
* Allow quoted schema or table names in PostgreSQL connection ([#1745](https://github.com/mapbender/mapbender/issues/1745), [PR#139](https://github.com/mapbender/mapbender-digitizer/pull/139)) 

## 2.0.3
* updateMultiple now returns a Promise; TableRenderer includes addOrRefreshRow for automatic feature handling post-AJAX call; unique namespace ID for unsaved features enables updates post-AJAX; oldGeometry set after successful updateMultiple call. ([PR#133](https://github.com/mapbender/mapbender-digitizer/pull/133))
* prevent Draw Donut On Non-Digitizer Features ([PR#120](https://github.com/mapbender/mapbender-digitizer/pull/120))
* Enable CSS styling in FormItem for images, and allow images to be displayed in their original size with the EnlargeImage attribute ([PR#134](https://github.com/mapbender/mapbender-digitizer/pull/134)) 
* Digitizer showed tool icons to edit feature-geometries even when digitizing is disabled ([#1647](https://github.com/mapbender/mapbender/issues/1647), [PR#135](https://github.com/mapbender/mapbender-digitizer/pull/135))
* Saving new geometries was not possible when allowEdit was not set ([PR#135](https://github.com/mapbender/mapbender-digitizer/pull/135))

## 2.0.2
* Enable creation of several features at once ([PR#131](https://github.com/mapbender/mapbender-digitizer/pull/131))
* Fix `trackUser` and `filterUser` in digitizer config ([PR#132](https://github.com/mapbender/mapbender-digitizer/pull/132))

## 2.0.1
* Enable immediate update of the feature table in the data manager ([PR#130](https://github.com/mapbender/mapbender-digitizer/pull/130))

## 2.0.0
* Remove bug that allowed a feature to revert to a status it had before the last save. ([PR#123](https://github.com/mapbender/mapbender-digitizer/pull/123))
* Prevent Draw Donut On Non-Digitizer Features ([PR#120](https://github.com/mapbender/mapbender-digitizer/pull/120))
* Prevent self intersection of polygons not only on modification, but on creation as well ([PR#118](https://github.com/mapbender/mapbender-digitizer/pull/118))
* Allow leaving modification mode on pressing escape ([PR#118](https://github.com/mapbender/mapbender-digitizer/pull/118))
* Allow deletion of vertices on single click ([PR#118](https://github.com/mapbender/mapbender-digitizer/pull/118))
* Prevent self intersection of polygons  ([PR#118](https://github.com/mapbender/mapbender-digitizer/pull/118))
* Enable ContextMenu for overlapping features ([PR#116](https://github.com/mapbender/mapbender-digitizer/pull/116))
* Enable loading source refresh by layer name ([PR#115](https://github.com/mapbender/mapbender-digitizer/pull/115))
* Introduce param schema.copy.deactivateOffset - if set to true, no offset is used when copying feature ([PR#113](https://github.com/mapbender/mapbender-digitizer/pull/113))
* Mandatory fields in the form are marked with a red border
* Integrated snap functionality - mouse pointer snaps to every vector geometry
* Integrated DataManagerBundle into this repository (changelog for earlier versions: https://github.com/mapbender/data-manager/blob/master/CHANGELOG.md)
* Integrated DataSourceBundle into this repository (changelog for earlier versions: https://github.com/mapbender/data-source/blob/master/CHANGELOG.md)
* Ensure compatibility with Mapbender 4 / Symfony 5.4
* Translation enhancements ([PR#96](https://github.com/mapbender/mapbender-digitizer/pull/96))
* Rename translation files from .yml to .yaml ([PR#98](https://github.com/mapbender/mapbender-digitizer/pull/98))
* Allow specific message for error when not logged in ([PR#98](https://github.com/mapbender/mapbender-digitizer/pull/98))
* Repair Radiobutton ([PR#98](https://github.com/mapbender/mapbender-digitizer/pull/98))
* Add default whitepace: pre-line in text fields to keep formatting ([PR#98](https://github.com/mapbender/mapbender-digitizer/pull/98))
* Allow to set text area height by providing row attribute  ([PR#98](https://github.com/mapbender/mapbender-digitizer/pull/98))
* Add option `paging` on root level to disable paging ([PR#99](https://github.com/mapbender/mapbender-digitizer/pull/99))
* Allow to set maximumSelectionLength in select2 (type select) ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Make 'eval' in change event error safe ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Allow labelOutline properties in styleAdapter (labelOutlineColor, labelOutlineWidth, labelYOffset, labelXOffset) ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Adjust copy symbol ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101)) 
* Adjust border display of mandatory fields (inputs, select, select2, textarea) ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Adjust display of refresh button  ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Allow popup.modal and popup.position  ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Allow zoomBuffer parameter ([PR#101](https://github.com/mapbender/mapbender-digitizer/pull/101))
* Replace deprecated 'userName' parameter setting in query builder by contemporary solution ([PR#102](https://github.com/mapbender/mapbender-digitizer/pull/102))
* Added spanish translation ([PR#103](https://github.com/mapbender/mapbender-digitizer/pull/103))
* Use allowRefresh of subschemas in combined schema ([PR#108](https://github.com/mapbender/mapbender-digitizer/pull/108))
* Add empty "adjustStyle" Method that can be overriden if application makes use of attibute-based styles.  ([PR#109](https://github.com/mapbender/mapbender-digitizer/pull/109))
* Add default getSnappingLayers Method that can be overriden if application makes use of more snapping layers ([PR#110](https://github.com/mapbender/mapbender-digitizer/pull/110))
* Standardized button style using bootstrap css classes ([PR#111](https://github.com/mapbender/mapbender-digitizer/pull/111))
* Some style changes in Bootstrap css classes ([PR#121](https://github.com/mapbender/mapbender-digitizer/pull/121))

## 1.5.7
* Rewrite context menu for Openlayers 7 compatibility

## 1.5.6
* Reimplement "refreshLayersAfterFeatureSave" (lost Digitizer ~1.2ish feature)
* Allow documented DataManager-style table configuration
* Add configuration documentation

## 1.5.5
* Fix css inconsistencies between style editor and other dialogs

## 1.5.4
* Fix donut drawing errors on Openlayers 6.14

## 1.5.3
* Fix feature details not viewable through context menu / click inside map if editing disabled
* Use different fallback detail popup titles for editable vs read-only objects

## 1.5.2
* Support styling features with icons (interpret `externalGraphic`, `graphicWidth`, `graphicHeight` properties)
* Support data placeholder syntax in `externalGraphic` (e.g. "/bundles/projectbundle/images/${type}.png")

## 1.5.1
* Fix initialization errors if MapbenderDataSourceBundle is not registered in kernel

## 1.5.0
* Reimplement as Symfony 4-conformant element service
* Fix implicit robloach/component-installer dependency (include select2 assets directly from vendor)

NOTE: This version is ncompatible / not installable with Mapbender versions before v3.2.6.

## 1.4.14
* Fix donut drawing errors on Openlayers 6.14

## 1.4.13
* Fix feature details not viewable through context menu / click inside map if editing disabled
* Use different fallback detail popup titles for editable vs read-only objects

## 1.4.12
* Support styling features with icons (interpret `externalGraphic`, `graphicWidth`, `graphicHeight` properties)
* Support data placeholder syntax in `externalGraphic` (e.g. "/bundles/projectbundle/images/${type}.png")

## 1.4.11
* Fix initialization errors if MapbenderDataSourceBundle is not registered in kernel
* Fix implicit robloach/component-installer dependency (include select2 assets directly from vendor)
* Switch featuretype registry to conform with Symfony 4 (requires data-source >= 0.1.22)

## 1.4.10
* Fix error trying to access files from (not used, not required) medialize/jquery-context-menu package

## 1.4.9
* Fix client errors processing rows with null geometry (null geometry rows are completely excluded from database select)
* Fix initially inactive Digitizer showing geometries on initialization
* Fix interpretation of per-schema settings `displayOnInactive` and `displayPermanent`
* Allow per-schema `maxResults` setting (integer; optional) to limit data volume

## 1.4.8
NOTE: this version requires Mapbender >=3.2.5 (currently in RC phase) and will not install with older versions

* Fix error processing feature style with labels but without explicit `fontColor` setting
* Support data placeholder syntax (`${column_containing_a_color}`) also in styles also for `fillColor`, `strokeColor` and `fontColor` settings
* Reduce feature styling performance overhead
* Drop dependency on mapbender/ol4-extensions package
* Improve line dash styles

## 1.4.7
* Fix errors accessing globally defined featureType referenced by name from schema config ([MB#1337](https://github.com/mapbender/mapbender/issues/1337))

## 1.4.6
* Support automatically disabling drawing tool after saving (see [PR#87](https://github.com/mapbender/mapbender-digitizer/pull/87))
* Fix table-embedded save buttons remaining active after successful bulk save
* Fix style editor invisible opacity sliders
* Fix style editor changes not applying until next feature reload
* Fix style editor basic layout and field label translations
* Fix style editor leaking dialog instances
* Remove style editor dependencies on vis-ui (implicitly provided by data-manager)

## 1.4.5
* Fix missing edit dialog when clicking on the same feature again

## 1.4.4
* Fix backend form browser text searchability through off-screen portions of "schemes" area
* Fix backend form sizing

## 1.4.3
* Fix missing column titles

## 1.4.2
* Fix modified feature reload protection to also apply to features just created in the same session

## 1.4.1
* Fix unsaved feature modifications getting lost when reloading features on map movement

## 1.4
* Fix handling of layer visiblity options displayOnInactive and displayPermanent (+ combination)
* Fix current attribute editing popup staying open when deactivating via Mapbender sidepane
* Fix drawing tool switching remaining available while editing feature attributes
* Fix geometry editing selection remaining active with an open attribute editing dialog
* Fix geometry modification revert integration; use right-click context menu
* Fix broken temporary geometry when using Mapbender SrsSwitcher while drawing lines or polygons
* Fix broken revert geometry after using Mapbender SrsSwitcher
* Fix broken revertable geometry detection when modifying vertices
* Fix drawing tools responding to right mouse button clicks, conflicting with context menu
* Fix reverting geometry edits on the same feature multiple times without saving
* Fix reverting geometry edits after saving modified geometry
* Fix switch back to vertex modification not working after modifying, then moving the same feature
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
* Clean up misc translation punctuation

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

## 1.1.73
* Fix misc side effects of formItems runtime modifications from one feature affecting other features
* Fix backend form browser text searchability through off-screen portions of "schemes" area
* Fix backend form sizing
* Resolve DataStore variadic `get` deprecation

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
