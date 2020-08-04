* Override `MigrateExecutable::processRow()`: start indicates beginning of processing per row
* Listen for `MigrateEvents::MAP_SAVE`: indicates processing is complete. Use status field as success/failure metric

* How to determine which migration is running? Is this a necessary metric?

* Are there other useful metrics?
