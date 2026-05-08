# Event System Migration Guide

## Overview

The old **eval-based event system** (`EventProcessor` / `EventAwareDataRepository`) has been
**removed** from DataSourceBundle. This document explains what changed, why, and how to
replace event-driven behavior with safe alternatives.

---

## What Was Removed

### Server-Side PHP Events (Security Risk)

The old architecture allowed YAML/database configuration to contain **arbitrary PHP code**
that was executed via `eval()` at lifecycle hooks:

```yaml
# OLD — no longer executed
dataStore:
  table: my_table
  events:
    onBeforeSave:   "$feature->setAttribute('updated_by', $user);"
    onAfterSave:    "$connection->executeStatement(...);"
    onBeforeRemove: "$logger->info('Deleting ' . $feature->getId());"
    onAfterRemove:  "// cleanup code"
    onBeforeSearch: "$criteria->addFilter(...);"
    onAfterSearch:  "$features = array_filter($features, ...);"
```

**Why it was removed:**

| Risk | Description |
|------|-------------|
| Arbitrary code execution | `eval()` runs any PHP code — database access, file system, network calls |
| No sandboxing | The code had full access to `$connection`, `$tokenStorage`, `$user` |
| Stored in database | Configurations are often stored in the Mapbender DB, meaning any admin with element-edit access could inject server-side code |
| Invisible attack surface | No code review possible for DB-stored eval strings |
| PHP 8 deprecations | Dynamic eval patterns conflict with strict typing and static analysis |

**Current behavior:** The `events` configuration key is still **accepted** in YAML/DB configuration
but is **silently ignored**. No PHP eval hooks are executed.

### Removed Files

| File | Role |
|------|------|
| `Component/EventProcessor.php` | Executed `eval()` on configured PHP strings |
| `Component/EventAwareDataRepository.php` | Wrapped DataRepository with lifecycle hook calls |

### Client-Side JS Eval (Deprecated, Still Active)

The `FormRenderer.js` still supports `eval()`-based JavaScript event handlers on form fields
(`filled` and `change` events configured as strings). These log a **deprecation error** to
the browser console:

> "Using eval'd Javascript in the configuration is deprecated. Add event handlers to your project code."

This will also be removed in a future version.

---

## Events That Are Still Active

These events **do work** and are the recommended extension points:

### JavaScript jQuery Events

| Event | Triggered On | When | Data |
|-------|-------------|------|------|
| `data.manager.item.saved` | Element `$element` | After successful save | `{item, itemId, schema, originalId, schemaName, uniqueIdKey, originator}` |
| `data.manager.item.deleted` | Element `$element` | After successful delete | `{item, itemId, schema, schemaName, originator}` |
| `filled` | Form field `$input` | After form populated with item data | Native jQuery event |

**Usage example:**
```javascript
// In your project JavaScript (e.g., a custom Mapbender element or inline script)
var $digitizer = $('.mb-element-digitizer');
$digitizer.on('data.manager.item.saved', function(event, eventData) {
    console.log('Saved item:', eventData.itemId, 'in schema:', eventData.schemaName);
    // eventData.item contains the full row data
    // eventData.originalId is null for newly created items
});

$digitizer.on('data.manager.item.deleted', function(event, eventData) {
    console.log('Deleted item:', eventData.itemId);
});
```

### OpenLayers Map Events (Digitizer only)

| Event | Source | When |
|-------|--------|------|
| `MOVEEND` | `ol.Map` | Map panned/zoomed (triggers extent-based reload) |
| `mbmapsrschanged` | Mapbender map element | SRS changed |
| `DRAWEND` | `ol.interaction.Draw` | New geometry drawn |
| `MODIFYEND` | `ol.interaction.Modify` | Geometry modified |

---

## How to Replace Removed Server-Side Events

### Pattern 1: `onBeforeSave` — Set Audit Fields

**Old (removed):**
```yaml
events:
  onBeforeSave: "$feature->setAttribute('user_of_last_edit', $user);"
```

**New — Use a PostgreSQL trigger:**
```sql
-- Create a function that sets the audit column
CREATE OR REPLACE FUNCTION set_edit_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Use the application_name set by the connection, or current_user
    NEW.user_of_last_edit := current_setting('app.current_user', true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to your table
CREATE TRIGGER trg_set_edit_user
    BEFORE INSERT OR UPDATE ON my_table
    FOR EACH ROW EXECUTE FUNCTION set_edit_user();
```

To pass the current user from PHP to PostgreSQL, set a session variable in a
Doctrine event listener:

```php
// src/EventListener/SetDatabaseUserListener.php
namespace App\EventListener;

use Doctrine\DBAL\Event\ConnectionEventArgs;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

class SetDatabaseUserListener
{
    public function __construct(private TokenStorageInterface $tokenStorage) {}

    public function postConnect(ConnectionEventArgs $args): void
    {
        $user = $this->tokenStorage->getToken()?->getUserIdentifier() ?? 'anonymous';
        $args->getConnection()->executeStatement(
            "SET app.current_user = " . $args->getConnection()->quote($user)
        );
    }
}
```

Register the listener in `services.yaml`:
```yaml
services:
    App\EventListener\SetDatabaseUserListener:
        tags:
            - { name: doctrine.event_listener, event: postConnect, connection: geodata_db }
```

### Pattern 2: `onBeforeSave` — Validate or Transform Data

**Old (removed):**
```yaml
events:
  onBeforeSave: |
    if (empty($feature->getAttribute('name'))) {
        throw new \Exception('Name is required');
    }
```

**New — Override `DataStore::insertItem()` / `updateItem()`:**

Create a custom DataStore subclass:

```php
// src/Component/ValidatingDataStore.php
namespace App\Component;

use Mapbender\DataSourceBundle\Component\DataStore;
use Mapbender\DataSourceBundle\Entity\DataItem;

class ValidatingDataStore extends DataStore
{
    public function save(DataItem $item): DataItem
    {
        $attrs = $item->getAttributes();
        if (empty($attrs['name'])) {
            throw new \InvalidArgumentException('Name is required');
        }
        // Transform data before save
        $item->setAttribute('name', trim($attrs['name']));
        return parent::save($item);
    }
}
```

Register as a custom factory:

```php
// src/Component/Factory/ValidatingDataStoreFactory.php
namespace App\Component\Factory;

use App\Component\ValidatingDataStore;
use Mapbender\DataSourceBundle\Component\Factory\DataStoreFactory;

class ValidatingDataStoreFactory extends DataStoreFactory
{
    protected function createInstance($connection, $tokenStorage, $config): ValidatingDataStore
    {
        return new ValidatingDataStore($connection, $tokenStorage, $config);
    }
}
```

### Pattern 3: `onAfterSave` — Trigger Side Effects

**Old (removed):**
```yaml
events:
  onAfterSave: "$connection->executeStatement('UPDATE log SET ...');"
```

**New — Use Symfony EventDispatcher:**

1. Create a custom event:
```php
// src/Event/DataItemSavedEvent.php
namespace App\Event;

use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Contracts\EventDispatcher\Event;

class DataItemSavedEvent extends Event
{
    public const NAME = 'data_store.item.saved';

    public function __construct(
        public readonly DataItem $item,
        public readonly string $tableName,
        public readonly bool $isNew,
    ) {}
}
```

2. Create an event subscriber:
```php
// src/EventSubscriber/DataItemSubscriber.php
namespace App\EventSubscriber;

use App\Event\DataItemSavedEvent;
use Doctrine\DBAL\Connection;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class DataItemSubscriber implements EventSubscriberInterface
{
    public function __construct(private Connection $geodataConnection) {}

    public static function getSubscribedEvents(): array
    {
        return [DataItemSavedEvent::NAME => 'onItemSaved'];
    }

    public function onItemSaved(DataItemSavedEvent $event): void
    {
        // Your post-save logic here
        $this->geodataConnection->executeStatement(
            'INSERT INTO audit_log (table_name, item_id, action) VALUES (?, ?, ?)',
            [$event->tableName, $event->item->getId(), $event->isNew ? 'INSERT' : 'UPDATE']
        );
    }
}
```

3. Dispatch from a custom DataStore:
```php
public function save(DataItem $item): DataItem
{
    $isNew = !$item->getId();
    $result = parent::save($item);
    $this->eventDispatcher->dispatch(
        new DataItemSavedEvent($result, $this->tableName, $isNew),
        DataItemSavedEvent::NAME
    );
    return $result;
}
```

### Pattern 4: `onBeforeSearch` / `onAfterSearch` — Filter Results

**Old (removed):**
```yaml
events:
  onBeforeSearch: "$criteria->where('status', 'active');"
  onAfterSearch: "$features = array_filter($features, fn($f) => $f->getAttribute('visible'));"
```

**New — Use the `filter` configuration:**
```yaml
dataStore:
  table: my_table
  # Static SQL WHERE clause — supports :userName placeholder
  filter: "status = 'active' AND visible = true"
```

For dynamic filtering, override `DataStore::search()`:
```php
class FilteredDataStore extends DataStore
{
    public function search(array $criteria = []): array
    {
        // Add custom criteria before query
        $items = parent::search($criteria);
        // Post-filter if needed
        return array_filter($items, function($item) {
            return $item->getAttribute('visible') !== false;
        });
    }
}
```

### Pattern 5: `onBeforeRemove` / `onAfterRemove` — Cascade or Prevent Delete

**Old (removed):**
```yaml
events:
  onBeforeRemove: |
    if ($feature->getAttribute('locked')) throw new \Exception('Cannot delete locked items');
```

**New — Use database constraints or override `remove()`:**

```sql
-- Database-level cascade
ALTER TABLE child_table
    ADD CONSTRAINT fk_parent
    FOREIGN KEY (parent_id) REFERENCES my_table(id)
    ON DELETE CASCADE;
```

Or override in PHP:
```php
class ProtectedDataStore extends DataStore
{
    public function remove($itemOrId): void
    {
        $item = is_object($itemOrId) ? $itemOrId : $this->getById($itemOrId);
        if ($item && $item->getAttribute('locked')) {
            throw new \RuntimeException('Cannot delete locked items');
        }
        parent::remove($itemOrId);
    }
}
```

---

## How to Replace Client-Side Eval Events

### Form Field `change` / `filled` Handlers

**Old (deprecated, still works but logs error):**
```yaml
formItems:
  - type: input
    name: area_m2
    change: "var val = parseFloat($(el).val()); $('[name=area_ha]').val(val / 10000);"
```

**New — Use project JavaScript:**
```javascript
// In your project JS file (loaded via getRequiredAssets override or custom element)
$(document).on('change', '[name=area_m2]', function() {
    var val = parseFloat($(this).val());
    $('[name=area_ha]').val(val / 10000);
});
```

Or attach handlers after form render using the `filled` jQuery event:
```javascript
var $digitizer = $('.mb-element-digitizer');
$digitizer.on('data.manager.item.saved', function(e, data) {
    // React to save
});

// After form is populated, add custom logic
$(document).on('filled', '[name=my_field]', function() {
    // Custom initialization after form data is loaded
});
```

---

## Migration Checklist

1. **Search your database** for element configurations containing `events:` keys:
   ```sql
   SELECT id, title, configuration
   FROM mb_core_element
   WHERE configuration LIKE '%events%'
     AND (configuration LIKE '%onBefore%' OR configuration LIKE '%onAfter%');
   ```

2. **For each event handler found**, implement the replacement using one of the patterns above.

3. **Remove the `events` key** from the configuration (it's ignored but creates confusion).

4. **Replace JS eval handlers** in `formItems` (`change:` and `filled:` string values) with
   proper JavaScript event listeners in your project code.

5. **Test thoroughly** — the old events ran synchronously before/after each operation.
   Database triggers and Symfony event subscribers may have subtle timing differences.

---

## Summary Table

| Old Event | Replacement Strategy | Complexity |
|-----------|---------------------|------------|
| `onBeforeSave` (set fields) | PostgreSQL trigger + session variable | Medium |
| `onBeforeSave` (validate) | Custom DataStore subclass override | Low |
| `onAfterSave` (side effects) | Symfony EventDispatcher + custom DataStore | Medium |
| `onBeforeSearch` (filter) | `filter` config key or DataStore override | Low |
| `onAfterSearch` (transform) | DataStore subclass override `search()` | Low |
| `onBeforeRemove` (prevent) | Database constraints or DataStore override | Low |
| `onAfterRemove` (cleanup) | Database CASCADE or Symfony event | Low–Medium |
| JS `change`/`filled` eval | Project JavaScript with jQuery `.on()` | Low |
