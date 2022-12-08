# Mapbender Digitizer element
Display and edit features (and feature attributes) stored in
database tables in a Mapbender application.

Feature listings are displayed as (HTML) tables. Geometries
can be created or edited using a predefined set of tools, and
their attributes can be in customizable forms.

Designed for use in a sidepane.

Data is organized into "schemes" to support integration of
multiple database tables.

If multiple schemes are defined, Digitizer will display a dropdown
to allow schema switching.

Each schema separately defines tool availability, how data is
listed, and the structure of the form used for editing attributes.

Connects to PostgreSQL Postgis or Oracle spatial database tables. Please
refer to [the Data Source documentation](https://github.com/mapbender/data-source#configuring-repositories)
for details.

Connection and table configuration may either be inlined into the schema configuration directly, or
reference an existing global configuration placed into a Symfony container parameter.

Digitizer does not support tables without geometry columns.

## After installation
Using Digitizer requires registering *two* bundles in your application kernel. Register *both*
`\Mapbender\DataManagerBundle\MapbenderDataManagerBundle` and `\Mapbender\DigitizerBundle\MapbenderDigitizerBundle`.

## Configuring feature interactions
Each schema may define the following values to control access to data modifying interactions:

| name | type | description | default |
|---|---|---|---|
| allowCreate | boolean or list of strings | Allow user to make new features | true |
| allowEdit | boolean or list of strings | Allow user to modify existing features and their attributes | true |
| allowDelete | boolean or list of strings | Allow user to remove features from the database | true |
| allowDigitize | boolean or list of strings | Allow geometry editing (attribute editing may still be allowed via `allowEdit`) | true |
| roles | list of strings or null | Show this schema only to users with (at least one of) these roles | null |

The `roles` list should contain entries understood by the Symfony grants system, such as
`ROLE_USER` for logged-in users or `ROLE_GROUP_SOMETHING` for a user group created and
assigned in the Mapbender administration backend.

The allow... settings named above may also contain lists of role names to limit
modification to certain groups of users. If they are booleans, access is uniform for
all users (including anyonymous users).

## User specific data
Data shown in each schema can be separate for different users. Each schema may define:
| name | type | description | default |
|---|---|---|---|
| filterUser | boolean | Keep data separate for each user | false |
| trackUser | boolean | Store the creating / modiying user (can be done without actually filtering selection) | false |

Setting either of these to true additionally requires a `userColumn` (string) to
be defined in the dataStore / featureType definition. This must name a database
column of sufficient length to store user names.

Note that with `filterUser` true, `trackUser` is implied and its setting, if present,
is ignored.

The `userColumn` setting is a Digitizer / Data Manager extension and not documented (nor implemented) by
the data-source package.

## Configuring feature display and interface behaviour
Each schema may define the following values to control basic behaviour:

| name | type | description | default |
|---|---|---|---|
| searchType | string or null | Initial state of checkbox for limiting feature loading to current visible map portion. On if exactly "currentExtent". Off for all other values | currentExtent |
| allowRefresh | boolean | Offer button to reload data (for tables frequently modified by concurrent users) | false |
| allowChangeVisibility | boolean | Offer buttons to toggle feature visibility | true |
| displayPermanent | boolean | Keep features visible on map even after switching to a different schema | false |
| displayOnInactive | boolean | Keep features visible on map even after deactivating Digitizer | false |
| continueDrawingAfterSave | boolean | Keep drawing tool active after creating and saving a new feature (~fast batch mode feature creation) | false |
| refreshLayersAfterFeatureSave | list of strings and / or numbers | Mapbender source instance ids (refer to "Layersets" tab in application backend) that will reload after any item is created, updated or deleted | -none- |

## Configuring "toolset"
Each schema may define a `toolset` setting to configure the types of drawing tools
available during geometry creation. This should be a list of strings, or null
for auto-configuration (which is the default).

Valid tool names are:
* `drawPoint` for point creation
* `drawLine` for line drawing
* `drawPolygon` for polygon drawing
* `drawRectangle`, `drawCircle`, `drawEllipse` for rectangles, circles and ellipses respectively
* `drawDonut` for making interior cutouts in existing polygons

If `toolset` is set as an empty list, no geometry creation tools will be offered.

If `toolset` is null or not set, and the connected feature type declares its
`geomType`, Digitizer will reduce the selection of tools to to those compatible with
the `geomType` (e.g. no line drawing for datasets containing only points or polygons).

If neither `toolset` nor the `geomType` are defined, all supported tools are offered.

If feature modification is allowed (via `allowDigitize` / `allowEdit`), vertex modification
and feature translation tools will also be offered.

If `allowCreate` is set to false, no creation tools from the `toolset` setting will be
offered. `drawDonut` (inherently a modification, not creation tool) may still be
offered, if editing is allowed.

## Configuring tabular item listing
Each schema configuration contains an object under key `table` with the following structure:

| name | type | description | default |
|---|---|---|---|
| columns | list of objects with `data` and `label` entries | maps database columns to HTMl table columns | Display primary key only |
| searching | boolean | Enables display filtering by search term | true |
| pageLength | integer | Limits the number of rows per page | 16 |

## Configuring forms
Each schema configuration contains a list of (potentially nested) objects under key
`formItems`, defining the contents and structure of the form shown
when an item is created or edited. Note that this form will also be
used purely as a detail display vehicle even if editing is disabled.

Additionaly, the `popup` object in the schema controls properties of the
the popup itself. It supports the following values:

| name | type | description | default |
|---|---|---|---|
| title | string | Popup title text | "Edit" (localized) |
| width | string | valid CSS width rule | "550px" |


### Form input fields
Form input fields come in a multitude of different types, controlled by the `type`
value. All inputs share a common set of configuration options:

| name | type | description | default |
|---|---|---|---|
| type | string | Type of form input field (see below) | -none- |
| name | string | Database column mapped to the input | -none- |
| value | string | Initial field value on newly created items | -none- |
| title | string | Label text for form input field | -none- |
| attr | object | Mapping of HTML attributes to add to the input | -none- |
| infoText | string | Explanatory text placed in a tooltip next to the label | -none- |
| css | object | Mapping of CSS rules to add to the form group (container around label and input) | -none- |
| cssClass | string | Added to the class attribute of the form group (container around label and input) | -none- |

Input field `type` is one of
* "input" for a [regular single-row text input](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/text)
* "textArea" for a [multiple-row text input](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea)
* "select" for a [dropdown offering predefined choices](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select)
* "radioGroup" for an expanded list of [predefined choices](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio)
* "checkbox" for an [on / off choice](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox)
* "date" for a [specialized input selecting a calendar day](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date) (produces standard SQL date string format "YYYY-MM-DD")
* "colorPicker" for a [specialized input selecting a color](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/color) (produces CSS-like hash + 6 hex digits string format)
* "file" for [allowing file attachments](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file)

Many common customizations for inputs can be performed purely with the `attr` object.
E.g. type "input" can be restricted to allow numbers only by overriding
its HTML type attribute; all inputs can be made required or readonly.

```yml
<...>
formItems:
  - type: input
    name: strictly_formatted_column
    title: Strict input pattern demo
    attr:
        pattern: '\w{2}\d{3,}'
        placeholder: Two letters followed by at least three digits
        required: true
  - type: input
    name: numeric_column
    title: Numbers only
    attr:
      type: number
      min: 10
      max: 200
      step: 10
      required: true
  - type: textArea
    name: text_column
    title: Very large text area
    attr:
      rows: 10
```


#### Choice input option formats
Types "radioGroup" and "select" require a list of objects under key
`options` to specify the available choices. Option objects contain:

| name | type | description | default |
|---|---|---|---|
| value | string | Generated database value for the choice | -none- |
| label | string | Displayed text for the choice | Same as value |
| attr | object | Mapping of HTML attributes to add to the individual HTML `<option>` or `<input type="radio">` | -none- |

```yml
<...>
formItems:
  - type: select
    options:
      # Allow user to explicitly (re)select ~nothing in particular
      - label: ''
        value: ''
      - label: First option text   # displayed
        value: v1   # value in database column
      - label: Second option text (disabled)
        value: v2
        attr:
          disabled: true
      - label: Third option text
        value: v3
```

Selects (NOT radioGroup items) can alternatively specify `sql`
and `connection` (Doctrine DBAL connection name) to generate choices
dynamically. The `sql` _should_ generate `label` and `value` aliases
for clarity. If it does not, the first column of each
row is used as the option label and the last column as the submit value.

Static `option` definitions and `sql` can also be combined.
```yml
<...>
formItems:
  - type: select
    options:
      # Allow user to explicitly (re)select ~nothing in particular
      - label: ''
        value: ''
      - label: Static option a
        value: a
    sql: SELECT CONCAT("label_prefix", ': ', "name") AS label, "id" AS value FROM "some_table"
    connection: name_of_some_connection
```

If `sql` is defined but `connection` is omitted, the "default" DBAL connection
is used for the query.

#### File uploads
Files uploaded through `type: file` form items will be stored in the
server's file system. The mapped database column will only store a file path as a string.

The default storage path for uploads is determined by Mapbender, but
can be reconfigured on the "dataStore" / "featureType" level, individually
for each database column. This is done via a `files` object in the
"dataStore" / "featureType" configuration.

E.g.
```yml
schemes:
  items_with_customized_upload_location:
    dataStore:
        connection: dm_connection_name
        table: items_with_file_attachments
        ## Customization per column here
        files:
          - field: attachment_path_column
            path: /var/mapbender-attachments/dm/items_with_customized_upload_location/attachment_path_column
```

The starting point for a relative `path` (no leading slash) is the web server document root.

For image attachments, you may link a `type: img` item that will automatically display a preview of the current attachment.

```yml
<...>
formItems:
    - type: file
      title: Attached image
      name: img_path_column
      attr:
        accept: 'image/*'
    - type: image
      name: img_path_column   # Link to input established by matching "name" value
      src: attachment-placeholder.png
```

### Structural / misc form elements
#### Type "tabs"
Complex form dialogs can be organized into multiple tabs by inserting an object with `type: tabs`
into the `formItems` list, and assigning it one or more tab specifications, which
consist of `title` (text displayed on the tab) and `children` (contents of the tab).

```yml
<...>
popup:
  title: 'Multi-tab form dialog'
formItems:
  - type: tabs
    children:
      - title: 'First tab'
        children:
          # First tab form item specifications
          - type: input
            title: Input in first tab
            <...>
      - title: 'Second tab'
        children:
          # First tab form item specifications
          - type: input
            title: Input in second tab
```

### Misc container tags "div", "span", "p"
Inserts HTML `<div>`, `<span>` or `<p>` tags. May specify `text` (encoded, inserted first) and `children` (list of more items to insert).
Supports adding free-form HTML attributes via `attr` object and custom `cssClass`.

```yml
<...>
formItems:
  - type: p
    text: This is an introductory paragraph.
  # Arrange inputs in Bootstrap grid row + columns
  - type: div
    cssClass: row
    children:
      - type: input
        title: Input in left column
        cssClass: col-xs-4 col-4
      - type: input
        title: Input in middle column
        cssClass: col-xs-4 col-4
      - type: input
        title: Input in right column
        cssClass: col-xs-4 col-4
```

### Type "html"
Inserts custom HTML content (no escaping), wrapped into an extra div. May specify `attr` and `cssClass` to be added onto the containing div.
```yml
<...>
formItems:
  - type: html
    html: 'This will <strong>not</strong> go through any HTML escaping.'
    cssClass: added-on-wrapping-div
```

#### Type "breakLine"
Inserts a single HTML `<hr>` element. Supports adding free-form HTML attributes via `attr` object and custom `cssClass`.


## Configuring access
Each schema may also limit the possible interactions users can perform:

| name | type | description | default |
|---|---|---|---|
| allowCreate | boolean | Enables creation of new items | true |
| allowEdit | boolean | Enables editing of existing items | true |
| allowDelete | boolean | Enables deletion of existing items | true |
| allowRefresh | boolean | Add button to explicitly reload items from database | false |

## Example configuration
```yaml

schemes:
  a_demo_schema:
    label: Demo   # displayed in schema selector, if multiple schemes configured
    dataStore:
      connection: dm_connection_name
      table: dm_items
      uniqueId: id
    allowEdit:    true    # Can edit existing items
    allowCreate:  true    # Can create new items from scratch
    allowDelete:  false   # Can not delete anything
    allowRefresh: true    # Enable item refresh button
    table:
      columns:
      - data: id
        title: ID
      - data: name
        title: Item name
    popup:
      title: 'Edit dialog title'
      width: 50vw   # half screen width
    formItems:
    - type: p
      text: This is a non-interactive introductory paragraph.
    - type: input
      name: name
      infoText: This will show up in a tooltip next to the label.
      title: Item name
      attr:
        placeholder: 'Entry required'
        required: true
    - type: textArea
      name: description
      title: Longer description text
      attr:
        rows: 4
    - type: radioGroup
      title: Choose one
      name: choice_column_1
      options:
        - label: Option 1
          value: v1
        - label: Option 2
          value: v2
      value: v2   # Pre-select second option by default for new items
    - type: select
      title: Select at least one (multiple choice)
      attr:
        required: required
        multiple: multiple
      name: choice_column_2
      options:
        - label: Option 1
          value: v1
        - label: Option 2 (disabled)
          value: v2
          attr:
            disabled: disabled
        - label: Option 3
          value: v3
      value: v1,v3   # use comma-separated values for default multi-select value
```
