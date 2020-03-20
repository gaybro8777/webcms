# Shared variables here. We use separate definitions for the web-facing Drupal tasks
# and scheduled Drush cron scripts for a few reasons (such as avoiding spawning nginx),
# so we share the values here.

data "aws_caller_identity" "current" {}

locals {
  # Plaintext environment variables for Drupal containers
  drupal-environment = [
    { name = "WEBCMS_S3_BUCKET", value = aws_s3_bucket.uploads.bucket },
    { name = "WEBCMS_S3_REGION", value = var.aws-region },
    { name = "WEBCMS_SITE_URL", value = var.site-hostname }
  ]

  # Parameter store bindings for Drupal containers
  drupal-secrets = [
    { name = "WEBCMS_DB_USER", valueFrom = aws_ssm_parameter.db_app_username.arn },
    { name = "WEBCMS_DB_PASS", valueFrom = aws_ssm_parameter.db_app_password.arn },
    { name = "WEBCMS_DB_NAME", valueFrom = aws_ssm_parameter.db_app_database.arn },
    { name = "WEBCMS_HASH_SALT", valueFrom = aws_ssm_parameter.hash_salt.arn },
  ]

  # Security groups used by Drupal containers
  drupal-security-groups = [
    aws_security_group.drupal_task.id,
    aws_security_group.database_access.id,
    aws_security_group.cache_access.id,
  ]

  # Database name for the WebCMS
  database-name = "webcms"

  # User for the WebCMS. This is *not* the master username that is specified
  # in Terraform! It's the app-level user that only needs permissions to modify
  # the WebCMS's database.
  database-user = "webcms"
}