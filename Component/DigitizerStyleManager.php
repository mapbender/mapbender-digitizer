<?php
namespace Mapbender\DigitizerBundle\Component;

use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Class DigizerStyleManager
 *
 */
class DigitizerStyleManager
{
    /** @var  SqliteExtended */
    public $db;
    /** @var string Table name */
    protected $tableName = "digitizer-styles";

    /**
     * DigizerStyleManager constructor.
     *
     * @param ContainerInterface|null $container
     */
    public function __construct(ContainerInterface $container = null)
    {
        $sqlitePath = $container->getParameter('mapbender.digitizer.sqlite.storage_root') . "/{$this->tableName}.sqlite";
        $this->db = $this->createDB($sqlitePath, $this->tableName);
    }

    /**
     * @param string $path
     * @param string $tableName
     * @return SqliteExtended
     */
    public function createDB($path, $tableName)
    {
        $db = new SqliteExtended($path, $tableName);
        if (!$db->hasTable($tableName)) {
            $this->createStyleTable($db, $tableName);
        }
        return $db;
    }

    /**
     * @param SqliteExtended $db
     * @param string $tableName
     */
    private function createStyleTable($db, $tableName)
    {
        $style      = new Style(array());
        $fieldNames = array_keys($style->toArray());

        $db->createTable($tableName);
        foreach ($fieldNames as $fieldName) {
            if ($fieldName == "id") {
                continue;
            }
            $db->addColumn($tableName, $fieldName);
        }
    }

    /**
     * Save style
     *
     * @param Style $style
     * @param mixed $userId
     * @return Style
     */
    public function save(Style $style, $userId)
    {
        $styleData = $style->toArray();
        $this->removePreviousStyles($style, $userId);
        $id = $this->db->insert($this->tableName, $styleData);
        $style->setId($id);

        return $style;
    }


    public function getSchemaStyles($schema, $userId)
    {
        $styles = array();
        $userId = SqliteExtended::escapeValue($userId);

        $sql = "SELECT * FROM {$this->db->quote($this->tableName)} WHERE {$this->db->quote("userId")} = {$userId}";

        if (null !== $schema) {
            $featureTypeName = SqliteExtended::escapeValue($schema['featureType']['geomType']);
            $sql .= " AND {$this->db->quote("schemaName")} LIKE {$featureTypeName}";
        }

        foreach ($this->db->queryAndFetch($sql) as $styleData) {
            $style  = new Style($styleData);
            $styles[ $style->featureId ] = $styleData;
        }

        return $styles;
    }

    /**
     * @param Style $style
     * @param mixed $userId
     * @internal param $db
     */
    private function removePreviousStyles(Style $style, $userId)
    {
        $db = $this->db;
        $db->fetchColumn("DELETE FROM " . $db->quote($this->tableName)
            . " WHERE " . $db->quote("userId") . "=" . SqliteExtended::escapeValue($userId)
            . " AND " . $db->quote("schemaName") . " LIKE " . SqliteExtended::escapeValue($style->schemaName)
            . " AND " . $db->quote("featureId") . "=" . SqliteExtended::escapeValue($style->featureId)
        );
    }
}


