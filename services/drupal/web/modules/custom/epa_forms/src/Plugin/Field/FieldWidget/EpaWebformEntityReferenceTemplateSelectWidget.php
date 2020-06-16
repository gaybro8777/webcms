<?php
namespace Drupal\epa_forms\Plugin\Field\FieldWidget;

use Drupal\Core\Datetime\DrupalDateTime;
use Drupal\Core\Entity\FieldableEntityInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Form\FormStateInterface;
use Drupal\webform\Entity\Webform;
use Drupal\webform\WebformInterface;
use Drupal\Core\Field\Plugin\Field\FieldWidget\OptionsWidgetBase;

/**
 * Plugin implementation of the 'webform_entity_reference_select' widget.
 *
 * @FieldWidget(
 *   id = "epa_webform_entity_reference_template_select",
 *   label = @Translation("Select template"),
 *   description = @Translation("Select a template on which to base a new webform."),
 *   field_types = {
 *     "webform"
 *   }
 * )
 *
 * @see \Drupal\Core\Field\Plugin\Field\FieldWidget\OptionsWidgetBase
 */
class EpaWebformEntityReferenceTemplateSelectWidget extends OptionsWidgetBase {

  /**
   * {@inheritdoc}
   */
  public function getTargetIdElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state) {
    // Get default value (webform ID).
    $referenced_entities = $items->referencedEntities();
    $default_value = isset($referenced_entities[$delta]) ? $referenced_entities[$delta] : NULL;
    // Convert default_value's Webform to a simple entity_id.
    if ($default_value instanceof WebformInterface) {
      $default_value = $default_value->id();
      $target_element = [
        '#type' => 'hidden',
        '#value' => $default_value,
      ];
    }
    else {
      // Get options grouped by category.
      $options = $this->getOptions($items->getEntity());

      $target_element = [
        '#type' => 'webform_entity_select',
        '#options' => $options,
        '#default_value' => $default_value,
      ];

      // Set empty option.
      if (empty($element['#required'])) {
        $target_element['#empty_option'] = $this->t('- Select -');
        $target_element['#empty_value'] = '';
      }

      // Set validation callback.
      $target_element['#element_validate'] = [[get_class($this), 'validateWebformEntityReferenceSelectWidget']];
    }
    return $target_element;
  }

  public function formElement(FieldItemListInterface $items, $delta, array $element, array &$form, FormStateInterface $form_state) {
    // Set item default status to open.
    if (!isset($items[$delta]->status)) {
      $items[$delta]->status = WebformInterface::STATUS_OPEN;
    }

    // Get target ID element.
    $target_id_element = $this->getTargetIdElement($items, $delta, $element, $form, $form_state);


    // Merge target ID and default element and set default #weight.
    // @see \Drupal\Core\Field\Plugin\Field\FieldWidget\EntityReferenceAutocompleteWidget::formElement
    $element = [
      'target_id' => $target_id_element + $element + ['#weight' => 0],
    ];

    // Get field name.
    $field_name = $items->getName();

    // Get webform.
    $target_id = NULL;
    if ($form_state->isRebuilding()) {
      $target_id = $form_state->getValue(array_merge($element['target_id']['#field_parents'], [$field_name, $delta, 'target_id']));
    }
    else {
      $target_id = $items[$delta]->target_id;
    }

    /** @var \Drupal\webform\WebformInterface $webform */
    $webform = ($target_id) ? Webform::load($target_id) : NULL;

    if ($webform) {
      $url = $webform->toUrl('edit-form');
      $markup = t('<a href=":url" target="_blank">@title</a>',
        [
          '@title' => $webform->label(),
          ':url' => $url->toString(),
        ]
      );
      $element['webform_link'] = [
          '#type' => 'item',
          '#markup' => $markup,
        ];
    }
    return $element;
  }

  /**
   * Webform element validation handler for entity_select elements.
   */
  public static function validateWebformEntityReferenceSelectWidget(&$element, FormStateInterface $form_state, &$complete_form) {
    // Below prevents the below error.
    // Fatal error: Call to a member function uuid() on a non-object in
    // core/lib/Drupal/Core/Field/EntityReferenceFieldItemList.php.
//    $id = 'template_epa_contact_us';
//    $webform = Webform::load($id)->createDuplicate();
//    $webform->set('title', $entity->label());
//    $webform->set('id', 'contact_us_'. $entity->id() .'_'. rand(1000000,9999999)); // Adds a random number to try to avoid machine name collisions.
//    $webform->set('third_party_settings', $third_party_settings);
    $value = (!empty($element['#value'])) ? $element['#value'] : NULL;

    if ($value) {
      $selected_webform = Webform::load($value);
      if ($selected_webform->isTemplate()) {
        $webform = $selected_webform->createDuplicate();
        $webform->set('id', $value . '_' . rand(1000000, 9999999)); // Adds a random number to try to avoid machine name collisions.
        $webform->save();
        $value = $webform->id();
      }
    }

    $form_state->setValueForElement($element, $value);
  }

  /**
   * Returns the array of options for the widget.
   *
   * @param \Drupal\Core\Entity\FieldableEntityInterface $entity
   *   The entity for which to return options.
   *
   * @return array
   *   The array of options for the widget.
   */
  protected function getOptions(FieldableEntityInterface $entity) {
    if (!isset($this->options)) {
      $options = [];
      // If we have templates available, limit to only those.
      if (\Drupal::moduleHandler()->moduleExists('webform_templates')) {
        /** @var \Drupal\webform\WebformEntityStorageInterface $webform_storage */
        $webform_storage = \Drupal::service('entity_type.manager')->getStorage('webform');
        $webform_templates = $webform_storage->loadByProperties(['template' => TRUE]);
        foreach ($webform_templates as $key => $template) {
          $options[$key] = $template->label();
        }
      }

      $module_handler = \Drupal::moduleHandler();
      $context = [
        'fieldDefinition' => $this->fieldDefinition,
        'entity' => $entity,
      ];
      $module_handler->alter('options_list', $options, $context);

      array_walk_recursive($options, [$this, 'sanitizeLabel']);
      $this->options = $options;
    }
    return $this->options;
  }
}
