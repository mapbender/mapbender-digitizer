<?php


namespace Mapbender\DataSourceBundle\Component;

/**
 * Trivial database expression. Not to be quoted when inserted into
 * queries.
 */
class Expression
{
    /** @var string */
    protected $text;

    /**
     * @param string $text
     */
    public function __construct($text)
    {
        $this->text = $text;
    }

    /**
     * @return string
     */
    public function getText()
    {
        return $this->text;
    }
}
