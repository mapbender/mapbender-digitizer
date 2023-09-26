## 0.2.8
* Fix user role formatting with custom user providers implementing Symfony >= 4.3 api properly
* Resolve Symfony >= 4.3 deprecations injecting user role names into custom event scope
* Resolve Doctrine DBAL >= 2.11 deprecations / DBAL 3.x errors

## 0.2.7
* Fix errors saving boolean values into numeric column (convert to 0 or 1)

## 0.2.6
* Re-add support for explicitly preconfiguring source table srid on FeatureType; only used if detection fails (e.g. views using geometry expressions)

## 0.2.5
* Fix missing detection for native double precision columns when picking default for non-nullable numeric column (see [Mapbender #1396](https://github.com/mapbender/mapbender/issues/1396))
* Fix explicitly entered "0" not saving to nullable numeric columns

## 0.2.4
* Fix incompatibility with current doctrine/doctrine-bundle

## 0.2.3
* Fix geometries returned from insert reverting to table native CRS
* Fix error in save method if saving was aborted by a custom event

## 0.2.2
* Fix error in first invocation of getDataStoreByName

## 0.2.1
* Fix missing id on inserted item

## 0.2.0

Symfony 4+ conformance and pruning of legacy complexity.

* Extend magic :userName filter param support also to "where" param passed into search / count
* Removed Symfony 4-incompatible BaseElement class
* Removed Symfony 4-incompatible global default services `data.source` and `featureTypes`. Access should be replaced with a self-defined service. Use RepositoryRegistry base class and inject the appropriate factory.
* Removed geojson briding and phayes/geophp dependency
* Removed legacy export bridging logic
* Removed tolerance / preprocessing for SQL-illegal quotes around `:userName` parameter binding in `filter` setting
* Removed undocumented Postgis only "source" + "distance" search parameter handling (use "intersect")
* Removed legacy bridging logic for vis-ui file uploads (getFileUri etc)
* Removed variadic return type support from getByIds (always returns DataItem[] / Feature[])
* Removed ill-advised Pgrouting integration
* Removed ill-advised legacy "tree" logic (getTree, getParent, getChildren etc)
* Removed ill-advised "mapping" logic (perform a separate search on the target repository)
* Removed support for events before / after search; configure a "filter" SQL expression or pass a "where"
* Removed FeatureTypeService::search method
* Removed public access to "driver" internals
* Removed variadic DataStore / FeatureType "get" method (use getById)
* Removed variadic DataStore / FeatureType "delete" method argument support
* Removed support for any non-array, non-DataItem arguments to save, update, insert
* Removed project support hack replacing malformed EWKT with empty point EWKT on storage; users must supply sane geometries
* Removed support for automatic yaml file parsing when constructing FeatureTypeService

NOTE: there are no longer any considerations for external calls to FeatureType / DataStore constructors. Use the appropriate
factory service (`mbds.default_datastore_factory` or `mbds.default_featuretype_factory`) to instantiate
DataStore / FeatureType manually.

NOTE: Users requiring a registry of multiple DataStores / FeatureTypes, to replace removed
`data.source` and `featureTypes` services, must define their own service. Use
RepositoryRegistry and inject the appropriate factory plus DataStore / FeatureType configs.
DataStoreService and FeatureTypeService classes are and will remain incompatible with
Symfony 4.

## 0.1.30
* Fix errors saving boolean values into numeric column (convert to 0 or 1)

## 0.1.29
* Re-add support for explicitly preconfiguring source table srid on FeatureType; only used if detection fails (e.g. views using geometry expressions)

## 0.1.28
* Fix missing detection for native double precision columns when picking default for non-nullable numeric column (see [Mapbender #1396](https://github.com/mapbender/mapbender/issues/1396))
* Fix explicitly entered "0" not saving to nullable numeric columns

## 0.1.27
* Fix incompatibility with current doctrine/doctrine-bundle

## 0.1.26
* Fix geometries returned from insert reverting to table native CRS

## 0.1.25
* Fix error in first invocation of getDataStoreByName

## 0.1.24
* Fix connection access error when using plain RepositoryRegistry (Sf4 conformant version of DataStoreService / FeatureTypeService)

## 0.1.23
* Fix missing id on inserted item
* Fix registry constructor signature incompatibility with 0.2.x

## 0.1.22
* Fix DataStore vs FeatureType event handling differences
* Fix Feature::getType
* Fix geometry not available from Feature::getAttributes
* Fix getByIds method not available on plain DataStore, only on FeatureType
* Fix errors updating / reinserting any items returned from (deprecated) "getTree"
* Oracle: fix error detecting column names (without explicit `fields` setting)
* Oracle: fix missing column identifier quoting in intersect condition
* PostgreSQL: fix errors on tables with mixed / uppercase column names
* Fix unreliable type (sometimes array, sometimes DataItem / Feature) of "item" value in save events
* Fix inconsistent item data renormalization "save" method (item reloaded + renormalized) vs direct usage of "update" / "insert" methods (item passed back as is)
* Fix item attribute name renormalization not respecting case of explicitly configured fields
* Strictness: referencing non-existant columns in explicitly configured `fields` is now an error
* Strictness: explicitly configured "fields" can no longer be quoted or aliased; use strictly column names
* Strictness: including `*` in explicitly configured "fields" will now cause errors; use strictly column names, or leave fields completely empty
* Strictness: mis-cased configuration values are no longer valid
* Ignore `srid` setting (always detect from database)
* Add `count` method on DataStore / FeatureType (same argument style as `search` method)
* Add standalone DataStore / FeatureType factory services (`mbds.default_datastore_factory`, `mbds.default_featuretype_factory`)
* Resolve / mark misc internal deprecations
* Misc restructuring for Symfony 4+ compatibility
* Update documentation

## 0.1.21
* PostgreSQL: fix mistyped update / insert column value when submitting an empty string to column of ~numeric type
* PostgreSQL: fix mistyped column values on insert / errors inserting incomplete data in row with incomplete defaults definition
* Make DataStore insertItem method public (like updateItem)
* Resolve / mark misc internal deprecations

## 0.1.20
- Extend file upload support to both DataStore and FeatureType (previously only FeatureType)

## 0.1.19
- Fix potentially broken id of newly saved items / features on PostgreSQL
- Fix FeatureType::insert method accepting prepopulated id
- Fix geometry type detection on valid WKT with empty coordinates
- Fix Ewkt handling in Feature::setGeom

## 0.1.18
- Fix reprojection errors on insert
- Fix Postgis column srid detection
- Fix intersection query errors with small intersect geometries on degree-based CRS
- Prefer database-detected column srid over (error prone) `srid` value from feature type configuration
- Run all insert / update geometries through `ST_MakeValid` on Postgis to avoid collateral intersection query errors

## 0.1.17
- Fix DataStore-only errors on updates with reserved words as column names (e.g. PostgreSQL "public")
- Fix SELECT queries with reserved words as column names (e.g. PostgreSQL "public")
- Fix UPDATEs and INSERTs writing values to type BOOLEAN columns on PostgreSQL
- Fix inability to write NULL into nullable columns with non-null defaults on INSERT on PostgreSQL
- Fix PHP7.0 method signature error ([PR#15](https://github.com/mapbender/data-source/pull/15/files))
- Fix Postgis intersection condition not matching self-intersecting geometries
- Fix row loading limit
- Added misc BaseElement child class customization support methods
  * `getDataStoreKeyInSchemaConfig`
  * `getDataStoreKeyInFormItemConfig`

## 0.1.16.2
- Fix Oracle bounding-box intersection query ([PR#14](https://github.com/mapbender/data-source/pull/14))
- Fix DataStore empty item initialization

## 0.1.16.1
- Fix DataStore getById
- Fix error handling when saving

## 0.1.16
- Fix Feature initialization from GeoJSON: respect configured `geomField`, apply optional non-standard embedded `srid` and `id` correctly
- Fix broken data format in Oracle::prepareResults
- Fix exception on table miss in DataStore::getById, return null instead
- Change FeatureType::getById return value on table miss from `false` to `null`
- Support `:userName` filter binding also in DataStore::search (previously only in FeatureType::search)
- Escape `:userName` properly in FeatureType::search and DataStore::search
- Escape `:distance` in FeatureType::search (now a bound param)
- Extract FeatureType / DataStore method `addCustomSearchCritera` method for customization support
- Add DataStoreService::getDbalConnectionByName method
- `getUniqueId` and `getTablename` methods are now also available on DataStore object (previously only FeatureType)
- Deprecate DataItem construction with a (jsonish) string
- Deprecate magic Feature::__toString invocation
- Make tests with missing prerequisites fail instead of skip

## 0.1.15
- Fix broken select item options when combining static options with `sql`-path options
- Customization support: extracted methods from `BaseItem::prepareItem`
  - prepareSelectItem
  - formatSelectItemOption
  - formatStaticSelectItemOptions
  - prepareSqlSelectItem
  - formatSqlSelectItemOption
  - prepareDataStoreSelectItem
  - prepareServiceSelectItem
  - getDataStoreService
  - getDbalConnectionByName
- Disambiguate `DataStoreService::get` and `FeatureTypeService::get` by adding `getDataStoreByName` and `getFeatureTypeByName` methods
  - Extract factory methods for customization support
- Remove invalid default service id `default` from dataStore select item path; `serviceName` is no longer optional
- Log warning on redundant combination of "dataStore" / "sql" / "service" select item configuration
- Emit more specific errors for missing / type mismatched driver configuration values

