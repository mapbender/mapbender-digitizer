<?php


namespace Mapbender\DataManagerBundle\Element;


use Mapbender\Component\Element\AbstractElementService;
use Mapbender\Component\Element\TemplateView;
use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Component\HttpHandler;
use Mapbender\DataManagerBundle\Component\SchemaFilter;
use Mapbender\DataSourceBundle\Component\RepositoryRegistry;

class DataManager extends AbstractElementService
{
    /** @var RepositoryRegistry */
    protected $registry;
    /** @var SchemaFilter */
    protected $schemaFilter;
    /** @var HttpHandler */
    protected $httpHandler;

    public function __construct(RepositoryRegistry $registry,
                                SchemaFilter $schemaFilter,
                                HttpHandler $httpHandler)
    {
        $this->registry = $registry;
        $this->schemaFilter = $schemaFilter;
        $this->httpHandler = $httpHandler;
    }

    public static function getClassTitle()
    {
        // @todo: translations
        return "mb.datamanager.class.title";
    }

    public static function getClassDescription()
    {
        // @todo: translation
        return "mb.datamanager.class.description";
    }


    public function getWidgetName(Element $element)
    {
        return 'mapbender.mbDataManager';
    }

    public static function getDefaultConfiguration()
    {
        return array(
            'schemes' => null,
            'pattern' => '^[\p{L}0-9_\-\s]*$'
        );
    }

    public function getView(Element $element)
    {
        $view = new TemplateView('@MapbenderDataManager/Element/DataManager.html.twig');
        $view->attributes['class'] = 'mb-element-data-manager';
        return $view;
    }

    public function getRequiredAssets(Element $element)
    {
        return array(
            'css' => array(
                '@MapbenderDataManagerBundle/Resources/styles/dataManager.element.scss',
            ),
            'js' => array(
                '@MapbenderDataManagerBundle/Resources/public/FormRenderer.js',
                '@MapbenderDataManagerBundle/Resources/public/FormUtil.js',
                '@MapbenderDataManagerBundle/Resources/public/DialogFactory.js',
                '../vendor/blueimp/jquery-file-upload/js/jquery.fileupload.js',
                '@MapbenderDataManagerBundle/Resources/public/TableRenderer.js',
                '@MapbenderDataManagerBundle/Resources/public/dataManager.element.js',
            ),
            'trans' => array(
                'mb.data-manager.*',
                'mb.data.store.*',  // legacy quirk: this is in our translation catalogs
            ),
        );
    }

    public static function getFormTemplate()
    {
        return '@MapbenderDataManager/ElementAdmin/dataManager.html.twig';
    }

    public static function getType()
    {
        return 'Mapbender\DataManagerBundle\Element\Type\DataManagerAdminType';
    }

    public function getClientConfiguration(Element $element)
    {
        $configuration = $element->getConfiguration();
        $configuration['schemes'] = $this->schemaFilter->prepareConfigs($element);
        return $configuration;
    }

    /**
     * @param Element $element
     * @return HttpHandler
     */
    public function getHttpHandler(Element $element)
    {
        return $this->httpHandler;
    }
}
