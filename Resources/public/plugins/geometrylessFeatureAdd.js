window.Mapbender = window.Mapbender || {};
Mapbender.DigitzerPlugins = Mapbender.DigitzerPlugins || {};

Mapbender.DigitzerPlugins.GeometrylessfeatureAddBtn = function (digitizerInstance) {

    if (!!this.digitizer) {
        return false;
    }
    this.digitizer = digitizerInstance;
    this.registerEventListener();


};

Mapbender.DigitzerPlugins.GeometrylessfeatureAddBtn.prototype = {

    addButtonToDigitizer: function () {
        var toolbar = $(this.digitizer.element);
        var button;
        if (!(button = this.generateButton())) {
            return false;
        }

        toolbar.append(button);

    },

    isButtonAlreadyGenerated: function () {
        return !!$('.-fn-geometrylessfeatureAdd', this.digitizer.element).length;
    },

    generateButton: function () {

        if (this.isButtonAlreadyGenerated()) {
            return false;
        }
        var $btn = $('<button/>')
            .addClass('button')
            .addClass('-fn-geometrylessfeatureAdd');

        $('<i class="fa fa-plus" />').appendTo($btn);

        return $btn;
    },

    registerEventListener: function () {
        $(this.digitizer).on('schemaChanged', this.toggleSchemeVisibilty.bind(this));
        $(this.digitizer.element).on('click','.-fn-geometrylessfeatureAdd', this.openDigitizerDialog.bind(this));
    },

    openDigitizerDialog: function () {
        if(!this.digitizer.activeLayer){
            Mapbender.error('mb.digitizer.notReady');
            return false;
        }

        var feature = this.createGeometryLessFeature();
        this.digitizer._openFeatureEditDialog.call(this.digitizer, feature);
    },

    toggleSchemeVisibilty: function () {


        var schema = this.digitizer.currentSettings;

        if (schema.geometrylessfeatureBtn) {
            this.addButtonToDigitizer();
        }

    },

    createGeometryLessFeature: function () {
        var feature = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(NaN, NaN));
        feature.data = {};
        feature.isNew = true;
        feature.schema = this.digitizer.currentSettings;
        feature.renderIntent = "unsaved";
        var layer = this.digitizer.activeLayer;
        layer.addFeatures([feature]);
        feature.layer = layer;

        var properties = $.extend({}, feature.schema.newFeatureDefaultProperties); // clone from newFeatureDefaultProperties
        feature.attributes = feature.data = properties;

        return feature;
    }
};
