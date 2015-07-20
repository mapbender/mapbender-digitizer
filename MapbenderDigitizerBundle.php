<?php
namespace Mapbender\DigitizerBundle;

use Mapbender\CoreBundle\Component\MapbenderBundle;

/**
 * Digitizer Bundle.
 *
 * @author Andriy Oblivantsev
 * @author Stefan Winkelmann
 */
class MapbenderDigitizerBundle extends MapbenderBundle
{
    /**
     * @inheritdoc
     */
    public function getElements()
    {
        return array(
            'Mapbender\DigitizerBundle\Element\Digitizer'
        );
    }

}

