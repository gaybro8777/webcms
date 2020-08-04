FROM forumone/drupal8-cli:7.3

# Extensions needed:
# - Memcached (easier to build than the AWS Elasticache extension, and of equivalent functionality in local envs)
# - APCu for Drupal caching
# - sockets for communication with the migrate monitor container
RUN f1-ext-install \
  pecl:memcached \
  pecl:apcu \
  builtin:sockets
