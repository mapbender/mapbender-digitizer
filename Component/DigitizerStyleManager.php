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
    protected $tableName;

    /**
     * DigizerStyleManager constructor.
     *
     * @param ContainerInterface|null $container
     * @param $tableName
     */
    public function __construct($tableName,ContainerInterface $container = null)
    {
        try {
            $root = $container->getParameter('mapbender.digitizer.sqlite.storage_root');
        } catch(\InvalidArgumentException $e) {
            $root = $container->getParameter('kernel.root_dir')."/db";
        }
        $this->tableName = $tableName;
        $sqlitePath =  $root. "/{$this->tableName}.sqlite";
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
     * @param bool $public
     * @return Style
     */
    public function save(Style $style, $userId, $public = false)
    {
        $styleData = $style->toArray();
        $this->removePreviousStyles($style, $userId,$public);
        $id = $this->db->insert($this->tableName, $styleData);
        $style->setId($id);

        return $style;
    }


    public function getStyles($userId = null,$public = false)
    {
        $styles = array();
        $userSpecificSql = $public ? "true" : $this->db->quote("userId") . "=" . SqliteExtended::escapeValue($userId);
        $sql = "SELECT * FROM {$this->db->quote($this->tableName)} WHERE $userSpecificSql";

        foreach ($this->db->queryAndFetch($sql) as $styleData) {
            $style  = new Style($styleData);
            $styles[ $style->featureId ] = $styleData;
        }

        return $styles;
    }

    /**
     * @param Style $style
     * @param mixed $userId
     * @param bool $public
     * @internal param $db
     */
    private function removePreviousStyles(Style $style, $userId, $public = false)
    {
        $db = $this->db;
        $userSpecificSql = $public ? "true" : $db->quote("userId") . "=" . SqliteExtended::escapeValue($userId);
        $db->fetchColumn("DELETE FROM " . $db->quote($this->tableName)
            . " WHERE " . $userSpecificSql
            . " AND " . $db->quote("featureId") . "=" . SqliteExtended::escapeValue($style->featureId)
        );
    }
}


