# Generate a random ID for the ECS capacity provider to work around limitations in the AWS
# API. At the time of writing, capacity providers can't be deleted. By using a randomly-generated
# ID, we force Terraform to create new capacity providers whenever a destroy-and-replace
# operation would be needed.
#
# Terraform's random provider is somewhat strange if you're not used to it: it stores
# the randomly-generated value in its state in order to ensure that the value is consistent
# between plan/apply runs (that is, it's only ever generated once). It's possible to force
# Terraform to generate a new random ID by using the taint command:
#
# $ terraform taint random_pet.capacity_provider
#
# This causes Terraform to mark the value as needing regeneration on its next run.
#
# Further reading:
# * https://www.terraform.io/docs/providers/aws/r/ecs_capacity_provider.html
# * https://www.terraform.io/docs/providers/random/index.html

resource "random_pet" "capacity_provider" {
  # A length of 2 gives us a pet name plus an adjective, which can hopefully give a
  # useful mnemonic when looking at the capacity provider list.
  length = 2
}

# Create the cluster's capacity provider first
resource "aws_ecs_capacity_provider" "cluster_capacity" {
  name = "webcms-capacity-${random_pet.capacity_provider.id}"

  # This capacity provider draws from our EC2 autoscaling group
  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.servers.arn

    managed_scaling {
      status          = "ENABLED"
      target_capacity = 100
    }

    # managed_termination_protection = "ENABLED"
  }

  tags = merge(local.common-tags, {
    # Give this capacity provider a name that matches the random_pet to aid debugging/triage
    Name = "${local.name-prefix} ${random_pet.capacity_provider.id}"
  })
}

# ECS cluster
resource "aws_ecs_cluster" "cluster" {
  name = local.cluster-name

  # FARGATE adds the ability to launch tasks in Fargate; we primarily use this for Drush
  # in order to protect it from the vagaries of autoscaling group resizes prematurely
  # terminating it.
  capacity_providers = [aws_ecs_capacity_provider.cluster_capacity.name, "FARGATE"]

  # We assume that all services will use our autoscaling group as its capacity provider
  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.cluster_capacity.name
    weight            = 100
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(local.common-tags, {
    Name = "WebCMS ${local.env-title}"
  })
}

# Resources below this line are conditionally created if the image-tag-nginx and image-tag-drupal
# variables are not null.
#
# The intention is to allow a bootstrapping phase where all of the deployment-related
# resources (most importantly, the ECR repositories) are created before attempting a task
# deployment, but it does mean that it's possible to accidentally deregister the service
# if the variables aren't created. Be sure not to do this.

# First, define the Drupal ECS task. An ECS task is the lower-level definition of what
# containers to run and their configuration (permissions, volumes, etc.).
# Creating a task definition does not, by itself, define the actual web-facing application.
resource "aws_ecs_task_definition" "drupal_task" {
  # The 1-or-0 count here is a Terraform idiom for conditionally creating a resource
  count = var.image-tag-nginx != null && var.image-tag-drupal != null ? 1 : 0

  family             = "webcms-drupal-${local.env-suffix}"
  network_mode       = "awsvpc"
  task_role_arn      = aws_iam_role.drupal_container_role.arn
  execution_role_arn = aws_iam_role.drupal_execution_role.arn

  # Setting reservations at the task level lets Docker be more flexible in how the
  # resources are used (mainly, it allows Drupal to soak up as much CPU capacity as it
  # needs)
  cpu    = 1024
  memory = 2048

  container_definitions = jsonencode([
    # Drupal container. The WebCMS' Drupal container is based on an FPM-powered PHP
    # container, which means that by itself it cannot receive HTTP requests. Instead, the
    # task also includes an nginx container (see below) that "adapts" requests from HTTP
    # to FastCGI, the protocol that FPM uses.
    {
      # Do not change the name of this container freely: ECS uses this as a hostname when
      # the task is launched, and it is the primary way in which two containers will be
      # able to communicate (since the IP address will vary).
      name = "drupal"

      # Service updates are triggered when either of these two references changes.
      image = "${aws_ecr_repository.drupal.repository_url}:${var.image-tag-drupal}",

      # If this container exits for any reason, mark the task as unhealthy and force a restart
      essential = true,

      # Inject the S3 information needed to connect for s3fs (cf. shared.tf)
      environment = local.drupal-environment,

      # Inject the DB credentials needed (cf. shared.tf)
      secrets = local.drupal-secrets,

      # Expose port 9000 inside the task. This is a FastCGI port, not an HTTP one, so it
      # won't be of use to anyone save for nginx. Most importantly, this means that this
      # port should NOT be exposed to a load balancer.
      portMappings = [{ containerPort = 9000 }],

      # Shunt logs to the Drupal CloudWatch log group
      logConfiguration = {
        logDriver = "awslogs",

        options = {
          awslogs-group  = aws_cloudwatch_log_group.drupal.name,
          awslogs-region = var.aws-region
        }
      }
    },
    # nginx container. As mentioned above, this container exists primarily to route
    # requests. We use nginx separately instead of, for example, Apache and mod_php
    # because nginx is specialized for HTTP server tasks, and any task we can perform in
    # nginx removes some of the PHP overhead.
    {
      name = "nginx",

      # As with the Drupal definition, service updates are triggered when these change.
      image = "${aws_ecr_repository.nginx.repository_url}:${var.image-tag-nginx}",

      environment = [
        # See nginx.conf in services/drupal for why this is needed.
        { name = "WEBCMS_DOMAIN", value = var.site-hostname },

        # Inject the S3 domain name so that nginx can proxy to it - we do this instead of
        # the region and bucket name because in us-east-1, the domain isn't easy to
        # construct via "$bucket.s3-$region.amazonaws.com".
        { name = "WEBCMS_S3_DOMAIN", value = aws_s3_bucket.uploads.bucket_regional_domain_name }
      ]

      # As with the Drupal container, we ask ECS to restart this task if nginx fails
      essential = true,

      # Expose port 80 from the task. This is an HTTP port and is thus suitable for granting
      # access to a load balancer.
      portMappings = [{ containerPort = 80 }],

      dependsOn = [
        { containerName = "drupal", condition = "START" }
      ],

      # Shunt logs to the nginx CloudWatch log group
      logConfiguration = {
        logDriver = "awslogs",

        options = {
          awslogs-group  = aws_cloudwatch_log_group.nginx.name,
          awslogs-region = var.aws-region,
        }
      }
    },
    # In ECS, Amazon's CloudWatch agent can be run to collect application metrics. See
    # the epa_metrics module for what we export to the agent.
    {
      name  = "cloudwatch",
      image = "amazon/cloudwatch-agent:latest",

      # The agent reads its JSON-formatted configuration from the environment in containers
      environment = [
        {
          name = "CW_CONFIG_CONTENT",
          # cf. https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Agent-Configuration-File-Details.html
          value = jsonencode({
            metrics = {
              namespace = "WebCMS",
              metrics_collected = {
                statsd = {
                  service_address = ":8125",
                },
              },
            },
          }),
        },
      ],

      logConfiguration = {
        logDriver = "awslogs",

        options = {
          awslogs-group  = aws_cloudwatch_log_group.agent.name,
          awslogs-region = var.aws-region,
        }
      }
    },

    # This is a small Alpine container used to report metrics from FPM to CloudWatch
    {
      name  = "metrics"
      image = "alpine:latest"

      environment = [
        {
          name  = "WEBCMS_ENV_NAME"
          value = var.site-env-name
        },

        # This is the map needed for mapping PHP-FPM metrics to CloudWatch. The keys are
        # the metric names output by PHP-FPM, and the values have two expected fields:
        # - name: the CloudWatch metric name (usually in PascalCase)
        # - unit: the CloudWatch unit (typically Count or Seconds)
        #
        # The keys of the FPM status JSON are listed here:
        # - "pool": the FPM pool name
        # - "process manager": the kind of FPM process manager (one of "static",
        #   "dynamic", or "ondemand")
        # - "start time": the UNIX timestamp when PHP-FPM started
        # - "start since": the number of seconds since the start time
        # - "accepted conn": number of requests accepted by the pool
        # - "listen queue": the size of PHP-FPM's socket backlog
        # - "max listen queue": the maximum number of requests in the pending queue seen
        #   since FPM started
        # - "listen queue len": the number of pending connections
        # - "idle processes": number of inactive PHP-FPM workers
        # - "active processes": number of active workers
        # - "total workers": number of workers, both idle and active
        # - "max active processes": highest number of active processes since PHP-FPM
        #   started
        # - "max children reached": the number of times PHP-FPM has reached the maximum
        #   worker size (only applicable for dynamic/ondemand process managers)
        #
        # We don't track every metric since some of them are redundant in the face of
        # CloudWatch metric math, but we report a significant subset. The metrics we track
        # are listed in the object below.
        {
          name = "WEBCMS_METRICS_MAP"
          value = jsonencode({
            # Track the age of the FPM process in order to allow us to convert counts to
            # counts per second
            "start since" = {
              name = "Age"
              unit = "Seconds"
            }
            "accepted conn" = {
              name = "RequestsAccepted"
              unit = "Count"
            }
            "listen queue" = {
              name = "RequestsPending"
              unit = "Count"
            }
            # By reporting the listen queue length, we can track the size of the listen
            # queue as a percentage (using RequestsPending/ListenQueueLength), which gives
            # us a good estimate of backlog pressure at the FPM socket level.
            "listen queue len" = {
              name = "ListenQueueLength"
              unit = "Count"
            }
            "idle processes" = {
              name = "ProcessesIdle"
              unit = "Count"
            }
            "active processes" = {
              name = "ProcessesActive"
              unit = "Count"
            }
            # We report this value in order to compute MaxChildrenReached/Age. This value
            # is the rate at which PHP-FPM hits its maximum workers. The closer it gets to
            # 1, the harder it means PHP-FPM is working.
            "max children reached" = {
              name = "MaxChildrenReached"
              unit = "Count"
            }
          })
        },

        {
          name = "WEBCMS_METRICS_SCRIPT"

          # This is a jq script (https://stedolan.github.io/jq) that processes the metrics
          # map against the output of PHP-FPM's status page.
          #
          # It is a simple array loop that expands { key, value } pairs from the
          # $WEBCMS_METRICS_MAP, looks up the key in the PHP-FPM output, and then formats
          # the result as a set of CloudWatch metrics.
          #
          # The beginning of the script is a variable assignment, ". as $input", which
          # saves the input stream (the JSON output from curl) as a variable, and switches
          # over to looping over the entries of the $metrics variable (the parsed JSON
          # of $WEBCMS_METRICS_MAP).
          #
          # The to_entries function converts an object into an array of { key, value }
          # objects, where key is the JSON key (e.g., "idle processes") and value is the
          # object value - in this case, it will be the { name, unit } pair.
          #
          # After that, the map() function constructs a CloudWatch-formatted value
          # suitable for passing to `aws cloudwatch put-metric-data`, which handles the
          # heavy lifting of publishing the PHP-FPM metrics.
          value = <<-SCRIPT
            . as $input
            | $metrics
            | to_entries
            | map({
              MetricName: .value.name,
              Unit: .value.unit,
              Value: $input[.key],
              Timestamp: now | floor,
              Dimensions: [
                { Name: "Environment", Value: "\($ENV.WEBCMS_ENV_NAME)" }
              ]
            })
          SCRIPT
        },
      ]

      # The inline shell script here scrapes PHP-FPM's metrics every 60 seconds and
      # reports them back to CloudWatch. It uses the inline jq script and metrics
      # configuration (see above) to transform the FPM output to what the
      # `put-metric-data` command expects.
      entrypoint = ["/bin/sh", "-c"]
      command = [
        <<-COMMAND
        apk add --no-cache aws-cli curl jq

        while true; do
          sleep 60

          input="$(curl -s http://localhost:8080/status?json)"
          echo "PHP-FPM metrics: $input"

          metrics="$(echo "$input" | jq -c "$WEBCMS_METRICS_SCRIPT" --argjson metrics "$WEBCMS_METRICS_MAP")"
          echo "CloudWatch metrics: $metrics"

          aws cloudwatch --region=${var.aws-region} put-metric-data --namespace WebCMS/FPM --metric-data "$metrics"
        done
        COMMAND
      ]

      logConfiguration = {
        logDriver = "awslogs",

        options = {
          awslogs-group  = aws_cloudwatch_log_group.fpm_metrics.name,
          awslogs-region = var.aws-region,
        }
      }
    }
  ])

  tags = merge(local.common-tags, {
    Name = "${local.name-prefix} Task - Drupal"
  })

  # Explicitly depend on IAM permissions: if we don't, the ECS service may not be able
  # to launch tasks
  depends_on = [
    aws_iam_role_policy_attachment.drupal_execution_tasks,
    aws_iam_role_policy_attachment.drupal_execution_parameters
  ]
}

# Create the actual ECS service that serves Drupal traffic. This uses the Drupal task
# definition from above as its template, and adds the configuration ECS needs in order
# to know how many copies to run, what the scaling rules are, and how to route traffic
# to it from a load balancer.
#
# NB. Be careful with parameters here; Terraform will often force replacement of a service
# instead of an update which can result in downtime.
resource "aws_ecs_service" "drupal" {
  # We don't want to replicate the conditional for the drupal/nginx image tags, so we
  # simply echo the count of the task resource we're depending on. This will carry forward
  # to the autoscaling rules below.
  count = length(aws_ecs_task_definition.drupal_task)

  name            = "webcms-drupal-${local.env-suffix}"
  cluster         = aws_ecs_cluster.cluster.arn
  desired_count   = 1
  task_definition = aws_ecs_task_definition.drupal_task[count.index].arn

  health_check_grace_period_seconds = 0

  # We leave the launch_type and scheduling_strategy to their defaults, which are EC2
  # and REPLICA, respectively.

  capacity_provider_strategy {
    base              = 0
    capacity_provider = aws_ecs_capacity_provider.cluster_capacity.name
    weight            = 100
  }

  deployment_controller {
    type = "ECS"
  }

  # Advertise the nginx container's port 80 to the load balancer.
  load_balancer {
    container_name   = "nginx"
    container_port   = 80
    target_group_arn = aws_lb_target_group.drupal_target_group.arn
  }

  # Since we're running our tasks in AWSVPC mode, we have to give extra VPC configuration.
  # We launch the Drupal tasks into our private subnet (which means that they don't get
  # public-facing IPs), and attach the Drupal-specific VPC rules to each task.
  network_configuration {
    subnets          = aws_subnet.private.*.id
    assign_public_ip = false

    security_groups = local.drupal-security-groups
  }

  # Ask ECS to prioritize spreading tasks across available EC2 instances before running
  # multiple copies on a server. This should alleviate downtime
  ordered_placement_strategy {
    field = "instanceId"
    type  = "spread"
  }

  # Ignore changes to the desired_count attribute - we assume that the application
  # autoscaling rules will take over
  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Define the Drupal service as an autoscaling target. Effectively, this configuration
# asks AWS to monitor the desired count of Drupal service replicas.
resource "aws_appautoscaling_target" "drupal" {
  count = length(aws_ecs_service.drupal)

  min_capacity       = var.cluster-min-capacity
  max_capacity       = var.cluster-max-capacity
  resource_id        = "service/${aws_ecs_cluster.cluster.name}/${aws_ecs_service.drupal[count.index].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Read out the ARNs for the load balancer and Drupal target group (used below)
data "aws_arn" "alb" {
  arn = aws_lb.frontend.arn
}

data "aws_arn" "target_group" {
  arn = aws_lb_target_group.drupal_target_group.arn
}

# Define an autoscaling rule. We scale when the load balancer reports an average of more
# than 50 requests/target, indicating a high volume of traffic spread across too few
# containers. If the metric goes above this threshold, ECS will add replicas of the
# Drupal task.
resource "aws_appautoscaling_policy" "drupal_autoscaling" {
  count = length(aws_appautoscaling_target.drupal)

  name        = "webcms-drupal-scaling-${local.env-suffix}"
  policy_type = "TargetTrackingScaling"

  # These identify what we're scaling (see the autoscaling target above)
  # NB. Since these resources are all conditionally created, we key on count.index to
  # avoid Terraform warnings about resource lists.
  resource_id        = aws_appautoscaling_target.drupal[count.index].id
  scalable_dimension = aws_appautoscaling_target.drupal[count.index].scalable_dimension
  service_namespace  = aws_appautoscaling_target.drupal[count.index].service_namespace

  # Autoscaling rules: What is the condition that triggers scaling of the above target?
  target_tracking_scaling_policy_configuration {
    target_value = 50

    # Wait 5 minutes before scaling in, but only 1 for scaling out.
    scale_in_cooldown  = 5 * 60
    scale_out_cooldown = 60

    # Which metrics are we monitoring
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${substr(data.aws_arn.alb.resource, length("loadbalancer/"), length(data.aws_arn.alb.resource))}/${data.aws_arn.target_group.resource}"
    }
  }
}
