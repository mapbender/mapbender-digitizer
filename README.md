# Mapbender digitizer module

## Features
* Connecting and handling PostgreSQL(PostGIS) or Oracle data tables
* Defining custom handling of DB tables as FeatureType's. 
* Multiply definition's of the same table with own SQL filter
* Defining custom FeatureType forms to handle the data
* Displaying and modifying FeatureType on the map (powered by OpenLayer 2)

## Installation 
* First you need installed mapbender3-starter https://github.com/mapbender/mapbender-starter#installation project
* Add required module to mapbender
```sh
$ composer require "mapbender/digitizer"
```

## Update 

 ```sh
$ composer update mapbender/digitizer
```

# Architecture
![Architecture](Documents/Digitizer.png)

[Diagram](https://www.draw.io/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fmapbender%2Fmapbender-digitizer%2Fmaster%2FDocuments%2FDigitizer.xml)
