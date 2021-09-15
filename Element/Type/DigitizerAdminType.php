<?php

namespace Mapbender\DigitizerBundle\Element\Type;

use Mapbender\ManagerBundle\Form\Type\YAMLConfigurationType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

/**
 *
 */
class DigitizerAdminType extends AbstractType
{

    public function configureOptions(OptionsResolver $resolver)
    {
        $resolver->setDefaults(array(
            'application' => null
        ));
    }

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder->add('target', 'Mapbender\\CoreBundle\\Element\Type\\TargetElementType',
            array(
                'element_class' => 'Mapbender\\CoreBundle\\Element\\Map',
                'application'   => $options['application'],
                'property_path' => '[target]',
                'required'      => false))
           ->add('useAllScheme', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
               'required' => false,
               'label' => 'mb.digitizer.useAllScheme',
           ))
            ->add('displayOnInactive', 'Symfony\Component\Form\Extension\Core\Type\CheckboxType', array(
                'required' => false,
                'label' => 'mb.digitizer.displayOnInactive',
            ))
            ->add('schemes', 'Mapbender\ManagerBundle\Form\Type\YAMLConfigurationType' , array(
                'required' => false,
                'attr' => array(
                    'class' => 'code-yaml',
                ),
            ))
            ->add('dataManager', 'Mapbender\\CoreBundle\\Element\Type\\TargetElementType',
                array(
                    'element_class' => 'Mapbender\\DataManagerBundle\\Element\\DataManagerElement',
                    'application'   => $options['application'],
                    'property_path' => '[dataManager]',
                    'required'      => false));


    }
}
