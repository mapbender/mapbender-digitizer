<?php


namespace Mapbender\DataManagerBundle\Component;

use Mapbender\Component\Element\ElementHttpHandlerInterface;
use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Exception\ConfigurationErrorException;
use Mapbender\DataManagerBundle\Exception\UnknownSchemaException;
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

    public function __construct(FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter)
    {
        $this->formFactory = $formFactory;
        $this->schemaFilter = $schemaFilter;
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
        } catch (\Doctrine\DBAl\Exception $e) {
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
        if (!$this->schemaFilter->checkAllowSave($element, $schemaName, !$itemId)) {
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
        $schemaName = $request->query->get('schema');
        if (!$this->schemaFilter->checkAllowDelete($element, $schemaName)) {
            return new JsonResponse(array('message' => "It is not allowed to edit this data"), JsonResponse::HTTP_FORBIDDEN);
        }
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
        $id = $request->query->get('id');
        return new JsonResponse($repository->remove($id));
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
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
        $requestData = json_decode($request->getContent(), true);
        if ($itemId) {
            // update existing item
            $dataItem = $repository->getById($itemId);
        } else {
            // store new item
            $dataItem = $repository->itemFactory();
        }
        $dataItem->setAttributes($requestData['dataItem']);
        return array(
            'dataItem' => $repository->save($dataItem)->toArray(),
        );
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     */
    protected function getSelectActionResponseData(Element $element, Request $request)
    {
        $schemaName = $request->query->get('schema');
        $repository = $this->schemaFilter->getDataStore($element, $schemaName);
        $results = array();
        $criteria = array();
        $schemaConfig = $this->schemaFilter->getRawSchemaConfig($element, $schemaName, true);
        if (!empty($schemaConfig['maxResults'])) {
            $criteria['maxResults'] = $schemaConfig['maxResults'];
        }
        foreach ($repository->search($criteria) as $dataItem) {
            $results[] = $dataItem->toArray();
        }
        return $results;
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
        if (!$this->schemaFilter->checkAllowSave($element, $schemaName, false)) {
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
