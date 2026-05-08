# DataSourceBundle Documentation

## Overview

The DataSourceBundle provides database repositories for the Mapbender Digitizer
and DataManager elements. It abstracts CRUD operations on PostgreSQL tables,
with optional PostGIS geometry support.

### Key concepts

- **DataStore**: Repository for non-spatial data (used by DataManager)
- **FeatureType**: Repository for spatial data with PostGIS geometry (used by Digitizer)
- **PropertyAdapter**: Pluggable strategy for how properties are stored
  - `columns` mode (default): each property is a separate database column
  - `json` mode: all properties in a single JSONB column

### File structure

```
DataSourceBundle/
  Component/
    DataStore.php                         # Non-spatial repository
    FeatureType.php                       # Spatial repository (extends DataStore)
    RepositoryRegistry.php                # Factory registry and caching
    Factory/
      DataStoreFactory.php                # Creates DataStore from config
      FeatureTypeFactory.php              # Creates FeatureType from config
    PropertyAdapter/
      PropertyAdapterInterface.php        # Adapter contract
      DiscreteColumnAdapter.php           # One column per property
      JsonColumnAdapter.php               # JSONB column for all properties
  Entity/
    DataItem.php                          # Non-spatial row entity
    Feature.php                           # Spatial row entity (extends DataItem)
  Utils/
    WktUtility.php                        # WKT/EWKT parsing helpers
  Resources/
    config/services.xml                   # Symfony service definitions
    views/fields.html.twig                # Form field templates
  MapbenderDataSourceBundle.php           # Bundle class
```

---

## Configuration Reference

### DataStore (DataManager)

Used for non-spatial tabular data.

```yaml
schemes:
  my_schema:
    dataStore:
      connection: default              # Doctrine DBAL connection name
      table: my_table                  # Table name (supports "schema"."table")
      uniqueId: id                     # Primary key column (default: "id")
      fields: [name, email, status]    # Column list; omit for auto-detect
      filter: "active = true"          # Permanent SQL WHERE fragment
      propertyStorage: columns         # "columns" (default) or "json"
    # ... formItems, table, popup, etc.
```

### FeatureType (Digitizer)

Used for spatial data with PostGIS geometry.

```yaml
schemes:
  parcels:
    featureType:
      connection: default
      table: public.parcels
      uniqueId: gid
      geomField: the_geom             # Geometry column (default: "geom")
      srid: 25832                      # Storage SRID; auto-detected if omitted
      fields: [name, area, owner]      # Property columns; omit for auto-detect
      filter: "deleted = false"
      propertyStorage: columns         # "columns" (default) or "json"
    # ... formItems, table, popup, styles, etc.
```

### All configuration keys

| Key              | Type       | Default      | Description                                          |
|------------------|------------|--------------|------------------------------------------------------|
| `connection`     | string     | `"default"`  | Doctrine DBAL connection name                        |
| `table`          | string     | **required** | Table name. Supports schema: `"schema"."table"`      |
| `uniqueId`       | string     | `"id"`       | Primary key column name                              |
| `fields`         | array/null | `null`       | Columns to use; `null` = auto-detect all             |
| `filter`         | string     | `null`       | Permanent SQL WHERE. Supports `:userName` placeholder |
| `geomField`      | string     | `"geom"`     | Geometry column (FeatureType only)                   |
| `srid`           | int        | auto-detect  | Storage SRID (FeatureType only)                      |
| `propertyStorage`| string     | `"columns"`  | `"columns"` or `"json"`                              |
| `propertyColumn` | string     | `"properties"`| JSONB column name (when `propertyStorage: json`)    |
| `events`         | array      | `[]`         | **DEPRECATED**, accepted but ignored                 |

---

## Property Storage Modes

### Mode: `columns` (default, backward-compatible)

Each property maps 1:1 to a table column. This is the classic behavior
and what all existing configurations use.

```
Table: parcels
 gid | the_geom          | name       | area    | owner
-----+-------------------+------------+---------+-------
   1 | POLYGON((...))    | Parcel A   | 1250.5  | smith
   2 | POLYGON((...))    | Parcel B   | 890.2   | jones
```

Configuration:
```yaml
featureType:
  table: parcels
  uniqueId: gid
  geomField: the_geom
  srid: 25832
  # propertyStorage: columns  ← this is the default, no need to specify
```

If `fields` is omitted, all columns are auto-detected from the table schema.
If `fields` is specified, only those columns are used.

### Mode: `json`

All properties are stored in a single JSONB column. The table has a
minimal fixed schema:

```
Table: digitizer_features
 id | geom              | properties
----+-------------------+------------------------------------------
  1 | POLYGON((...))    | {"name": "Parcel A", "area": 1250.5, ...}
  2 | POLYGON((...))    | {"name": "Parcel B", "area": 890.2, ...}
```

Configuration:
```yaml
featureType:
  table: digitizer_features
  uniqueId: id
  geomField: geom
  srid: 4326
  propertyStorage: json
  propertyColumn: properties    # default, can be omitted
```

To create the table:

```sql
CREATE TABLE digitizer_features (
    id SERIAL PRIMARY KEY,
    geom geometry(Geometry, 4326),
    properties JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_digitizer_features_geom ON digitizer_features USING GIST (geom);
CREATE INDEX idx_digitizer_features_props ON digitizer_features USING GIN (properties);
```

For DataManager (non-spatial), omit the geom column:

```sql
CREATE TABLE my_data (
    id SERIAL PRIMARY KEY,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_my_data_props ON my_data USING GIN (properties);
```

### When to use which mode

| Use case | Mode |
|----------|------|
| Existing table with individual columns | `columns` |
| New project, schema may evolve often | `json` |
| Need SQL-level queries on properties | `columns` |
| Many schemas with few properties each | `json` |
| Properties vary per record | `json` |
| Need database-level constraints | `columns` |

---

## Backward Compatibility

### Old configurations work unchanged

Existing configurations that don't use `propertyStorage` or `propertyColumn`
default to `propertyStorage: columns`, which behaves identically to the
previous DataSourceBundle.

### API surface preserved

All class names, namespaces, and method signatures that DataManager and
Digitizer use are preserved:

- `Mapbender\DataSourceBundle\Component\DataStore`
- `Mapbender\DataSourceBundle\Component\FeatureType`
- `Mapbender\DataSourceBundle\Component\RepositoryRegistry`
- `Mapbender\DataSourceBundle\Entity\DataItem`
- `Mapbender\DataSourceBundle\Entity\Feature`
- Service IDs: `mbds.default_datastore_factory`, `mbds.default_featuretype_factory`

### What was removed

| Removed | Reason |
|---------|--------|
| Oracle driver | Not used; PostgreSQL only |
| SQLite driver | Not used; PostgreSQL only |
| Multi-database driver abstraction | Replaced by direct PostGIS SQL |
| `EventProcessor` (eval-based events) | Security concern, rarely used |
| `Expression` class | Geometry SQL built inline |
| `FeatureQueryBuilder` | Logic merged into FeatureType |
| `DataRepository` / `EventAwareDataRepository` | Merged into DataStore |
| `DataStoreService` / `FeatureTypeService` | Already deprecated |
| `TableMeta` / `Column` metadata classes | Replaced by DBAL introspection |
| `BaseXmlLoaderExtension` | Already deprecated |

### `events` configuration key

The `events` key is still accepted in configuration to avoid parse errors,
but the expressions are no longer executed. If you need lifecycle hooks,
use Symfony's EventDispatcher instead.

---

## PostGIS Geometry Handling (FeatureType)

### SELECT (reading features)

Geometry is returned as EWKT, optionally transformed to a target SRID:

```sql
SELECT id, col1, col2,
       ST_AsEWKT(ST_Transform("geom", 4326)) AS "geom"
FROM parcels
```

The `srid` criteria parameter controls the output SRID.

### INSERT

```sql
INSERT INTO parcels (col1, col2, "geom")
VALUES (?, ?, ST_MakeValid(ST_Transform(ST_GeomFromEWKT(?), 25832)))
RETURNING "gid"
```

### UPDATE

```sql
UPDATE parcels
SET col1 = ?, col2 = ?,
    "geom" = ST_MakeValid(ST_Transform(ST_GeomFromEWKT(?), 25832))
WHERE "gid" = ?
```

### Spatial filtering (intersect)

When the Digitizer sends a map extent, features are filtered with:

```sql
ST_Intersects("geom", ST_Transform(ST_GeomFromEWKT(?), 25832))
```

### Multi-geometry promotion

If the table column type is `MULTIPOLYGON` but the incoming geometry is
`POLYGON`, it is automatically wrapped with `ST_Multi()`.

### SRID auto-detection

If `srid` is not configured, it is read from the PostGIS `geometry_columns`
system view:

```sql
SELECT srid FROM geometry_columns
WHERE f_table_name = ? AND f_table_schema = ? AND f_geometry_column = ?
```

For materialized views or other cases where this fails, configure `srid`
explicitly.

---

## Repository API

### DataStore methods

```php
$store->getConnection(): Connection     // DBAL connection
$store->getTableName(): string          // Quoted table name
$store->getUniqueId(): string           // Primary key column
$store->getFields(): array              // All field names
$store->getPlatformName(): string       // e.g. "postgresql"

$store->search(array $criteria): DataItem[]
$store->getById($id): ?DataItem
$store->count(array $criteria): int
$store->save($itemOrData): DataItem     // Auto-detect insert/update
$store->insert($itemOrData): DataItem
$store->update($itemOrData): DataItem
$store->remove($itemOrId): ?int         // Returns deleted row count

$store->itemFactory(): DataItem         // New empty item
$store->itemFromArray(array): DataItem  // Item from attributes
```

### FeatureType additional methods

```php
$ft->getGeomField(): string             // Geometry column name
$ft->getSrid(): int                     // Storage SRID(auto or configured)
$ft->getById($id, $srid): ?Feature      // With optional SRID transform
$ft->itemFactory(): Feature
$ft->itemFromArray(array): Feature
```

### Search criteria

```php
$criteria = [
    'maxResults' => 100,                 // LIMIT
    'where'      => 'status = 1',        // Additional SQL WHERE
    'srid'       => 4326,                // Output SRID (FeatureType)
    'intersect'  => 'POLYGON((......))',  // Spatial filter WKT (FeatureType)
];
```

### DataItem / Feature entities

```php
$item->getId()
$item->setId($id)
$item->getAttributes(): array
$item->getAttribute($name): mixed
$item->setAttributes(array $attrs)      // Merges into existing
$item->setAttribute($key, $value)
$item->toArray(): array                 // All attributes

// Feature only:
$feature->setGeom($wkt)                 // Set geometry (WKT or EWKT)
$feature->getGeom(): ?string            // Get WKT (no SRID prefix)
$feature->getEwkt(): ?string            // Get EWKT (with SRID prefix)
$feature->getSrid(): ?int
$feature->setSrid($srid)
$feature->getType(): ?string            // e.g. "POLYGON"
```

---

## Extending: Custom Property Adapters

Implement `PropertyAdapterInterface` for custom storage strategies:

```php
use Mapbender\DataSourceBundle\Component\PropertyAdapter\PropertyAdapterInterface;

class MyCustomAdapter implements PropertyAdapterInterface
{
    public function getSelectColumns(): array
    {
        // Return column names to SELECT
    }

    public function extractProperties(array $row): array
    {
        // Convert DB row to property key-value pairs
    }

    public function prepareStorageData(array $properties): array
    {
        // Convert properties to column => value for INSERT/UPDATE
    }
}
```

Override `DataStore::createPropertyAdapter()` or `FeatureType::createPropertyAdapter()`
to use your custom adapter based on configuration.

---

## Example Configurations

### Digitizer with classic columns

```yaml
schemes:
  buildings:
    label: Buildings
    featureType:
      connection: default
      table: public.buildings
      uniqueId: gid
      geomField: the_geom
      srid: 25832
    allowEdit: true
    allowCreate: true
    allowDelete: true
    popup:
      title: Edit Building
      width: 550px
    table:
      columns:
        - { data: name, title: Name }
        - { data: floors, title: Floors }
    formItems:
      - type: input
        name: name
        title: Building Name
      - type: input
        name: floors
        title: Number of Floors
```

### Digitizer with JSONB storage

```yaml
schemes:
  poi:
    label: Points of Interest
    featureType:
      connection: default
      table: poi_features
      geomField: geom
      srid: 4326
      propertyStorage: json
      propertyColumn: properties
    allowEdit: true
    allowCreate: true
    popup:
      title: Edit POI
    formItems:
      - type: input
        name: name
        title: Name
      - type: select
        name: category
        title: Category
        options:
          - { label: Restaurant, value: restaurant }
          - { label: Hotel, value: hotel }
          - { label: Shop, value: shop }
```

### DataManager with JSONB storage

```yaml
schemes:
  notes:
    label: Notes
    dataStore:
      connection: default
      table: app_notes
      propertyStorage: json
    allowEdit: true
    allowCreate: true
    allowDelete: true
    formItems:
      - type: input
        name: title
        title: Title
      - type: textArea
        name: content
        title: Content
```

### User-filtered data

```yaml
schemes:
  my_items:
    label: My Items
    dataStore:
      connection: default
      table: user_items
      filter: "owner = :userName"
    filterUser: true
    trackUser: true
    userColumn: owner
    formItems:
      - type: input
        name: description
        title: Description
```

---

## Migration Guide

### From old DataSourceBundle

1. **No configuration changes needed** — old YAML configs work as-is
2. **Remove `events` if used** — eval-based events are no longer executed.
   Migrate to Symfony EventDispatcher if lifecycle hooks are needed.
3. **Oracle/SQLite** — if you used these databases, they are no longer
   supported. Migrate to PostgreSQL.
4. **Custom code** — if you extended `DataRepository`,
   `EventAwareDataRepository`, or used the driver classes directly, update
   your code to work with the new `DataStore` / `FeatureType` API.

### Adopting JSONB mode for new schemas

1. Create the table with the SQL from the "Mode: json" section above
2. Add `propertyStorage: json` to your featureType/dataStore config
3. Form field `name` attributes now map to JSON keys instead of column names
4. Everything else (formItems, table columns, popup) works the same
