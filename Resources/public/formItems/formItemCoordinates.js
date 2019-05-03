(function () {
    "use strict";

    Mapbender.Digitizer.FormItemCoordinates = {

        epsgCodes: [],
        title_epsg: 'EPSG',
        title_longitude: 'longitude',
        title_latitude: 'latitude',
        coordinatesFieldsOrder: ['x','y','epsg'],

        activeEPSGCode: null,
        epsgSelection: null,

        inputX: null,
        inputY: null,

        getLonLat: function() {

            return {
                x: this.inputX.getValueAsDecimal(),
                y: this.inputY.getValueAsDecimal()

            }
        },

        setLonLat: function(x,y) {

            this.inputX.setValue(x);
            this.inputY.setValue(y);
        },

        process: function (feature,dialog,schema) {
            var formItem = this;
            var schema = formItem.schema;
            var widget = schema.widget;
            var mapProjection = widget.getMap().getProjectionObject().projCode;

            var getEPSGCodes = function() {

                var mapProjectionInEpsgCodes = false;
                formItem.epsgCodes.forEach(function(code){ // Add Map Projection to EPSG codes, only if it is not already there
                    if (code[0]===mapProjection) {
                        mapProjectionInEpsgCodes = true;
                    }
                });
                if (!mapProjectionInEpsgCodes) {
                    epsgCodes.unshift([mapProjection,mapProjection]);
                }
                return epsgCodes;
            };

            var epsgCodes = getEPSGCodes();

            formItem.epsgSelection = {
                title: formItem.title_epsg,
                options: epsgCodes,
                value: mapProjection,
                css : { width: '33.33%' },
                cssClass: '-fn-active-epsgCode',


                change: function(event) {

                    var epsgSelection = this;

                    var activeEpsgCode = formItem.activeEPSGCode;
                    var activeProjection = formItem.activeEPSGCode ? new OpenLayers.Projection(activeEpsgCode) : widget.getMap().getProjectionObject();

                    var epsgCode = epsgSelection.value(event);

                    var projectionToTransform = new OpenLayers.Projection(epsgCode);

                    var ll = formItem.getLonLat();
                    var lonlat = Mapbender.Digitizer.Transformation.transFromFromTo(new OpenLayers.LonLat(ll.x, ll.y),activeProjection, projectionToTransform);
                    formItem.setLonLat(lonlat.x,lonlat.y);

                    formItem.activeEPSGCode = epsgCode;

                }
            };

            Object.setPrototypeOf(formItem.epsgSelection,Mapbender.Digitizer.FormItemSelect);


            var createInputChild = function(direction) {

                var inputChild = {
                    label: '',
                    css : { width: '33.33%' },
                    cssClass: direction,
                    title: (direction === 'x' ? formItem.title_longitude : formItem.title_latitude) + ': ',
                    name: direction,
                    css: {width: '33%'},

                    getValueAsDecimal: function () {
                        return Mapbender.Digitizer.Transformation.transformDegreeToDecimal(this.getValue());
                    },

                    updateGeometry: function() {

                    },


                    change: function () {

                        var layer = schema.layer;
                        var activeProjection = formItem.activeEPSGCode;

                        var ll = formItem.getLonLat();
                        var lonlat = Mapbender.Transformation.transformToMapProj(ll.x, ll.y, activeProjection);

                        var oldGeometry = feature.geometry;
                        if (oldGeometry.x && oldGeometry.y) {
                            layer.renderer.eraseGeometry(oldGeometry);
                        }

                        feature.geometry = new OpenLayers.Geometry.Point(lonlat.x, lonlat.y);
                        layer.drawFeature(feature);
                        schema.getData();

                    }

                };
                Object.setPrototypeOf(inputChild,Mapbender.Digitizer.FormItemInput);
                return inputChild;
            };

            var children = {
                'x' : createInputChild('x'),
                'y' : createInputChild('y'),
                'epsg' : epsgSelection
            };

            var fieldSetItem = {
                children: [],
                cssClass: 'coordinates-container'
            };
            Object.setPrototypeOf(fieldSetItem,Mapbender.Digitizer.FormItemFieldSet);

            _.each(formItem.coordinatesFieldsOrder, function(direction){

                fieldSetItem.children.push(children[direction]);

            });



            return fieldSetItem;
        }

    };

    Object.setPrototypeOf(Mapbender.Digitizer.FormItemCoordinates, Mapbender.Digitizer.FormItem);







    Mapbender.Digitizer.Transformation = {

        dm: /(\d*)\°([\d.]*)\'/,
        dms: /(\d*)\°(\d*)\'([\d.]*)\"/,


        getDegreeMatches: function (coordinate) {
            return coordinate.match(this.dm) || coordinate.match(this.dms);
        },

        transformDegreeToDecimal: function(coordinate){
            var match = this.getDegreeMatches(coordinate);
            if(!match) {
                return coordinate;
            }

            var decimals = (parseFloat(match[1])) + parseFloat((match[2]/60));
            if(match[3]){
                decimals += parseFloat((match[3]/3600));
            }
            return  decimals;
        },

        transformToMapProj: function(x,y, from) {

            var c = new OpenLayers.LonLat(x,y);
            var to = Mapbender.Model.map.olMap.getProjectionObject();
            var from2 = new OpenLayers.Projection(from.projCode || from);
            return this.transFromFromTo(c,from2,to);
        },

        transformFromMapProj: function(x,y, to) {

            var c = new OpenLayers.LonLat(x,y);
            var from = Mapbender.Model.map.olMap.getProjectionObject();

            var to2 = new OpenLayers.Projection(to.projCode || to);
            return this.transFromFromTo(c,from,to2);
        },

        transFromFromTo : function(lonlat, from, to){

            var c = lonlat.transform(from,to);

            return {x: c.lon,y: c.lat};


        },

        areCoordinatesValid: function (coords) {
            if (!$.isNumeric(coords.x) || !$.isNumeric(coords.y)) {
                return false;
            }

            var Point = new Proj4js.Point(coords.x, coords.y);
            var currentProjection =  Mapbender.Model.map.olMap.getProjectionObject();

            Proj4js.transform(currentProjection, currentProjection, Point);

            var lonLat = new OpenLayers.LonLat(Point.x, Point.y);

            return Mapbender.Model.map.olMap.isValidLonLat(lonLat);
        },

    };


})();
