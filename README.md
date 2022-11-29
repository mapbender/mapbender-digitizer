# Mapbender Digitizer
Show and edit spatial database contents in a Mapbender application.

Designed for use in a sidepane.

Works with Postgis and Oracle spatial data via [Mapbender Data Source layer](https://github.com/mapbender/data-source).
For database connection / table configuration, please refer to [the relevant Data Source doumentation](For database connection / table selection, please refer to [the Data Source documentation](https://github.com/mapbender/data-source#configuring-repositories).

Non-spatial related base functionality is equivalent to
[Mapbender data manager](https://github.com/mapbender/data-manager).
* [Configurable tabular listing of database contents](https://github.com/mapbender/data-manager/blob/2.0.7/README.md#configuring-tabular-item-listing)
* [Configurable forms for editing / showing data attributes](https://github.com/mapbender/data-manager/blob/2.0.7/README.md#configuring-forms)

Digitizer does not support tables without geometry columns.

# Additional schema configuration values
In addition to settings understood by Data Manager, Digitizer allows the following
extra configuration settings in a schema:

| name | type | description | default |
|---|---|---|---|
| allowDigitize | boolean | Allow geometry creation and editing (attribute editing may still be allowed via `allowEdit`) | true|
| toolset | list of strings or null | Offered geometry creation tools (see below) | Auto-detect |
| searchType | string or null | Initial state of checkbox for limiting feature loading to current visible map portion. On if exactly "currentExtent". Off for all other values | currentExtent |
| allowChangeVisibility | boolean | Offer buttons to toggle feature visibility | true |
| displayPermanent | boolean | Keep features visible on map even after switching to a different schema | false |
| displayOnInactive | boolean | Keep features visible on map even after deactivating Digitizer | false |
| continueDrawingAfterSave | boolean | Keep drawing tool active after creating and saving a new feature (~fast batch mode feature creation) | false |
| refreshLayersAfterFeatureSave | list of strings and / or numbers | Mapbender source instance ids (refer to "Layersets" tab in application backend) that will reload after any item is created, updated or deleted | -none- |

## Configuring "toolset"
If `toolset` is null or not set, and the connected feature type declares its
`geomType`, Digitizer will auto-select a compatible selection of tools to create
feature geometries.

If neither `toolset` nor the `geomType` are defined, all supported tools are offered.

If auto-detection does not produce the desired set of tools, you may specify
a list of tool names manually. Valid tool names are:
* `drawPoint` for point creation
* `drawLine` for line drawing
* `drawPolygon` for polygon drawing
* `drawRectangle`, `drawCircle`, `drawEllipse` for rectangles, circles and ellipses respectively
* `drawDonut` for polygons with interior cutouts

If `toolset` is set as an empty list, none of these tools will be offered.

If `allowDigitize` is omitted or set to true, vertex modification and feature translation tools
will also be offered.

If `allowDigitize` is set to false, the `toolset` setting will be ignored completely,
and no drawing / translating / modifying of geometries will be available at all.
