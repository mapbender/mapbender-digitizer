<?php
namespace Mapbender\DataSourceBundle\Component;

use Doctrine\DBAL\Connection;
use Mapbender\DataSourceBundle\Entity\DataItem;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class DataStore extends EventAwareDataRepository
{
    /**
     * @param Connection $connection
     * @param TokenStorageInterface $tokenStorage
     * @param EventProcessor $eventProcessor
     * @param array|null $args
     */
    public function __construct(Connection $connection, TokenStorageInterface $tokenStorage, EventProcessor $eventProcessor, $args = array())
    {
        $eventConfig = isset($args["events"]) ? $args["events"] : array();
        $filter = (!empty($args['filter'])) ? $args['filter'] : null;
        parent::__construct($connection, $tokenStorage, $eventProcessor, $eventConfig, $args['table'], $args['uniqueId'], $args['fields'], $filter);
    }

    /**
     * Save data item. Auto-inflects to insert (no id) or update (non-empty id).
     *
     * @param DataItem|array $itemOrData Data item
     * @return DataItem
     * @throws \Exception
     */
    public function save($itemOrData)
    {
        $saveItem = \is_array($itemOrData) ? $this->itemFromArray($itemOrData) : $itemOrData;
        if (isset($this->events[self::EVENT_ON_BEFORE_SAVE]) || isset($this->events[self::EVENT_ON_AFTER_SAVE])) {
            $eventData = $this->getSaveEventData($saveItem);
        } else {
            $eventData = null;
        }

        if (isset($this->events[self::EVENT_ON_BEFORE_SAVE])) {
            $this->eventProcessor->runExpression($this->events[self::EVENT_ON_BEFORE_SAVE], $eventData);
            $runSave = $this->eventProcessor->allowSave;
        } else {
            $runSave = true;
        }
        if ($runSave) {
            if (!$saveItem->getId()) {
                $itemOut = $this->insertItem($saveItem);
            } else {
                $itemOut = $this->updateItem($saveItem);
            }
        } else {
            $itemOut = $saveItem;
        }

        if (isset($this->events[self::EVENT_ON_AFTER_SAVE])) {
            $this->eventProcessor->runExpression($this->events[self::EVENT_ON_AFTER_SAVE], $eventData);
        }
        return $itemOut;
    }

    /**
     * Insert new row
     *
     * @param array|DataItem $itemOrData
     * @return DataItem
     */
    public function insert($itemOrData)
    {
        $item = \is_array($itemOrData) ? $this->itemFromArray($itemOrData) : $itemOrData;
        return $this->insertItem($item);
    }

    /**
     * Update existing row
     *
     * @param array|DataItem $itemOrData
     * @return DataItem
     */
    public function update($itemOrData)
    {
        $item = \is_array($itemOrData) ? $this->itemFromArray($itemOrData) : $itemOrData;
        return $this->updateItem($item);
    }

    /**
     * Remove data item
     * @param int|DataItem $itemOrId
     * @return int number of deleted rows
     */
    public function remove($itemOrId)
    {
        $itemId = !\is_object($itemOrId) ? $itemOrId : $itemOrId->getId();
        if (isset($this->events[self::EVENT_ON_BEFORE_REMOVE]) || isset($this->events[self::EVENT_ON_AFTER_REMOVE])) {
            // uh-oh
            $item = $this->getById($itemId);
            $eventData = $this->getCommonEventData() + array(
                'args' => $item,
                'item' => $item,
                'feature' => $item,
                'method' => 'remove',
                'originData' => $item,
            );
        } else {
            $eventData = null;
        }
        if (isset($this->events[ self::EVENT_ON_BEFORE_REMOVE ])) {
            $this->eventProcessor->runExpression($this->events[self::EVENT_ON_BEFORE_REMOVE], $eventData);
            $doRemove = $this->eventProcessor->allowRemove;
        } else {
            $doRemove = true;
        }
        if ($doRemove) {
            $result = !!$this->connection->delete($this->tableName, $this->idToIdentifier($itemId));
        } else {
            $result = null;
        }
        if (isset($this->events[self::EVENT_ON_AFTER_REMOVE])) {
            $this->eventProcessor->runExpression($this->events[self::EVENT_ON_AFTER_REMOVE], $eventData);
        }
        return $result;
    }

    /**
     * Get platform name
     *
     * @return string
     */
    public function getPlatformName()
    {
        return $this->getConnection()->getDatabasePlatform()->getName();
    }

    /** @noinspection PhpUnused */
    /**
     * Set permanent SQL filter used by $this->search()
     * https://trac.wheregroup.com/cp/issues/3733
     *
     * @see $this->search()
     * @param string $sqlFilter
     * NOTE: magic setter invocation; expected config value comes with key 'filter'
     */
    protected function setFilter($sqlFilter)
    {
        if ($sqlFilter) {
            // unquote quoted parameter references
            // we use parameter binding
            $filtered = preg_replace('#([\\\'"])(:[\w\d_]+)(\\1)#', '\\2', $sqlFilter);
            if ($filtered !== $sqlFilter) {
                @trigger_error("DEPRECATED: DO NOT quote parameter references in sql filter configuration", E_USER_DEPRECATED);
            }
            $sqlFilter = $filtered;
        }
        $this->sqlFilter = $sqlFilter;
    }
}
