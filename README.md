# Mapbender digitizer module

## Features
* Connecting and handling PostgreSQL(PostGIS) or Oracle data tables
* Defining custom handling of DB tables as FeatureType's. 
* Multiply definition's of the same table with own SQL filter
* Defining custom FeatureType forms to handle the data
* Displaying and modifying FeatureType on the map (powered by OpenLayer 2)

## Installation 
* First you need installed mapbender3-starter https://github.com/mapbender/mapbender-starter#installation project
* Modify ```application/composer.json``` 
 * Add dependency to "require" section:
 ```javascript
"require": {
    "mapbender/digitizer": "1.x"
},
```
 * Add custom repository
 ```javascript
"repositories": [
    { "type": "git", "url": "https://github.com/mapbender/mapbender-digitizer.git"}
]
```

* Update composer

 ```sh
$ cp application/
$ composer update
```