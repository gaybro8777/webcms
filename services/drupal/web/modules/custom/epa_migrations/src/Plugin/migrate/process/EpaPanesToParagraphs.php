<?php

namespace Drupal\epa_migrations\Plugin\migrate\process;

use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * Given a set of panes, returns paragraph entity references.
 *
 * @MigrateProcessPlugin(
 *   id = "epa_panes_to_paragraphs"
 * )
 *
 * To convert a an array of panes to paragraph entity ids for a field, do the
 * following:
 *
 * @code
 * field_paragraphs:
 *   plugin: epa_panes_to_paragraphs
 *   source: main_col_panes
 * @endcode
 */
class EpaPanesToParagraphs extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property) {
    $paragraph_ids = [];

    // The value passed into this process is an array of database rows, selected
    // in the epa_node source plugin.
    foreach ($value as $pane) {
      $shown = $pane['shown'];

      if ($shown) {
        $type = $pane['type'];
        $configuration = unserialize($pane['configuration']);

        $pane_classes = [
          'node_content' => '\\Drupal\epa_migrations\EpaNodeContentPaneToParagraph',
          'epa_core_html_pane' => '\\Drupal\epa_migrations\EpaCoreHtmlPaneToParagraph',
          'epa_core_node_list_pane' => '\\Drupal\epa_migrations\EpaCoreListPaneToParagraph',
          'epa_core_link_list_pane' => '\\Drupal\epa_migrations\EpaCoreListPaneToParagraph',
        ];

        $pane_class = $pane_classes[$type] ?? NULL;

        if ($pane_class) {
          $pane_transformer = new $pane_class();
          $transformed_paragraph_ids = $pane_transformer->createParagraph($row, $pane, $configuration);

          if ($transformed_paragraph_ids) {
            $paragraph_ids[] = $transformed_paragraph_ids;
          }
        }
        else {
          $migrate_executable->saveMessage("WARNING: No pane transformer was found for pane type '{$type}' with pid {$pane['pid']}. This pane is used in the '{$pane['panel']}' panel. This pane was not migrated.", 3);
        }

      }

    }
    return $paragraph_ids;

  }

}
