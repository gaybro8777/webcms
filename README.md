# First-Time Setup

1. First, start the project:

   ```
   f1 up
   ```

2. Next, create the S3 bucket for s3fs:

   ```
   f1 run aws s3 mb s3://drupal
   ```

3. Finally, allow anonymous access to the `public/` prefix of the S3 bucket: 

   ```
   f1 run aws s3api put-bucket-policy --bucket drupal --policy "$(cat services/minio/policy.json)"
   ```

4. Copy `services/drupal/.env.example` to `services/drupal/.env`.

5. Install dependencies: ```f1 composer install```

6. Build the CSS and Pattern Lab: `f1 run gesso gulp build`.

7. Install Drupal from config (or restore a backup).  You can install from config by running: ```f1 drush si --existing-config```

8. Import custom block configurations and clear cache: ```f1 drush ib --choice safe; f1 drush cr``` 

9. Edit your `services/drupal/.env` file and change the line that reads `ENV_STATE=build` to read `ENV_STATE=run` -- without this change you will not make use of Redis caching.

# Other READMEs

- Terraform configuration: see [infrastructure/terraform](infrastructure/terraform/README.md).
- Builds: see [.buildkite](.buildkite/README.md).
