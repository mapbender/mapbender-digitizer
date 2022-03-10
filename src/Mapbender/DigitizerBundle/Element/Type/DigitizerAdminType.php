<?php

namespace Mapbender\DigitizerBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

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
        $builder->add('target', 'Mapbender\CoreBundle\Element\Type\TargetElementType', array(
                'element_class' => 'Mapbender\CoreBundle\Element\Map',
                'application'   => $options['application'],
                'required'      => false,
                // dummy property path required for compatibility for TargetElementType
                // on Mapbender <=3.0.8.4 (no longer required on 3.0.8.5 RC and higher)
                'property_path' => '[target]',
            ))
            ->add('schemes', 'Mapbender\ManagerBundle\Form\Type\YAMLConfigurationType', array(
                'required' => false,
                'attr' => array(
                    'class' => 'code-yaml',
                ),
            ))
        ;
    }
}
