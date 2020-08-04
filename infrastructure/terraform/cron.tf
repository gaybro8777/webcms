data "aws_iam_policy_document" "events_assume_role_policy" {
  version = "2012-10-17"

  statement {
    sid     = ""
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events" {
  name        = "${local.role-prefix}CronRole"
  description = "IAM role for the CloudWatch cron schedule"

  assume_role_policy = data.aws_iam_policy_document.events_assume_role_policy.json

  tags = local.common-tags
}

resource "aws_iam_role_policy_attachment" "drush_policy" {
  count = length(aws_ecs_task_definition.drush_task)

  role       = aws_iam_role.events.name
  policy_arn = aws_iam_policy.drush_policy[count.index].arn
}

resource "aws_cloudwatch_event_rule" "cron" {
  name        = "${local.role-prefix}CronSchedule"
  description = "Invokes Drush cron"

  # Run cron every 5 minutes
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "cron" {
  count = length(aws_ecs_task_definition.drush_task)

  target_id = "WebCMS${local.env-title}CronTask"
  arn       = aws_ecs_cluster.cluster.arn
  rule      = aws_cloudwatch_event_rule.cron.name
  role_arn  = aws_iam_role.events.arn

  ecs_target {
    launch_type         = "EC2"
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.drush_task[count.index].arn

    network_configuration {
      subnets         = aws_subnet.private.*.id
      security_groups = local.drupal-security-groups
    }
  }

  input = jsonencode({
    containerOverrides = [
      {
        name = "drush"
        command = [
          "/var/www/html/vendor/bin/drush",
          "--uri", "https://${var.site-hostname}",
          "cron"
        ]
      }
    ]
  })
}
