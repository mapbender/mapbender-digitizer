<?php


namespace Mapbender\DigitizerBundle\Component;


use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DataManagerBundle\Component\ItemSchema;
use Mapbender\DataManagerBundle\Component\UserFilterProvider;
use Mapbender\DataSourceBundle\Component\FeatureType;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Mapbender\DataSourceBundle\Entity\Feature;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Mapbender\DigitizerBundle\Repository\UserStyleRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;

/**
 * @property SchemaFilter $schemaFilter
 * @method Feature[] searchSchema(Element $element, $schemaName, Request $request)
 */
class HttpHandler extends \Mapbender\DataManagerBundle\Component\HttpHandler
{
    /** @var Environment */
    protected $twig;

    /** @var UserStyleRepository|null */
    private $userStyleRepository;

    /** @var Security|null */
    private $security;

    /** @var TranslatorInterface|null */
    private $translator;

    public function __construct(Environment $twig,
                                FormFactoryInterface $formFactory,
                                SchemaFilter $schemaFilter,
                                UserFilterProvider $userFilterProvider,
                                ?UserStyleRepository $userStyleRepository = null,
                                ?Security $security = null,
                                ?TranslatorInterface $translator = null)
    {
        parent::__construct($formFactory, $schemaFilter, $userFilterProvider);
        $this->twig = $twig;
        $this->userStyleRepository = $userStyleRepository;
        $this->security = $security;
        $this->translator = $translator;
    }

    public function dispatchRequest(Element $element, Request $request)
    {
        $action = $request->attributes->get('action');
        switch ($action) {
            case 'style-editor':
                return $this->getStyleEditorResponse();
            case 'update-multiple':
                return new JsonResponse($this->getUpdateMultipleActionResponseData($element, $request));
            case 'user-styles/list':
                return $this->listUserStyles();
            case 'user-styles/save':
                return $this->saveUserStyle($request);
            case 'user-styles/delete':
                return $this->deleteUserStyle($request);
            case 'user-styles/selector':
                return $this->getUserStyleSelectorResponse();
            default:
                return parent::dispatchRequest($element, $request);
        }
    }

    protected function getStyleEditorResponse()
    {
        $content = $this->twig->render('@MapbenderDigitizer/Element/style-editor.html.twig');
        return new Response($content);
    }

    protected function getUserStyleSelectorResponse()
    {
        $content = $this->twig->render('@MapbenderDigitizer/Element/user-style-selector.html.twig');
        return new Response($content);
    }

    /**
     * Set the user styles table name on the repository.
     */
    public function setUserStylesTable(string $tableName): void
    {
        if ($this->userStyleRepository) {
            $this->userStyleRepository->setTableName($tableName);
        }
    }

    /**
     * Set the user styles connection name on the repository.
     */
    public function setUserStylesConnection(string $connectionName): void
    {
        if ($this->userStyleRepository) {
            $this->userStyleRepository->setConnectionName($connectionName);
        }
    }

    /**
     * Check whether user style persistence is available (table exists).
     * Gracefully returns false on any connection or schema error.
     */
    public function isUserStyleAvailable(): bool
    {
        if (!$this->userStyleRepository) {
            return false;
        }
        return $this->userStyleRepository->tableExists();
    }

    private function getCurrentUserId(): string
    {
        if (!$this->security) {
            throw new \RuntimeException('Security service not available');
        }
        $user = $this->security->getUser();
        if (!$user) {
            throw new \RuntimeException('No authenticated user available');
        }
        return $user->getUserIdentifier();
    }

    private function trans(string $id): string
    {
        if ($this->translator) {
            return $this->translator->trans($id);
        }
        return $id;
    }

    private function listUserStyles(): JsonResponse
    {
        if (!$this->userStyleRepository) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.featureNotConfigured')], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        $userId = $this->getCurrentUserId();
        $styles = $this->userStyleRepository->findAllSortedByUser($userId);
        $data = array_map(function($style) use ($userId) {
            $row = $style->toArray();
            $row['canDelete'] = ($style->getUserId() === $userId);
            return $row;
        }, $styles);
        return new JsonResponse($data);
    }

    private function saveUserStyle(Request $request): JsonResponse
    {
        if (!$this->userStyleRepository) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.featureNotConfigured')], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.invalidJsonPayload')], Response::HTTP_BAD_REQUEST);
        }
        $userId = $this->getCurrentUserId();
        $name = $data['name'] ?? null;
        $styleConfig = $data['styleConfig'] ?? null;
        $id = $data['id'] ?? null;

        if (!$name || !$styleConfig || !\is_array($styleConfig)) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.nameAndConfigRequired')], Response::HTTP_BAD_REQUEST);
        }

        if ($id) {
            $result = $this->userStyleRepository->update($userId, (int)$id, $name, $styleConfig);
            if (!$result) {
                return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.notFoundOrNotAuthorized')], Response::HTTP_NOT_FOUND);
            }
        } else {
            $result = $this->userStyleRepository->create($userId, $name, $styleConfig);
        }
        return new JsonResponse($result->toArray());
    }

    private function deleteUserStyle(Request $request): JsonResponse
    {
        if (!$this->userStyleRepository) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.featureNotConfigured')], Response::HTTP_SERVICE_UNAVAILABLE);
        }
        $data = json_decode($request->getContent(), true);
        if (!\is_array($data)) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.invalidJsonPayload')], Response::HTTP_BAD_REQUEST);
        }
        $userId = $this->getCurrentUserId();
        $id = $data['id'] ?? null;

        if (!$id) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.idRequired')], Response::HTTP_BAD_REQUEST);
        }
        $deleted = $this->userStyleRepository->delete($userId, (int)$id);
        if (!$deleted) {
            return new JsonResponse(['error' => $this->trans('mb.digitizer.userStyle.notFoundOrNotAuthorized')], Response::HTTP_NOT_FOUND);
        }
        return new JsonResponse(['success' => true]);
    }

    /**
     * @param Element $element
     * @param Request $request
     * @return array
     */
    protected function getUpdateMultipleActionResponseData(Element $element, Request $request)
    {
        $dataOut = array(
            'saved' => array(),
        );
        // NOTE: Client always sends geometry as a separate "geometry" attribute, while
        //       Feature creation expects an attribute matching the (configured) geometry
        //       column name. Adapt incoming data.
        $requestData = json_decode($request->getContent(), true);
        $common = array(
            'srid' => $requestData['srid'],
        );
        foreach ($requestData['features'] as $featureData) {
            $schemaName = $featureData['schemaName'];
            /** @var ItemSchema $schema */
            $schema = $this->schemaFilter->getSchema($element, $schemaName);
            $feature = $schema->getRepository()->getById($featureData['idInSchema']);
            if (!$feature) {
               $feature = $schema->getRepository()->itemFactory();
            }
            $updatedFeature = $this->saveItem($schema, $feature, $common + $featureData);
            $dataOut['saved'][] = $this->formatResponseItem($schema, $updatedFeature) + array(
                'uniqueId' => $featureData['uniqueId'],
            );
        }
        return $dataOut;
    }

    /**
     * @param ItemSchema $schema
     * @param Feature $item
     * @param array $postData
     * @return Feature
     */
    protected function saveItem(ItemSchema $schema, DataItem $item, array $postData)
    {
        /** @var Feature $item */
        if (!empty($postData['geometry'])) {
            $item->setGeom($postData['geometry']);
            $item->setSrid($postData['srid']);
        }
        return parent::saveItem($schema, $item, $postData);
    }

    protected function getSelectCriteria(ItemSchema $schema, Request $request, $limit)
    {
        $connection = $schema->getRepository()->getConnection();
        $geomReference = $connection->quoteIdentifier($schema->getRepository()->getGeomField());
        $criteria = parent::getSelectCriteria($schema, $request, $limit) + array(
            'srid' => intval($request->query->get('srid')),
        );
        $where = "$geomReference IS NOT NULL";
        if (!empty($criteria['where'])) {
            $where = \implode(' AND ', array($criteria['where'], $where));
        }
        $criteria['where'] = $where;
        if ($extent = $request->query->get('extent')) {
            $extentCoordinates = explode(',', $extent);
            $polygonCoordinates = array(
                // CCW, lb => rb => rt => lt => back to lb
                "{$extentCoordinates[0]} {$extentCoordinates[1]}",
                "{$extentCoordinates[2]} {$extentCoordinates[1]}",
                "{$extentCoordinates[2]} {$extentCoordinates[3]}",
                "{$extentCoordinates[0]} {$extentCoordinates[3]}",
                "{$extentCoordinates[0]} {$extentCoordinates[1]}",
            );
            $polygonWkt = 'POLYGON((' . implode(',', $polygonCoordinates) . '))';
            $criteria['intersect'] = $polygonWkt;
        }
        return $criteria;
    }

    /**
     * @param ItemSchema $schema
     * @param Feature $item
     * @return array
     */
    protected function formatResponseItem(ItemSchema $schema, DataItem $item)
    {
        /** @var FeatureType $repository */
        $repository = $schema->getRepository();
        $formatted = parent::formatResponseItem($schema, $item) + array(
            'geometry' => $item->getGeom(),
        );
        unset($formatted['properties'][$repository->getGeomField()]);
        return $formatted;
    }
}
