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
