<?php

namespace Mapbender\DataManagerBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;

/**
 * Class DataManagerAdminType
 *
 * @package Mapbender\DataStoreBundle\Element\Type
 * @author  Andriy Oblivantsev <eslider@gmail.com>
 */
class DataManagerAdminType extends AbstractType
{

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add('schemes', 'Mapbender\ManagerBundle\Form\Type\YAMLConfigurationType', array(
                'required' => false,
                'attr' => array(
                    'class' => 'code-yaml',
                ),
                'label_attr' => array(
                    'class' => 'block',
                ),
            ))
        ;
    }
}
