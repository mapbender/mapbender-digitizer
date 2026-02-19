<?php


namespace Mapbender\DataManagerBundle\Component;

use Mapbender\Component\Element\ElementHttpHandlerInterface;
use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataManagerBundle\Exception\UnknownSchemaException;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Data manager http handler for new (Mapbender >= 3.2.6) service Element
 * API.
 */
class HttpHandler implements ElementHttpHandlerInterface
{
    /** @var FormFactoryInterface */
    protected $formFactory;
    /** @var SchemaFilter */
    protected $schemaFilter;
    /** @var UserFilterProvider */
    protected $userFilterProvider;

    public function __construct(FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter,
                                UserFilterProvider $userFilterProvider)
    {
        $this->formFactory = $formFactory;
        $this->schemaFilter = $schemaFilter;
        $this->userFilterProvider = $userFilterProvider;
    }

    public function handleRequest(Element $element, Request $request)
    {
        try {
            $response = $this->dispatchRequest($element, $request);
            if (!$response) {
                $action = $request->attributes->get('action');
                $response = new JsonResponse(array('message' => 'Unsupported action ' . $action), JsonResponse::HTTP_BAD_REQUEST);
            }
            return $response;
        } catch (UnknownSchemaException $e) {
            return new JsonResponse(array('message' => $e->getMessage()), JsonResponse::HTTP_NOT_FOUND);
        } catch (\Doctrine\DBAL\Exception $e) {
            return new JsonResponse(array('message' => $e->getMessage()), JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return Response|null
     * @throws UnknownSchemaException
     * @throws ConfigurationErrorException
     */
    public function dispatchRequest(Element $element, Request $request)
    {
        $schemaMatches = array();
        $action = $request->attributes->get('action');
        if (\preg_match('#^([\w\d\-_]+)/(attachment)$#', $action, $schemaMatches)) {
            $schemaName = $schemaMatches[1];
            $schemaAction = $schemaMatches[2];
            if ($response = $this->dispatchSchemaRequest($element, $request, $schemaName, $schemaAction)) {
                return $response;
            }
        }

        $action = $request->attributes->get('action');
        switch ($action) {
            case 'select':
                return $this->selectAction($element, $request);
            case 'save':
                return $this->saveAction($element, $request);
            case 'delete':
                return $this->deleteAction($element, $request);
            case 'grants':
                return $this->grantsAction($element);
            default:
                return null;
        }
    }

    protected function dispatchSchemaRequest(Element $element, Request $request, $schemaName, $schemaAction)
    {
        switch ($schemaAction) {
            case 'attachment':
                switch ($request->getMethod()) {
                    case Request::METHOD_POST:
                    case Request::METHOD_PUT:
                        return $this->fileUploadAction($element, $request, $schemaName);
                    case Request::METHOD_GET:
                        return $this->fileDownloadAction($element, $request, $schemaName);
                    default:
                        throw new BadRequestHttpException();
                }
            default:
                return null;
        }
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return JsonResponse
     */
    protected function selectAction(Element $element, Request $request)
    {
        return new JsonResponse($this->getSelectActionResponseData($element, $request));
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return JsonResponse
     * @throws \Exception
     */
    protected function saveAction(Element $element, Request $request)
    {
        $itemId = $request->query->get('id', null);
        $schemaName = $request->query->get('schema');
        $schema = $this->schemaFilter->getSchema($element, $schemaName);
        if (!$this->schemaFilter->checkAllowSave($schema, !$itemId)) {
            return new JsonResponse(array('message' => "It is not allowed to edit this data"), JsonResponse::HTTP_FORBIDDEN);
        }
        return new JsonResponse($this->getSaveActionResponseData($element, $request));
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return JsonResponse
     */
    protected function deleteAction(Element $element, Request $request)
    {
        $schema = $this->schemaFilter->getSchema($element, $request->query->get('schema'));
        if (!$this->schemaFilter->checkAllowDelete($schema)) {
            return new JsonResponse(array('message' => "It is not allowed to edit this data"), JsonResponse::HTTP_FORBIDDEN);
        }
        $id = $request->query->get('id');
        return new JsonResponse($schema->getRepository()->remove($id));
    }

    protected function grantsAction(Element $element)
    {
        return new JsonResponse($this->schemaFilter->getAllGrants($element));
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     * @throws \Exception
     */
    protected function getSaveActionResponseData(Element $element, Request $request)
    {
        $itemId = $request->query->get('id', null);
        $schemaName = $request->query->get('schema');
        /** @var ItemSchema $schema */
        $schema = $this->schemaFilter->getSchema($element, $schemaName);
        $requestData = json_decode($request->getContent(), true);
        if ($itemId) {
            // update existing item
            $dataItem = $schema->getRepository()->getById($itemId);
        } else {
            // store new item
            $dataItem = $schema->getRepository()->itemFactory();
        }
        $this->validateInputData($element->getConfiguration(), $schema->config, $requestData);
        $itemOut = $this->saveItem($schema, $dataItem, $requestData);
        return array(
            'dataItem' => $this->formatResponseItem($schema, $itemOut),
        );
    }

    protected function saveItem(ItemSchema $schema, DataItem $item, array $postData)
    {
        $item->setAttributes($postData['properties']);
        $userData = $this->userFilterProvider->getStorageValues($schema, $item);
        $item->setAttributes($userData);
        return $schema->getRepository()->save($item);
    }

    protected function validateInputData($elementConfig, $schemaConfig, $requestData)
    {
        $pattern = $elementConfig['pattern'];
        $this->iterateFormItems($schemaConfig['formItems'], $pattern, $requestData);
    }

    protected function iterateFormItems($formItems, $pattern, $requestData)
    {
        foreach ($formItems as $formItem) {
            if (array_key_exists('children', $formItem)) {
                $this->iterateFormItems($formItem['children'], $pattern, $requestData);
            } else {
                if (array_key_exists('name', $formItem) && !empty($requestData['properties'][$formItem['name']])) {
                    $pattern = (!empty($formItem['attr']['pattern'])) ? $formItem['attr']['pattern'] : $pattern;
                    if (!preg_match('/' . $pattern . '/u', $requestData['properties'][$formItem['name']])) {
                        throw new BadRequestHttpException('api.query.error-invalid-data');
                    }
                }
            }
        }
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     */
    protected function getSelectActionResponseData(Element $element, Request $request)
    {
        $schemaName = $request->query->get('schema');
        $schema = $this->schemaFilter->getSchema($element, $schemaName);
        if (!empty($schema->config['combine'])) {
            $selectSchemaNames = $schema->config['combine'];
        } else {
            $selectSchemaNames = array($schemaName);
        }
        $limitTotal = !empty($schema->config['maxResults']) ? $schema->config['maxResults'] : null;
        $results = array();
        foreach ($selectSchemaNames as $delegatingSchemaName) {
            $subSchema = $this->schemaFilter->getSchema($element, $delegatingSchemaName);
            // @todo: criteria reuse (esp. intersect)?
            if (!$this->schemaFilter->getSchemaAccess($subSchema)) {
                continue;
            }

            $limitSchema = !empty($subSchema->config['maxResults']) ? \intval($subSchema->config['maxResults']) : null;
            $limitSchema = $this->calculateSchemaLimit($limitTotal, $limitSchema, count($results));
            if ($limitSchema !== null && $limitSchema <= 0) {
                continue;
            }
            $criteria = $this->getSelectCriteria($subSchema, $request, $limitSchema);

            foreach ($subSchema->getRepository()->search($criteria) as $item) {
                $results[] = $this->formatResponseItem($subSchema, $item);
            }
        }
        return $results;
    }

    /**
     * @param int|null $limitTotal
     * @param int|null $limitSchema
     * @param int $limitUsed
     * @return int|null
     */
    protected function calculateSchemaLimit($limitTotal, $limitSchema, $limitUsed)
    {
        if (!$limitTotal && !$limitSchema) {
            return null;
        }
        if ($limitTotal) {
            $limitTotal = \intval($limitTotal);
            return max(0, min($limitTotal - $limitUsed, \intval($limitSchema ?: $limitTotal)));
        } else {
            return max(0, \intval($limitSchema) - $limitUsed);
        }
    }

    protected function formatResponseItem(ItemSchema $schema, DataItem $item)
    {
        return array(
            'id' => $item->getId(),
            'schemaName' => $schema->getName(),
            'properties' => $item->toArray(),
        );
    }

    protected function getSelectCriteria(ItemSchema $schema, Request $request, $limit)
    {
        $criteria = array();
        if (!empty($limit)) {
            $criteria['maxResults'] = $limit;
        }
        if (!empty($schema->config['filterUser'])) {
            $criteria['where'] = $this->userFilterProvider->getFilterSql($schema);
        }

        return $criteria;
    }

    protected function fileDownloadAction(Element $element, Request $request, $schemaName)
    {
        if (!($fieldName = $request->query->get('field'))) {
            throw new BadRequestHttpException('Missing field name');
        }
        $baseName = $request->query->get('name');
        $targetDirs =$this->schemaFilter->getUploadPaths($element, $schemaName, $fieldName);
        foreach ($targetDirs as $targetDir) {
            $path = "{$targetDir}/{$baseName}";
            if ($baseName && \is_file($path)) {
                $response = new BinaryFileResponse($path);
                $response->isNotModified($request);
                $response->headers->add(array(
                    'X-Local-Path' => $path,
                ));
                return $response;
            }
        }
        throw new NotFoundHttpException();
    }

    /**
     * @param Element $element
     * @param Request $request
     * @param string $schemaName
     * @return JsonResponse
     */
    protected function fileUploadAction(Element $element, Request $request, $schemaName)
    {
        $schema = $this->schemaFilter->getSchema($element, $schemaName);
        if (!$this->schemaFilter->checkAllowSave($schema, false)) {
            return new JsonResponse(array('message' => "It is not allowed to edit this data"), JsonResponse::HTTP_FORBIDDEN);
        }
        $fieldName = $request->query->get('field');

        $form = $this->formFactory->createNamed('files', 'Symfony\Component\Form\Extension\Core\Type\FileType', null, array(
            'property_path' => 'files',
            // @todo: blueimp client cannot disable multiple file supprt; drop if blueimp client removed / possible otherwise
            'multiple' => true,
        ));
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid() && $data = $form->getData()) {
            assert(\is_array($data) && count($data) === 1);
            // @todo: blueimp client cannot disable multiple file supprt; drop if blueimp client removed / possible otherwise
            $data = $data[0];
            $targetDir = $this->schemaFilter->getUploadPath($element, $schemaName, $fieldName);
            $targetFile = $this->moveUpload($data, $targetDir);

            return new JsonResponse(array(
                'filename' => $targetFile->getFilename(),
            ));
        } else {
            throw new BadRequestHttpException();
        }
    }

    /**
     * @param UploadedFile $file
     * @param string $targetDir
     * @return \Symfony\Component\HttpFoundation\File\File
     */
    protected function moveUpload(UploadedFile $file, $targetDir)
    {
        $fs = new Filesystem();
        if (!$fs->isAbsolutePath($targetDir)) {
            $webDir = \preg_replace('#^(.*?)[\w_]*\.php#i', '$1', $_SERVER['SCRIPT_FILENAME']);
            $targetDir = $webDir . $targetDir;
        }
        $fs->mkdir($targetDir);
        $suffix = null;
        $counter = 1;
        // Disambiguate
        $initialName = $name = $file->getClientOriginalName();
        do {
            $fullPath = "{$targetDir}/{$name}";
            if (!\file_exists($fullPath)) {
                break;
            }
            $suffix = ".{$counter}";
            $name = \preg_replace('#(\.\w+)$#i', $suffix . '$1', $initialName);
            ++$counter;
        } while (true);

        return $file->move($targetDir, $name);
    }
}
