<?php
namespace Mapbender\DigitizerBundle\Component;

use Eslider\Driver\SqliteExtended;
use Mapbender\SearchBundle\Entity\Style;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Class DigizerStyleManager
 *
 * @package Mapbender\DigitizerBundle\Component
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class DigitizerStyleManager
{
    /** @var  SqliteExtended */
    public $db;

    /** @var ContainerInterface */
    protected $container;

    /** @var  int|string User ID */
    protected $userId;

    /** @var string Table name */
    protected $tableName = "digitizer-styles";

    /**
     * DigizerStyleManager constructor.
     *
     * @param ContainerInterface|null $container
     */
    public function __construct(ContainerInterface $container = null)
    {
        $this->container = $container;
        $kernel          = $this->container->get('kernel');
        $this->path      = $kernel->getRootDir() . "/config/" . $this->tableName . ".sqlite";
        $this->setUserId($container->get("security.context")->getUser()->getId());
        $this->createDB();
    }

    /**
     */
    public function createDB()
    {
        $this->db = $db = new SqliteExtended($this->path, $this->tableName);
        if (!$db->hasTable($this->tableName)) {
            $this->createStyleTable();
        }
    }

    /**
     * @return ContainerInterface
     */
    public function getContainer()
    {
        return $this->container;
    }

    /**
     * @param int $userId
     * @return $this
     */
    public function setUserId($userId)
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * Save style
     *
     * @param $style
     * @return Style
     */
    public function save(Style $style)
    {
        $db        = $this->db;
        $styleData = $style->toArray();
        $this->removePreviousStyles($style);
        $style->setId($db->insert($this->tableName, $styleData));
        $db->fetchColumn("VACUUM");

        return $style;
    }

    /**
     * @internal param $data
     * @internal param $db
     */
    private function createStyleTable()
    {
        $db         = $this->db;
        $style      = new Style();
        $fieldNames = array_keys($style->toArray());

        $db->createTable($this->tableName);
        foreach ($fieldNames as $fieldName) {
            if ($fieldName == "id") {
                continue;
            }
            $db->addColumn($this->tableName, $fieldName);
        }
    }

    /**
     * Get schema styles
     *
     * @param $schema
     * @return array()
     */
    public function getSchemaStyles($schema)
    {
        $db     = $this->db;
        $styles = array();
        $sql    = "SELECT * FROM " . $db->quote($this->tableName)
            . " WHERE " . $db->quote("userId") . "=" . SqliteExtended::escapeValue($this->userId);

        if (isset($schema["group"]) && $schema["group"] != "all") {
            $sql .= " AND " . $db->quote("schemaName")
                . " LIKE " . SqliteExtended::escapeValue($schema['featureTypeName']);
        }

        foreach ($db->queryAndFetch($sql) as $styleData) {
            $style                       = new Style($styleData);
            $styles[ $style->featureId ] = $styleData;
        }
        return $styles;
    }

    /**
     * @param Style $style
     * @internal param $db
     */
    private function removePreviousStyles(Style $style)
    {
        $db = $this->db;
        $db->fetchColumn("DELETE FROM " . $db->quote($this->tableName)
            . " WHERE " . $db->quote("userId") . "=" . SqliteExtended::escapeValue($this->userId)
            . " AND " . $db->quote("schemaName") . " LIKE " . SqliteExtended::escapeValue($style->schemaName)
            . " AND " . $db->quote("featureId") . "=" . SqliteExtended::escapeValue($style->featureId)
        );
    }
}