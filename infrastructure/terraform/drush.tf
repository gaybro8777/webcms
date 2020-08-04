# This task definition depends on a built and published Drush image, so we have to
# conditionally create it the same way we did for drupal_task.
resource "aws_ecs_task_definition" "drush_task" {
  count = var.image-tag-drush != null ? 1 : 0

  family             = "webcms-drush-${local.env-suffix}"
  network_mode       = "awsvpc"
  task_role_arn      = aws_iam_role.drupal_container_role.arn
  execution_role_arn = aws_iam_role.drupal_execution_role.arn

  # See cluster.tf for more information on these parameters
  container_definitions = jsonencode([
    {
      name  = "drush"
      image = "${aws_ecr_repository.drush.repository_url}:${var.image-tag-drush}"

      cpu    = 1024
      memory = 1024

      # By explicitly emptying these values, we allow task overrides to effectively
      # take precedence over what is specified in the container. This enables us
      # to specify "drush cron" in the CloudWatch event schedule, and run a shell
      # script that runs "drush updb".
      entryPoint = []
      command    = []

      workingDirectory = "/var/www/html"

      # Use shared bindings so that Drush tasks can connect the same way Drupal does
      environment = local.drupal-environment
      secrets     = local.drupal-secrets

      # Unlike the Drupal container, this uses the drush log group in order to make the
      # logs for scheduled tasks easier to separate from the main Drupal PHP-FPM logs.
      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group  = aws_cloudwatch_log_group.drush.name
          awslogs-region = var.aws-region
        }
      }
    }
  ])

  tags = merge(local.common-tags, {
    Name = "${local.name-prefix} Task - Drush"
  })

  # Like the Drupal task, we ensure that ECS will be able to launch this task when it
  # assumes the execution role.
  depends_on = [
    aws_iam_role_policy_attachment.drupal_execution_tasks,
    aws_iam_role_policy_attachment.drupal_execution_parameters
  ]
}

# This is a migration-specific task. It uses a much more generous memory reservation for
# Drush than normal tasks, as the migrate module is much more memory-intensive.
#
# The task name is webcms-migrate-<env> rather than webcms-drush-<env>.
resource "aws_ecs_task_definition" "migrate_task" {
  # We rely on both the monitor and Drush images being available, hence the length() call
  # here.
  count = var.image-tag-monitor != null ? length(aws_ecs_task_definition.drush) : 0

  family             = "webcms-migrate-${local.env-suffix}"
  network_mode       = "awsvpc"
  task_role_arn      = aws_iam_role.drupal_container_role.arn
  execution_role_arn = aws_iam_role.drupal_execution_role.arn

  # See cluster.tf for more information on these parameters
  container_definitions = jsonencode([
    {
      name  = "drush"
      image = "${aws_ecr_repository.drush.repository_url}:${var.image-tag-drush}"

      cpu    = 1024
      memory = 3584 # =3.5 GB of memory

      # By explicitly emptying these values, we allow task overrides to effectively
      # take precedence over what is specified in the container. This enables us
      # to specify "drush cron" in the CloudWatch event schedule, and run a shell
      # script that runs "drush updb".
      entryPoint = []
      command    = []

      workingDirectory = "/var/www/html"

      # Use shared bindings so that Drush tasks can connect the same way Drupal does
      environment = local.drupal-environment
      secrets     = local.drupal-secrets

      # Unlike the Drupal container, this uses the drush log group in order to make the
      # logs for scheduled tasks easier to separate from the main Drupal PHP-FPM logs.
      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group  = aws_cloudwatch_log_group.drush.name
          awslogs-region = var.aws-region
        }
      }
    },

    # Migrate monitor container. This definition relies on the code itself, since the
    # monitor doesn't have any configurable entry points or scripts.
    {
      name = "monitor"
      image = "${aws_ecr_repository.monitor.repository_url}:${var.image-tag-monitor}"

      cpu = 256
      memory = 256

      logConfiguration = {
        logDriver = "awslogs"

        options = {
          awslogs-group = aws_cloudwatch_log_group.monitor.name
          awslogs-region = var.aws-region
        }
      }
    }
  ])

  tags = merge(local.common-tags, {
    Name = "${local.name-prefix} Task - Drush"
  })

  # Like the Drupal task, we ensure that ECS will be able to launch this task when it
  # assumes the execution role.
  depends_on = [
    aws_iam_role_policy_attachment.drupal_execution_tasks,
    aws_iam_role_policy_attachment.drupal_execution_parameters
  ]
}

data "aws_iam_policy_document" "drush_policy" {
  count = length(aws_ecs_task_definition.drush_task)

  version = "2012-10-17"

  # Per the docs, iam:PassRole is the permission we need to invoke our ECS task from
  # CloudWatch's events schedule. This is necessary due to our usage of the referenced
  # roles
  # cf. https://docs.aws.amazon.com/AmazonECS/latest/developerguide/scheduled_tasks.html
  statement {
    sid     = "passTaskRoles"
    actions = ["iam:PassRole"]

    resources = [
      aws_iam_role.drupal_execution_role.arn,
      aws_iam_role.drupal_container_role.arn
    ]
  }

  statement {
    sid       = "invokeDrushTask"
    actions   = ["ecs:RunTask"]
    resources = [replace(aws_ecs_task_definition.drush_task[count.index].arn, "/:\\d+$/", ":*")]

    # Only allow spawning Drush tasks on the WebCMS' cluster
    condition {
      test     = "StringEquals"
      variable = "ecs:Cluster"
      values   = [aws_ecs_cluster.cluster.arn]
    }
  }
}

resource "aws_iam_policy" "drush_policy" {
  count = length(aws_ecs_task_definition.drush_task)

  name        = "${local.role-prefix}RunDrushPolicy"
  description = "Policy to allow running Drush tasks in the WebCMS cluster"

  policy = data.aws_iam_policy_document.drush_policy[count.index].json
}
