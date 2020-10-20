<?php

// Override SMTP settings
// These specific overrides are no longer necessary if you're using the latest
// .env file but we'll leave them here to avoid breaking things for people who
// haven't added the port and protocol entries to their .env files.
$config['smtp.settings']['smtp_port'] = 1025;
$config['smtp.settings']['smtp_protocol'] = 'standard';

// Don't initiate TLS sessions during local development; the MySQL certificate is
// self-signed, which OpenSSL rejects
unset($databases['default']['default']['pdo'][PDO::MYSQL_ATTR_SSL_CA]);

// Replace profile credentials with Minio-specific secrets
unset($config['s3fs.settings']['use_instance_profile']);
$settings['s3fs.access_key'] = 'minio_access';
$settings['s3fs.secret_key'] = 'minio_secret';

// Override the endpoint used by s3fs in order to talk to Minio.
$config['s3fs.settings']['use_customhost'] = TRUE;
$config['s3fs.settings']['hostname'] = 'minio:9000';

// Override output to point to localhost:8888/drupal in order to see Minio-saved files
$config['s3fs.settings']['use_cname'] = TRUE;
$config['s3fs.settings']['domain'] = 'localhost:8888/drupal';

// Map twig cache onto shared filesystem to allow drush to clear and write twig cache for local development.
$settings['php_storage']['twig']['directory'] = '/var/www/html/web/sites/default/files/tmp/cache/twig';

$config['system.logging']['error_level'] = 'all';

// Set the base url for node export operations. Setting this to "localhost"
// instead of "localhost:8080" since this will be utilized by wget and it will
// use the internal Docker url which uses port 80.
$settings['epa_node_export.base_url'] = 'http://localhost';

// Local environments can't use AWS elasticache auto discovery
if (defined('Memcached::OPT_CLIENT_MODE')) {
  unset($settings['memcache']['options'][Memcached::OPT_CLIENT_MODE]);
}

$settings['container_yamls'][] = DRUPAL_ROOT . '/sites/development.services.yml';

ini_set('max_execution_time', 0);
