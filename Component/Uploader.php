<?php
/**
 *
 * @author Andriy Oblivantsev <eslider@gmail.com>
 */

namespace Mapbender\DigitizerBundle\Component;

if (!class_exists('UploadHandler')) {
    include_once('../vendor/blueimp/jquery-file-upload/server/php/UploadHandler.php');
}

/**
 * Class Uploader
 *
 * @package Mapbender\DigitizerBundle\Component
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class Uploader extends \UploadHandler
{
    /**
     * Overwrites name upcount
     *
     * @param $matches
     * @return string
     */
    protected function upcount_name_callback($matches)
    {
        $index = isset($matches[1]) ? ((int)$matches[1]) + 1 : 1;
        $ext   = isset($matches[2]) ? $matches[2] : '';
        return '.' . $index  . $ext;
    }

    /**
     * @param $name
     * @return mixed
     */
    protected function upcount_name($name) {
        return preg_replace_callback(
            '/(?:(?:\.([\d]+))?(\.[^.]+))?$/',
            array($this, 'upcount_name_callback'),
            $name,
            1
        );
    }
}