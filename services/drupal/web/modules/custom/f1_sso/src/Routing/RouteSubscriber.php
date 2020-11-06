<?php

namespace Drupal\f1_sso\Routing;

use Drupal\Core\Routing\RouteSubscriberBase;
use Symfony\Component\Routing\RouteCollection;
use Drupal\Core\Site\Settings;

class RouteSubscriber extends RouteSubscriberBase {
  /**
   * {@inheritdoc}
   */
  protected function alterRoutes(RouteCollection $collection) {
    if (Settings::get('f1_sso_enabled', FALSE)) {
      if (($route = $collection->get('user.login'))) {
        $route->setDefaults(['_controller' => '\\Drupal\\f1_sso\\Controller\\SSOController::userLogin']);
        $route->setOption('no_cache', TRUE);
      }
    }
  }
}
