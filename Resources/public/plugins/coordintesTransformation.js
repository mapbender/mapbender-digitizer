window.Mapbender = window.Mapbender || {};



Mapbender.Transformation = {

    isDegree : function (coordinate) {
        var isDM = coordinate.match(/(\d*)\°([\d.]*)\'/) === 6;
        var isDMS = coordinate.match(/(\d*)\°(\d*)\'([\d.]*)\"/) === 9;
        return isDM || isDMS;
    },

    tranformDegreeToDecimal : function(coordinate){
        if(!this.isDegree(coordinate)) {
            return false;
        }
        var match = coordinate.match(/(\d*)\°([\d.]*)\'/) ;
        match = match.length === 6 ?  match : coordinate.match(/(\d*)\°(\d*)\'([\d.]*)\"/);

        var decimals = (parseFloat(match[1])) + parseFloat((match[2]/60));
        if(isDMS){
            decimals = decimals + parseFloat((match[3]/3600))
        }
        return  decimals;
    },

    transformToMapProj: function(x,y, from) {

        var c = new OpenLayers.LonLat(x,y)
        var to = Mapbender.Model.map.olMap.getProjectionObject();
        var from = new OpenLayers.Projection(from.projCode || from);
        return this.transFromFromTo(c,from,to);
    },

    transformFromMapProj: function(x,y, to) {

        var c = new OpenLayers.LonLat(x,y)
        var from = Mapbender.Model.map.olMap.getProjectionObject();

        var to = new OpenLayers.Projection(to.projCode || to);
        return this.transFromFromTo(c,from,to);
    },

    transFromFromTo : function(lonlat, to, from){

        var c = lonlat.transform(from,to);

        return {x: c.lon,y: c.lat}


    },
    areCoordinatesValid: function (coords) {
        if (!$.isNumeric(coords.x) || !$.isNumeric(coords.y)) {
            return false;
        }

        var Point = new Proj4js.Point(coords.x, coords.y);
        var currentProjection =  this.getMapProjectionObj();

        Proj4js.transform(currentProjection, currentProjection, Point);

        var lonLat = new OpenLayers.LonLat(Point.x, Point.y);

        return this.getMap().isValidLonLat(lonLat);
    },

    getMapProjectionObj : function () {
        return this.getMap().getProjectionObject();
    },

    getMap : function () {
        return Mapbender.Model.map.olMap;
    }
};

