<?php
namespace Mapbender\DigitizerBundle\Utils;

/**
 * Class System
 *
 * @package Mapbender\DigitizerBundle\Utils
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class System
{

    /**
     * Generate password
     *
     * Modes:
     * - "PWD_CHARS_SMALL" Small chars only
     * - "PWD_CHARS_BIG"   Big chars only
     * - "PWD_CHARS_MIXED" Big and small chars
     * - "PWD_NUMBERS"     Numbers only (PINS)
     * - "PWD_MIXED_SMALL" Small chars and numbers.
     * - "PWD_MIXED_BIG"   Big chars and numbers.
     *  -"PWD_MIXED_MIXED" Number, small and big and chars.
     *
     * @param int    $len  Length.
     * @param string $mode Mode. Default: "PWD_MIXED_MIXED"
     * @return string
     */
    public static function generatePassword($len = 6, $mode = "PWD_MIXED_MIXED")
    {
        $sChars = range('a', 'z');
        $bChars = range('A', 'Z');
        $number = range('0', '9');
        $pwd    = "";
        $lib    = null;

        switch ($mode) {
            case "PWD_CHARS_SMALL":
                $lib = $sChars;
                break;
            case "PWD_CHARS_BIG":
                $lib = $bChars;
                break;
            case "PWD_CHARS_MIXED":
                $lib = array_merge($sChars, $bChars);
                break;
            case "PWD_NUMBERS":
                $lib = $number;
                break;

            case "PWD_MIXED_SMALL":
                $lib = array_merge($number, $sChars);
                break;
                break;
            case "PWD_MIXED_BIG":
                array_merge($number, $bChars);
                break;
            default:
                $lib = array_merge($number, $bChars, $sChars);
        }

        for ($i = 0, $c = count($lib); $i < $len; $i++) {
            srand((float)microtime(true) * 1000000);
            $pwd .= $lib[mt_rand(0, $c - 1)];
        }
        return $pwd;
    }
}