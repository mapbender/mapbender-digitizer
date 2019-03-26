window.Mapbender = window.Mapbender || {};
Mapbender.DigitzerPlugins = {};

Mapbender.DigitzerPlugins.geometrylessfeatureAddBtn = function (digitizerInstance) {

    if (!!this.digitizer) {
        return false;
    }
    this.digitizer = digitizerInstance;
    this.registerEventListener();


};

Mapbender.DigitzerPlugins.geometrylessfeatureAddBtn.prototype = {

    addButtonToDigitizer: function () {
        var toolbar = $(this.digitizer.element);
        var button
        if (!(button = this.generateButton())) {
            return false;
        }

        toolbar
            .append(button)
        ;

    },
    generateButton: function () {

        if (this.isButtonAlreadyGenerated()) {
            return false;
        }
        var $btn = $('<button />')
            .addClass('button')
            .addClass('fa fa-plus')
            .addClass('-fn-geometrylessfeatureAdd')
        ;

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
            this.addButtonToDigitizer() ? this.addButtonToDigitizer() : false;
            return false;
        }

        return false;


    },

    isButtonAlreadyGenerated: function () {
        return !!$('.-fn-geometrylessfeatureAdd', this.digitizer.element).length;
    },

    createGeometryLessFeature: function () {
        feature = new OpenLayers.Feature.Vector(NaN, NaN);
        feature.data = {};
        feature.isNew = true;
        feature.schema = this.digitizer.currentSettings;
        layer = this.digitizer.activeLayer;
        layer.addFeatures([feature]);
        feature.layer = layer;

        var properties = $.extend({}, feature.schema.newFeatureDefaultProperties); // clone from newFeatureDefaultProperties


        feature.attributes = feature.data = properties;
        console.log(feature);
        return feature;
    }
};
