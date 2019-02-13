OpenLayers.Feature.prototype.applyStyle = function (styleData) {
    var olFeature = this;
    var style = new OpenLayers.Style(styleData);
    var styleId = styleData.id || Mapbender.Util.UUID();
    olFeature._deleteOldStyleFromStyleMap(styleId);
    olFeature._addNewStyleToStyleMap(styleId,style);
    olFeature.styleId = styleId;
    olFeature.redraw(styleId);

};

OpenLayers.Feature.prototype._deleteOldStyleFromStyleMap = function(newStyleId) {
    var olFeature = this;
    var styleMap = olFeature.layer.options.styleMap;
    if (olFeature.styleId && olFeature.styleId !== newStyleId) {
        delete styleMap.styles[olFeature.styleId];
    }
};

OpenLayers.Feature.prototype._addNewStyleToStyleMap = function(newStyleId,style) {
    var olFeature = this;
    var styleMap = olFeature.layer.options.styleMap;
    styleMap.styles[newStyleId] = style;

};

OpenLayers.Feature.prototype.redraw = function(highlightOrStyle) {
    var feature = this;
    var layer = feature.layer;

    if (typeof highlightOrStyle == "string") {
        layer.drawFeature(feature,highlightOrStyle);

    } else {
        var highlight = !!highlightOrStyle;
        var styleId = (feature.isNew || feature.isChanged) ? 'unsaved' : feature.styleId || 'default';

        if (feature.attributes && feature.attributes.label) {
            layer.drawFeature(feature, highlight ? 'labelTextHover' : 'labelText');
        } else {
            if (highlight) {
                layer.drawFeature(feature, 'select');
            } else {
                if (feature.selected) {
                    layer.drawFeature(feature, 'selected');
                } else {
                    layer.drawFeature(feature, styleId);
                }
            }
        }
    }

};