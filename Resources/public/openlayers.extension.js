OpenLayers.Feature.prototype.redraw = function (highlight) {
    var feature = this;
    var layer = feature.layer;


    var styleType = (feature.isNew || feature.isChanged) ? 'unsaved' : 'default';

    if (feature.attributes && feature.attributes.label) {
        layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
    } else {
        if (highlight) {
            layer.drawFeature(feature, 'select');
        } else {
            if (feature.selected) {
                layer.drawFeature(feature, 'selected');
            } else {
                layer.drawFeature(feature, feature.style ? null : styleType);
            }
        }
    }


};

OpenLayers.Feature.prototype.applyStyle = function (style) {
    var feature = this;
    var layer = feature.layer;
    console.log(style);
    layer.drawFeature(feature, style);

};

OpenLayers.Feature.prototype.equals = function (feature) {
    return this.fid === feature.fid;
};

OpenLayers.Feature.prototype.isNew = false;
OpenLayers.Feature.prototype.isChanged = false;
OpenLayers.Feature.prototype.disabled = false;




