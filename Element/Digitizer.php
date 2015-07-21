<?php

namespace Mapbender\DigitizerBundle\Element;

use Doctrine\DBAL\DBALException;
use Mapbender\CoreBundle\Element\HTMLElement;
use Mapbender\DigitizerBundle\Entity\FeatureType;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 *
 */
class Digitizer extends HTMLElement
{

    /**
     * @inheritdoc
     */
    static public function getClassTitle()
    {
        return "Digitizer";
    }

    /**
     * @inheritdoc
     */
    static public function getClassDescription()
    {
        return "Digitizer";
    }

    /**
     * @inheritdoc
     */
    static public function getTags()
    {
        return array();
    }

    /**
     * @inheritdoc
     */
    public function getWidgetName()
    {
        return 'mapbender.mbDigitizer';
    }

    /**
     * @inheritdoc
     */
    static public function listAssets()
    {
        return array('js'    => array(
                        "/components/jquery-context-menu/jquery-context-menu-built.js",
                        'mapbender.element.digitizer.js',
                        '@FOMCoreBundle/Resources/public/js/widgets/popup.js',
                        '@FOMCoreBundle/Resources/public/js/widgets/dropdown.js'),
                     'css'   => array('sass/element/digitizer.scss'),
                     'trans' => array(
                         '@MapbenderDigitizerBundle/Resources/views/Element/digitizer.json.twig'
                     ));
    }

    /**
     * @inheritdoc
     */
    public static function getDefaultConfiguration()
    {
        return array(
            "target" => null
        );
    }

    /**
     * Prepare form items for each scheme definition
     * Optional: get featureType by name from global context.
     *
     * @inheritdoc
     */
    public function getConfiguration()
    {
        $configuration          = parent::getConfiguration();
        $configuration['debug'] = isset($configuration['debug']) ? $configuration['debug'] : false;

        if ($configuration["schemes"] && is_array($configuration["schemes"])) {
            foreach ($configuration["schemes"] as $key => &$scheme) {
                if (is_string($scheme['featureType'])) {
                    $featureTypes          = $this->container->getParameter('featureTypes');
                    $scheme['featureType'] = $featureTypes[$scheme['featureType']];
                }
                if (isset($scheme['formItems'])) {
                    $scheme['formItems'] = $this->prepareItems($scheme['formItems']);
                }
            }
        }
        return $configuration;
    }

    /**
     * @inheritdoc
     */
    public static function getType()
    {
        return 'Mapbender\DigitizerBundle\Element\Type\DigitizerAdminType';
    }

    /**
     * @inheritdoc
     */
    public static function getFormTemplate()
    {
        return 'MapbenderDigitizerBundle:ElementAdmin:digitizeradmin.html.twig';
    }

    /**
     * @inheritdoc
     */
    public function render()
    {
        return $this->container->get('templating')
            ->render('MapbenderDigitizerBundle:Element:digitizer.html.twig',
                array(
                    'id'            => $this->getId(),
                    'title'         => $this->getTitle(),
                    'configuration' => $this->getConfiguration()
                ));
    }

    /**
     * Prepare request feautre data by the form definition
     *
     * @param $feature
     * @param $formItems
     * @return array
     */
    protected function prepareQueredFeatureData($feature, $formItems)
    {
        foreach ($formItems as $key => $formItem) {
            if (isset($formItem['children'])) {
                $feature = array_merge($feature, $this->prepareQueredFeatureData($feature, $formItem['children']));
            } elseif (isset($formItem['type']) && isset($formItem['name'])) {
                switch ($formItem['type']) {
                    case 'select':
                        if (isset($formItem['multiple'])) {
                            $fieldType                  = isset($formItem['fieldType']) ? $formItem['fieldType'] : 'text';
                            $separator                  = isset($formItem['separator']) ? $formItem['separator'] : ',';
                            if(is_array($feature["properties"][$formItem['name']])){
                                $feature["properties"][$formItem['name']] = implode($separator, $feature["properties"][$formItem['name']]);
                            }
                        }
                        break;
                }
            }
        }
        return $feature;
    }

    /**
     * @inheritdoc
     */
    public function httpAction($action)
    {
        $configuration = $this->getConfiguration();
        $request       = json_decode($this->container->get('request')->getContent(), true);
        $schemas       = $configuration["schemes"];
        $schema        = $schemas[$request["schema"]];

        if (is_array($schema['featureType'])) {
            $featureType = new FeatureType($this->container, $schema['featureType']);
        } else {
            throw new Exception("FeatureType settings not correct");
        }

        $results = array();

        switch ($action) {
            case 'select':
                $defaultCriteria = array('returnType' => 'FeatureCollection',
                                         'maxResults' => 2);
                $results         = $featureType->search(array_merge($defaultCriteria, $request));
                break;

            case 'save':
                // save once
                if (isset($request['feature'])) {
                    $request['features'] = array($request['feature']);
                }

                try {
                    // save collection
                    if (isset($request['features']) && is_array($request['features'])) {
                        foreach ($request['features'] as $feature) {
                            $feature   = $this->prepareQueredFeatureData($feature, $schema['formItems']);
                            $results[] = $featureType->save($feature);
                        }
                    }
                    $results = $featureType->toFeatureCollection($results);
                } catch (DBALException $e) {
                    $message = $configuration['debug'] ? $e->getMessage() : "Feature saving isn't possible. Maybe something is wrong konfigured or databate isn't avaible?  \n" .
                        "For more information please look at web-server log file.\n" .
                        "Another option is to turn debug mode on by adding 'debug=true' to the digitizer element,\n " .
                        "so you can see full SQL query and error message here directly. \n Error code: " .$e->getCode();
                    $results = array('errors' => array(
                        array('message' => $message, 'code' => $e->getCode())
                    ));
                }

                break;

            case 'delete':
                // remove once
                $results = $featureType->remove($request['feature'])->getId();
                break;
        }

        return new JsonResponse($results);
    }
}