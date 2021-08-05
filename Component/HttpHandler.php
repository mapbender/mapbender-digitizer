<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Component\SchemaFilter;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Bundle\FrameworkBundle\Templating\EngineInterface;

class HttpHandler extends \Mapbender\DataManagerBundle\Component\HttpHandler
{
    /** @var EngineInterface */
    protected $templateEngine;

    public function __construct(EngineInterface $templateEngine,
                                FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter)
    {
        parent::__construct($formFactory, $schemaFilter);
        $this->templateEngine = $templateEngine;
    }

    public function dispatchRequest(Element $element, Request $request)
    {
        $action = $request->attributes->get('action');
        switch ($action) {
            case 'style-editor':
                return $this->getStyleEditorResponse();
            default:
                return parent::dispatchRequest($element, $request);
        }
    }

    protected function getStyleEditorResponse()
    {
        return $this->templateEngine->renderResponse('MapbenderDigitizerBundle:Element:style-editor.html.twig');
    }
}
