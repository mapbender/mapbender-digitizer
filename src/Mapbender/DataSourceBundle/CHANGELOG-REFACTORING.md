# DataSourceBundle Refactoring — Detailed Change Log

## Summary

The DataSourceBundle was refactored from a multi-database-driver architecture
with eval-based event processing into a streamlined, PostgreSQL/PostGIS-focused
design using a **PropertyAdapter** strategy pattern for flexible property storage.

The new architecture is simpler, more secure, and forward-compatible with
Symfony's deprecation of `getListTableColumnsSQL` and full-container injection.

---

## Architecture Changes

### Before (Old Architecture)

```
DataRepository (base CRUD, driver-abstracted)
├── driverFactory() → DoctrineBaseDriver subclass
├── EventAwareDataRepository (eval-based lifecycle hooks)
├── FeatureQueryBuilder (custom QueryBuilder for geometry SQL)
└── Drivers/
    ├── DoctrineBaseDriver (abstract: insert/update/loadTableMeta)
    ├── PostgreSQL (implements Geographic interface)
    ├── Oracle (implements Geographic interface)
    ├── SQLite (no geometry support)
    └── Interfaces/Geographic (geometry SQL contract)

DataStore (extended DataRepository — container-aware)
FeatureType (extended DataStore — geometry via FeatureQueryBuilder + Geographic driver)

DataStoreService / FeatureTypeService (deprecated, full-container injection)
RepositoryRegistry (Symfony 4+ replacement for Service classes)

Factory/
    DataStoreFactory → new DataStore(connection, tokenStorage, eventProcessor, config)
    FeatureTypeFactory → new FeatureType(...)

Meta/
    TableMeta (column metadata for insert/update preparation)
    Column (per-column metadata: nullable, hasDefault, isNumeric, geometryType, srid)
```

### After (New Architecture)

```
DataStore (standalone CRUD, no driver abstraction)
├── PropertyAdapter (strategy for property storage)
│   ├── DiscreteColumnAdapter (one column per property — classic mode)
│   └── JsonColumnAdapter (all props in JSONB column — new mode)
├── Direct SQL via DBAL QueryBuilder
└── Geometry: none (non-spatial)

FeatureType (extends DataStore — geometry via inline PostGIS SQL)
├── Inherits PropertyAdapter from DataStore
├── ST_AsEWKT / ST_GeomFromEWKT / ST_Transform / ST_MakeValid
├── ST_Intersects for spatial filtering
├── ST_Multi for auto-promotion to multi-geometry
└── SRID auto-detection from geometry_columns

RepositoryRegistry (unchanged — factory cache layer)

Factory/
    DataStoreFactory → new DataStore(connection, tokenStorage, config)
    FeatureTypeFactory → new FeatureType(connection, tokenStorage, config)
```

---

## Files Removed (16 files, 5 directories)

### Component Classes

| File | Lines | Reason |
|------|-------|--------|
| `Component/DataRepository.php` | 388 | Replaced by `DataStore`. Logic merged into new DataStore with PropertyAdapter pattern. |
| `Component/EventAwareDataRepository.php` | ~130 | Eval-based event hooks (`onBeforeSave`, `onAfterUpdate`, etc.) removed for security. |
| `Component/EventProcessor.php` | ~100 | Used `eval()` to run user-provided PHP expressions — security risk. Not referenced by new code. |
| `Component/Expression.php` | ~30 | Trivial SQL expression wrapper used only by `DoctrineBaseDriver`. Geometry SQL now built inline in FeatureType. |
| `Component/FeatureQueryBuilder.php` | ~105 | Custom QueryBuilder that delegated geometry SQL to Geographic drivers. Logic now inline in `FeatureType::createSelectQueryBuilder()`. |
| `Component/DataStoreService.php` | ~45 | Deprecated Symfony 3 service (full container injection). Already replaced by `RepositoryRegistry`. |
| `Component/FeatureTypeService.php` | ~25 | Deprecated Symfony 3 service. Extended `DataStoreService`. |

### Driver System

| File | Lines | Reason |
|------|-------|--------|
| `Component/Drivers/DoctrineBaseDriver.php` | ~130 | Abstract base for multi-database support. Handled insert/update SQL generation and table metadata loading. Replaced by direct DBAL calls in DataStore. |
| `Component/Drivers/PostgreSQL.php` | ~135 | PostgreSQL/PostGIS driver implementing `Geographic` interface. Geometry SQL (`ST_AsEwkt`, `ST_Transform`, etc.) now lives directly in `FeatureType`. |
| `Component/Drivers/Oracle.php` | ~126 | Oracle spatial driver (`SDO_UTIL`, `SDO_CS`). Oracle is no longer supported. |
| `Component/Drivers/SQLite.php` | ~32 | SQLite driver (no geometry). SQLite is no longer a supported target. |
| `Component/Drivers/Interfaces/Geographic.php` | ~55 | Interface contract for spatial SQL methods. No longer needed — only PostgreSQL is supported. |

### Metadata System

| File | Lines | Reason |
|------|-------|--------|
| `Component/Meta/Column.php` | ~90 | Per-column metadata (nullable, hasDefault, isNumeric, geometryType, srid). Replaced by DBAL's `SchemaManager::listTableColumns()` in `DiscreteColumnAdapter`. |
| `Component/Meta/TableMeta.php` | ~110 | Table-level metadata used to prepare insert/update data (fill defaults for non-nullable columns, handle empty numeric strings). Replaced by simpler logic in DataStore/PropertyAdapter. |

### Other

| File | Lines | Reason |
|------|-------|--------|
| `Extension/BaseXmlLoaderExtension.php` | ~45 | Deprecated Symfony DI extension base class. Bundle now loads services via `Bundle::build()` directly. |
| `Resources/views/fields.html.twig` | ~240 | Bootstrap form theme. Not referenced by any PHP or Twig code — likely a leftover from an earlier version. |

### Removed Directories

- `Component/Drivers/Interfaces/`
- `Component/Drivers/`
- `Component/Meta/`
- `Extension/`
- `Resources/views/`

---

## Files Retained (Active Code)

### Core Classes

| File | Status | Notes |
|------|--------|-------|
| `Component/DataStore.php` | **New** | Non-spatial repository. Replaces `DataRepository` with PropertyAdapter pattern. Supports `columns` and `json` storage modes. |
| `Component/FeatureType.php` | **Rewritten** | Spatial repository extending DataStore. Inline PostGIS SQL replaces driver abstraction. |
| `Component/RepositoryRegistry.php` | **Unchanged** | Factory cache layer for named repositories. |
| `Component/Factory/DataStoreFactory.php` | **Simplified** | Removed `EventProcessor` dependency. Now passes config array directly to DataStore constructor. |
| `Component/Factory/FeatureTypeFactory.php` | **Simplified** | Same simplification as DataStoreFactory. |

### PropertyAdapter (New)

| File | Status | Notes |
|------|--------|-------|
| `Component/PropertyAdapter/PropertyAdapterInterface.php` | **New** | Contract: `getSelectColumns()`, `extractProperties()`, `prepareStorageData()`. |
| `Component/PropertyAdapter/DiscreteColumnAdapter.php` | **New** | Classic mode: each property = one table column. Auto-detects columns via `SchemaManager`. |
| `Component/PropertyAdapter/JsonColumnAdapter.php` | **New** | New mode: all properties in a single JSONB column. Handles JSON encode/decode transparently. |

### Entities

| File | Status | Notes |
|------|--------|-------|
| `Entity/DataItem.php` | **Unchanged** | Non-spatial row entity with ArrayAccess. |
| `Entity/Feature.php` | **Unchanged** | Spatial entity extending DataItem. EWKT geometry handling. |

### Utilities & Config

| File | Status | Notes |
|------|--------|-------|
| `Utils/WktUtility.php` | **Unchanged** | WKT/EWKT parsing helpers. |
| `MapbenderDataSourceBundle.php` | **Unchanged** | Bundle class loading services.xml. |
| `Resources/config/services.xml` | **Simplified** | Removed `EventProcessor` service. Only defines `DataStoreFactory` and `FeatureTypeFactory`. |
| `DOCUMENTATION.md` | **New** | Comprehensive documentation for the refactored bundle. |

### Tests

| File | Status | Notes |
|------|--------|-------|
| `Tests/FeatureTypeTest.php` | **Unchanged** | Unit tests for Feature entity geometry parsing. Still valid. |
| `Tests/FeaturesTest.php` | **Updated** | Integration tests for FeatureType. Updated to use `FeatureTypeFactory` instead of old service. |

---

## API Changes

### DataStore Constructor

**Before:**
```php
new DataStore($connection, $tokenStorage, $eventProcessor, $config)
```

**After (backward-compatible):**
```php
new DataStore($connection, $tokenStorage, $config)
// OR (for backward compat — EventProcessor ignored):
new DataStore($connection, $tokenStorage, $eventProcessor, $config)
```

### FeatureType Constructor

Same backward-compatible signature change as DataStore.

### DataStoreFactory.fromConfig()

**Before:**
```php
new DataStore($connection, $tokenStorage, $eventProcessor, $config)
```

**After:**
```php
new DataStore($connection, $tokenStorage, $config)
```

### Removed Public Methods

These methods existed on the old `DataRepository` but are not on the new `DataStore`:

| Method | Replacement |
|--------|-------------|
| `DataRepository::getTableMetaData()` | Not needed — column handling via PropertyAdapter |
| `DataRepository::driverFactory()` | Removed — no driver abstraction |
| `DataRepository::idToIdentifier()` | Inlined |
| `DataRepository::getByIds()` | Removed (unused by consumers) |
| `DataRepository::stripQuotes()` | Removed (was utility, used only internally) |
| `DataRepository::stripQuotesFromArray()` | Removed |

### New Public Methods

| Method | Description |
|--------|-------------|
| `DataStore::getPropertyAdapter()` | Returns the active PropertyAdapter |
| `DataStore::getPlatformName()` | Returns database platform name |
| `DataStore::save($itemOrData)` | Unified insert/update (existed before, now cleaner) |
| `DataStore::insert($itemOrData)` | Explicit insert |
| `DataStore::update($itemOrData)` | Explicit update |
| `FeatureType::getGeomField()` | Returns geometry column name |
| `FeatureType::getSrid()` | Returns storage SRID (auto-detected or configured) |

### Kept Public Methods (Backward Compatible)

These methods have the same signature and behavior:

- `getConnection()`, `getTableName()`, `getUniqueId()`, `getFields()`
- `search(array $criteria)`, `getById($id)`, `count(array $criteria)`
- `remove($itemOrId)`
- `itemFactory()`, `itemFromArray(array)`
- `createQueryBuilder()`

---

## New Feature: JSONB Property Storage

The refactoring adds a new `propertyStorage: json` mode where all item
properties are stored in a single JSONB column instead of individual table
columns.

### Configuration

```yaml
featureType:
  table: my_features
  uniqueId: id
  geomField: geom
  srid: 4326
  propertyStorage: json
  propertyColumn: properties   # default, can be omitted
```

### Database Schema

```sql
CREATE TABLE my_features (
    id SERIAL PRIMARY KEY,
    geom geometry(Geometry, 4326),
    properties JSONB NOT NULL DEFAULT '{}'::jsonb
);
```

### How It Works

- **SELECT**: Reads the JSONB column and decodes to associative array
- **INSERT/UPDATE**: Encodes properties array to JSON string
- **Form fields**: `name` attribute maps to JSON keys (transparent to frontend)

---

## Security Improvements

### Removed: eval-based Event Processing

The old `EventProcessor` used PHP's `eval()` to execute user-configured
expressions at lifecycle hooks (`onBeforeSave`, `onAfterUpdate`, etc.).
This was a significant security risk:

- Arbitrary PHP code execution from YAML configuration
- Access to database connections, user tokens, and authorization context
- No sandboxing or input validation

The `events` configuration key is still accepted (no parse errors) but
expressions are no longer executed. For lifecycle hooks, use Symfony's
EventDispatcher instead.

---

## Compatibility Notes

1. **Existing YAML configurations work unchanged** — `propertyStorage`
   defaults to `columns`, preserving classic behavior.

2. **Oracle and SQLite are no longer supported** — the driver abstraction
   was removed. Only PostgreSQL/PostGIS is supported.

3. **The `events` key is silently ignored** — no runtime errors, but
   expressions no longer execute.

4. **`DataStoreService` / `FeatureTypeService` removed** — these were
   already deprecated. Use `RepositoryRegistry` with the factory services
   (`mbds.default_datastore_factory`, `mbds.default_featuretype_factory`).

5. **`RETURNING` clause** — INSERT statements now use `RETURNING` to get
   the new ID. This is PostgreSQL-specific (another reason Oracle/SQLite
   support was dropped).
