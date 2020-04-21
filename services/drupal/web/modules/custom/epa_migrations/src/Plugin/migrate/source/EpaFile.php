<?php

namespace Drupal\epa_migrations\Plugin\migrate\source;

use Drupal\file\Plugin\migrate\source\d7\File;
use Drupal\migrate\Plugin\migrate\source\SqlBase;

/**
 * EPA Drupal 7 file source from database. Limit to files that are used.
 *
 * @MigrateSource(
 *   id = "epa_d7_file"
 * )
 */
class EpaFile extends File {

  /**
   * {@inheritDoc}
   */
  public function query() {
    // Get the parent query.
    $query = parent::query();

    $query->condition('f.type', 'video', '!=');

    $query->innerJoin('file_usage', 'fu', 'f.fid = fu.fid');
    $query->distinct();

    return $query;
  }

  /**
   * {@inheritdoc}
   */
  protected function initializeIterator() {
    // Customize the publicPath mapping since we're using production. Removed
    // the `$this->getVariable()` calls since the D7 variables table doesn't
    // include these variables. See `parent::initializeIterator()`.
    $this->publicPath = 'sites/production/files';
    $this->privatePath = NULL;
    $this->temporaryPath = '/tmp';

    // Call our grandparent's initailzeIterator(). Calling our parent's iterator
    // would overwrite the changes made above.
    return SqlBase::initializeIterator();
  }

}
