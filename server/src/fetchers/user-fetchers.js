// @flow

import { hasMinCodeVersion } from 'lib/shared/version-utils';
import {
  undirectedStatus,
  directedStatus,
  userRelationshipStatus,
} from 'lib/types/relationship-types';
import type {
  UserInfos,
  CurrentUserInfo,
  OldCurrentUserInfo,
  LoggedInUserInfo,
  OldLoggedInUserInfo,
  GlobalUserInfo,
} from 'lib/types/user-types';
import { ServerError } from 'lib/utils/errors';

import { dbQuery, SQL } from '../database/database';
import type { Viewer } from '../session/viewer';

async function fetchUserInfos(
  userIDs: string[],
): Promise<{ [id: string]: GlobalUserInfo }> {
  if (userIDs.length <= 0) {
    return {};
  }

  const query = SQL`
    SELECT id, username FROM users WHERE id IN (${userIDs})
  `;
  const [result] = await dbQuery(query);

  const userInfos = {};
  for (const row of result) {
    const id = row.id.toString();
    userInfos[id] = {
      id,
      username: row.username,
    };
  }
  for (const userID of userIDs) {
    if (!userInfos[userID]) {
      userInfos[userID] = {
        id: userID,
        username: null,
      };
    }
  }

  return userInfos;
}

async function fetchKnownUserInfos(
  viewer: Viewer,
  userIDs?: $ReadOnlyArray<string>,
): Promise<UserInfos> {
  if (!viewer.loggedIn) {
    return {};
  }
  if (userIDs && userIDs.length === 0) {
    return {};
  }

  const query = SQL`
    SELECT ru.user1, ru.user2, ru.status AS undirected_status,
      rd1.status AS user1_directed_status, rd2.status AS user2_directed_status,
      u.username
    FROM relationships_undirected ru
    LEFT JOIN relationships_directed rd1
      ON rd1.user1 = ru.user1 AND rd1.user2 = ru.user2
    LEFT JOIN relationships_directed rd2
      ON rd2.user1 = ru.user2 AND rd2.user2 = ru.user1
    LEFT JOIN users u
      ON u.id != ${viewer.userID} AND (u.id = ru.user1 OR u.id = ru.user2)
  `;
  if (userIDs) {
    query.append(SQL`
      WHERE (ru.user1 = ${viewer.userID} AND ru.user2 IN (${userIDs})) OR
        (ru.user1 IN (${userIDs}) AND ru.user2 = ${viewer.userID})
    `);
  } else {
    query.append(SQL`
      WHERE ru.user1 = ${viewer.userID} OR ru.user2 = ${viewer.userID}
    `);
  }
  query.append(SQL`
    UNION SELECT id AS user1, NULL AS user2, NULL AS undirected_status,
      NULL AS user1_directed_status, NULL AS user2_directed_status,
      username
    FROM users
    WHERE id = ${viewer.userID}
  `);
  const [result] = await dbQuery(query);

  const userInfos = {};
  for (const row of result) {
    const user1 = row.user1.toString();
    const user2 = row.user2 ? row.user2.toString() : null;
    const id = user1 === viewer.userID && user2 ? user2 : user1;
    const userInfo = {
      id,
      username: row.username,
    };

    if (!user2) {
      userInfos[id] = userInfo;
      continue;
    }

    let viewerDirectedStatus;
    let targetDirectedStatus;
    if (user1 === viewer.userID) {
      viewerDirectedStatus = row.user1_directed_status;
      targetDirectedStatus = row.user2_directed_status;
    } else {
      viewerDirectedStatus = row.user2_directed_status;
      targetDirectedStatus = row.user1_directed_status;
    }

    const viewerBlockedTarget = viewerDirectedStatus === directedStatus.BLOCKED;
    const targetBlockedViewer = targetDirectedStatus === directedStatus.BLOCKED;
    const friendshipExists = row.undirected_status === undirectedStatus.FRIEND;
    const viewerRequestedTargetFriendship =
      viewerDirectedStatus === directedStatus.PENDING_FRIEND;
    const targetRequestedViewerFriendship =
      targetDirectedStatus === directedStatus.PENDING_FRIEND;

    let relationshipStatus;
    if (viewerBlockedTarget && targetBlockedViewer) {
      relationshipStatus = userRelationshipStatus.BOTH_BLOCKED;
    } else if (targetBlockedViewer) {
      relationshipStatus = userRelationshipStatus.BLOCKED_VIEWER;
    } else if (viewerBlockedTarget) {
      relationshipStatus = userRelationshipStatus.BLOCKED_BY_VIEWER;
    } else if (friendshipExists) {
      relationshipStatus = userRelationshipStatus.FRIEND;
    } else if (targetRequestedViewerFriendship) {
      relationshipStatus = userRelationshipStatus.REQUEST_RECEIVED;
    } else if (viewerRequestedTargetFriendship) {
      relationshipStatus = userRelationshipStatus.REQUEST_SENT;
    }

    userInfos[id] = userInfo;
    if (relationshipStatus) {
      userInfos[id].relationshipStatus = relationshipStatus;
    }

    if (relationshipStatus && !row.username) {
      console.warn(
        `user ${viewer.userID} has ${relationshipStatus} relationship with ` +
          `anonymous user ${id}`,
      );
    }
  }

  return userInfos;
}

async function verifyUserIDs(
  userIDs: $ReadOnlyArray<string>,
): Promise<string[]> {
  if (userIDs.length === 0) {
    return [];
  }
  const query = SQL`SELECT id FROM users WHERE id IN (${userIDs})`;
  const [result] = await dbQuery(query);
  return result.map(row => row.id.toString());
}

async function verifyUserOrCookieIDs(
  ids: $ReadOnlyArray<string>,
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }
  const query = SQL`
    SELECT id FROM users WHERE id IN (${ids})
    UNION SELECT id FROM cookies WHERE id IN (${ids})
  `;
  const [result] = await dbQuery(query);
  return result.map(row => row.id.toString());
}

async function fetchCurrentUserInfo(
  viewer: Viewer,
): Promise<OldCurrentUserInfo | CurrentUserInfo> {
  if (!viewer.loggedIn) {
    return ({ id: viewer.cookieID, anonymous: true }: CurrentUserInfo);
  }
  const currentUserInfo = await fetchLoggedInUserInfo(viewer);
  return currentUserInfo;
}

async function fetchLoggedInUserInfo(
  viewer: Viewer,
): Promise<OldLoggedInUserInfo | LoggedInUserInfo> {
  const userQuery = SQL`
    SELECT id, username
    FROM users
    WHERE id = ${viewer.userID}
  `;

  const settingsQuery = SQL`
    SELECT name, data
    FROM settings
    WHERE user = ${viewer.userID}
  `;

  const [[userResult], [settingsResult]] = await Promise.all([
    dbQuery(userQuery),
    dbQuery(settingsQuery),
  ]);

  const [userRow] = userResult;

  const stillExpectsEmailFields = !hasMinCodeVersion(
    viewer.platformDetails,
    87,
  );

  if (!userRow) {
    throw new ServerError('unknown_error');
  }

  const id = userRow.id.toString();
  const { username } = userRow;

  if (stillExpectsEmailFields) {
    return {
      id,
      username,
      email: 'removed from DB',
      emailVerified: true,
    };
  }

  const featureGateSettings = !hasMinCodeVersion(viewer.platformDetails, 1000);

  if (featureGateSettings) {
    return { id, username };
  }

  const settings = settingsResult.reduce((prev, curr) => {
    prev[curr.name] = curr.data;
    return prev;
  }, {});

  return { id, username, settings };
}

async function fetchAllUserIDs(): Promise<string[]> {
  const query = SQL`SELECT id FROM users`;
  const [result] = await dbQuery(query);
  return result.map(row => row.id.toString());
}

async function fetchUsername(id: string): Promise<?string> {
  const query = SQL`SELECT username FROM users WHERE id = ${id}`;
  const [result] = await dbQuery(query);
  if (result.length === 0) {
    return null;
  }
  const row = result[0];
  return row.username;
}

export {
  fetchUserInfos,
  fetchLoggedInUserInfo,
  verifyUserIDs,
  verifyUserOrCookieIDs,
  fetchCurrentUserInfo,
  fetchAllUserIDs,
  fetchUsername,
  fetchKnownUserInfos,
};
