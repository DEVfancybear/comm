<?php

require_once('config.php');
require_once('auth.php');
require_once('permissions.php');

define("VISIBILITY_OPEN", 0);
define("VISIBILITY_CLOSED", 1);
define("VISIBILITY_SECRET", 2);
define("VISIBILITY_NESTED_OPEN", 3);
define("VISIBILITY_THREAD_SECRET", 4);
define("EDIT_ANYBODY", 0);
define("EDIT_LOGGED_IN", 1);

function vis_rules_are_open($vis_rules) {
  return $vis_rules === VISIBILITY_OPEN || $vis_rules === VISIBILITY_NESTED_OPEN;
}

function get_thread_infos($specific_condition="") {
  global $conn;

  $viewer_id = get_viewer_id();
  $where_clause = $specific_condition ? "WHERE $specific_condition" : "";

  $query = <<<SQL
SELECT t.id, t.name, t.parent_thread_id, t.color, t.description, t.edit_rules,
  t.visibility_rules, t.creation_time, t.default_role, r.id AS role,
  r.name AS role_name, r.permissions AS role_permissions, m.user,
  m.permissions, m.subscribed, u.username
FROM threads t
LEFT JOIN (
    SELECT thread, id, name, permissions
      FROM roles
    UNION SELECT id AS thread, 0 AS id, NULL AS name, NULL AS permissions
      FROM threads
  ) r ON r.thread = t.id
LEFT JOIN memberships m ON m.role = r.id AND m.thread = t.id
LEFT JOIN users u ON u.id = m.user
{$where_clause}
ORDER BY m.user ASC
SQL;
  $result = $conn->query($query);

  $thread_infos = array();
  $user_infos = array();
  while ($row = $result->fetch_assoc()) {
    $thread_id = $row['id'];
    if (!isset($thread_infos[$thread_id])) {
      $thread_infos[$thread_id] = array(
        "id" => $thread_id,
        "name" => $row['name'],
        "description" => $row['description'],
        "visibilityRules" => (int)$row['visibility_rules'],
        "color" => $row['color'],
        "editRules" => (int)$row['edit_rules'],
        "creationTime" => (int)$row['creation_time'],
        "parentThreadID" => $row['parent_thread_id'],
        "members" => array(),
        "roles" => array(),
        "currentUser" => null,
      );
    }
    if (
      $row['role'] &&
      !isset($thread_infos[$thread_id]['roles'][$row['role']])
    ) {
      $role_permissions = json_decode($row['role_permissions'], true);
      $thread_infos[$thread_id]['roles'][$row['role']] = array(
        "id" => $row['role'],
        "name" => $row['role_name'],
        "permissions" => $role_permissions,
        "isDefault" => $row['role'] === $row['default_role'],
      );
    }
    if ($row['user'] !== null) {
      $user_id = $row['user'];
      $permission_info = get_info_from_permissions_row($row);
      $all_permissions =
        get_all_thread_permissions($permission_info, $thread_id);
      // This is a hack, similar to what we have in ThreadSettingsUser.
      // Basically we only want to return users that are either a member of this
      // thread, or are a "parent admin". We approximate "parent admin" by
      // looking for the PERMISSION_CHANGE_ROLE permission.
      if (
        (int)$row['role'] !== 0 ||
        $all_permissions[PERMISSION_CHANGE_ROLE]['value']
      ) {
        $member = array(
          "id" => $user_id,
          "permissions" => $all_permissions,
          "role" => (int)$row['role'] === 0 ? null : $row['role'],
        );
        $thread_infos[$thread_id]['members'][] = $member;
        if ((int)$user_id === $viewer_id) {
          $thread_infos[$thread_id]['currentUser'] = array(
            "permissions" => $member['permissions'],
            "role" => $member['role'],
            "subscribed" => !!$row['subscribed'],
          );
        }
        if ($row['username']) {
          $user_infos[$user_id] = array(
            "id" => $user_id,
            "username" => $row['username'],
          );
        }
      }
    }
  }

  $final_thread_infos = array();
  foreach ($thread_infos as $thread_id => $thread_info) {
    if ($thread_info['currentUser'] === null) {
      $all_permissions = get_all_thread_permissions(
        array(
          "permissions" => null,
          "visibility_rules" => $thread_info['visibilityRules'],
          "edit_rules" => $thread_info['editRules'],
        ),
        $thread_id
      );
      $thread_info['currentUser'] = array(
        "permissions" => $all_permissions,
        "role" => null,
        "subscribed" => false,
      );
    } else {
      $all_permissions = $thread_info['currentUser']['permissions'];
    }
    if (permission_lookup($all_permissions, PERMISSION_KNOW_OF)) {
      $final_thread_infos[$thread_id] = $thread_info;
    }
  }

  return array($final_thread_infos, $user_infos);
}

function verify_thread_ids($thread_ids) {
  global $conn;

  $int_thread_ids = array_map('intval', $thread_ids);
  $thread_ids_string = implode(", ", $int_thread_ids);

  $query = <<<SQL
SELECT id FROM threads WHERE id IN ({$thread_ids_string})
SQL;
  $result = $conn->query($query);
  $verified_thread_ids = array();
  while ($row = $result->fetch_assoc()) {
    $verified_thread_ids[] = (int)$row['id'];
  }
  return $verified_thread_ids;
}

function verify_thread_id($thread_id) {
  return !!verify_thread_ids(array($thread_id));
}

function update_focused_threads($focus_commands) {
  global $conn;

  list($viewer_id, $is_user, $cookie_id) = get_viewer_info();
  if (!$is_user) {
    return false;
  }

  $query = <<<SQL
DELETE FROM focused WHERE user = {$viewer_id} AND cookie = {$cookie_id}
SQL;
  $conn->query($query);

  $unverified_thread_ids = array();
  foreach ($focus_commands as $focus_command) {
    if ($focus_command['focus'] !== "true") {
      continue;
    }
    $thread_id = (int)$focus_command['threadID'];
    $unverified_thread_ids[$thread_id] = $thread_id;
  }
  $thread_ids = verify_thread_ids($unverified_thread_ids);

  $time = round(microtime(true) * 1000); // in milliseconds
  $values_sql_strings = array();
  foreach ($thread_ids as $thread_id) {
    $values_sql_strings[] = "(" . implode(
      ", ",
      array($viewer_id, $cookie_id, $thread_id, $time)
    ) . ")";
  }

  if ($values_sql_strings) {
    $values_sql_string = implode(", ", $values_sql_strings);
    $query = <<<SQL
INSERT INTO focused (user, cookie, thread, time) VALUES {$values_sql_string}
SQL;
    $conn->query($query);
  }

  return true;
}

function update_focused_thread_time($time) {
  global $conn;

  list($viewer_id, $is_user, $cookie_id) = get_viewer_info();
  if (!$is_user) {
    return;
  }

  $query = <<<SQL
UPDATE focused
SET time = {$time}
WHERE user = {$viewer_id} AND cookie = {$cookie_id}
SQL;
  $conn->query($query);
}
