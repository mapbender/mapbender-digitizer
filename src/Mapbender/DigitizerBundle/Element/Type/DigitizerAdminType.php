<?php

namespace Mapbender\DigitizerBundle\Element\Type;

use Doctrine\Persistence\ConnectionRegistry;
use Mapbender\DataManagerBundle\Element\Type\DataManagerAdminType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;

class DigitizerAdminType extends DataManagerAdminType
{
    private ConnectionRegistry $connectionRegistry;

    public function __construct(ConnectionRegistry $connectionRegistry)
    {
        $this->connectionRegistry = $connectionRegistry;
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $connectionChoices = $this->getConnectionChoices();

        $builder
            ->add('userStylesConnection', ChoiceType::class, [
                'label' => 'mb.digitizer.admin.userStylesConnection',
                'required' => false,
                'choices' => $connectionChoices,
                'placeholder' => '',
            ])
            ->add('userStylesTable', TextType::class, [
                'label' => 'mb.digitizer.admin.userStylesTable',
                'required' => false,
            ])
        ;
        parent::buildForm($builder, $options);
    }

    /**
     * Build choices from available Doctrine DBAL connections.
     *
     * @return array<string, string> label => value
     */
    private function getConnectionChoices(): array
    {
        $choices = [];
        foreach (array_keys($this->connectionRegistry->getConnectionNames()) as $name) {
            $choices[$name] = $name;
        }
        return $choices;
    }
}
