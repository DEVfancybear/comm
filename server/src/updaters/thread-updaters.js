// @flow

import { filteredThreadIDs } from 'lib/selectors/calendar-filter-selectors';
import {
  threadHasAdminRole,
  roleIsAdminRole,
  viewerIsMember,
  getThreadTypeParentRequirement,
} from 'lib/shared/thread-utils';
import { hasMinCodeVersion } from 'lib/shared/version-utils';
import type { Shape } from 'lib/types/core';
import { messageTypes, defaultNumberPerThread } from 'lib/types/message-types';
import {
  type RoleChangeRequest,
  type ChangeThreadSettingsResult,
  type RemoveMembersRequest,
  type LeaveThreadRequest,
  type LeaveThreadResult,
  type UpdateThreadRequest,
  type ServerThreadJoinRequest,
  type ThreadJoinResult,
  threadPermissions,
  threadTypes,
} from 'lib/types/thread-types';
import { updateTypes } from 'lib/types/update-types';
import { ServerError } from 'lib/utils/errors';
import { promiseAll } from 'lib/utils/promises';
import { firstLine } from 'lib/utils/string-utils';

import createMessages from '../creators/message-creator';
import { getRolePermissionBlobs } from '../creators/role-creator';
import { createUpdates } from '../creators/update-creator';
import { dbQuery, SQL } from '../database/database';
import { fetchEntryInfos } from '../fetchers/entry-fetchers';
import { fetchMessageInfos } from '../fetchers/message-fetchers';
import {
  fetchThreadInfos,
  fetchServerThreadInfos,
  determineThreadAncestry,
} from '../fetchers/thread-fetchers';
import {
  checkThreadPermission,
  viewerIsMember as fetchViewerIsMember,
  checkThread,
  validateCandidateMembers,
} from '../fetchers/thread-permission-fetchers';
import {
  verifyUserIDs,
  verifyUserOrCookieIDs,
} from '../fetchers/user-fetchers';
import type { Viewer } from '../session/viewer';
import RelationshipChangeset from '../utils/relationship-changeset';
import { updateRoles } from './role-updaters';
import {
  changeRole,
  recalculateThreadPermissions,
  commitMembershipChangeset,
} from './thread-permission-updaters';

async function updateRole(
  viewer: Viewer,
  request: RoleChangeRequest,
): Promise<ChangeThreadSettingsResult> {
  if (!viewer.loggedIn) {
    throw new ServerError('not_logged_in');
  }

  const [memberIDs, hasPermission] = await Promise.all([
    verifyUserIDs(request.memberIDs),
    checkThreadPermission(
      viewer,
      request.threadID,
      threadPermissions.CHANGE_ROLE,
    ),
  ]);
  if (memberIDs.length === 0) {
    throw new ServerError('invalid_parameters');
  }
  if (!hasPermission) {
    throw new ServerError('invalid_credentials');
  }

  const query = SQL`
    SELECT user, role
    FROM memberships
    WHERE user IN (${memberIDs}) AND thread = ${request.threadID}
  `;
  const [result] = await dbQuery(query);

  let nonMemberUser = false;
  let numResults = 0;
  for (const row of result) {
    if (row.role <= 0) {
      nonMemberUser = true;
      break;
    }
    numResults++;
  }
  if (nonMemberUser || numResults < memberIDs.length) {
    throw new ServerError('invalid_parameters');
  }

  const changeset = await changeRole(request.threadID, memberIDs, request.role);
  const { threadInfos, viewerUpdates } = await commitMembershipChangeset(
    viewer,
    changeset,
  );

  const messageData = {
    type: messageTypes.CHANGE_ROLE,
    threadID: request.threadID,
    creatorID: viewer.userID,
    time: Date.now(),
    userIDs: memberIDs,
    newRole: request.role,
  };
  const newMessageInfos = await createMessages(viewer, [messageData]);

  if (hasMinCodeVersion(viewer.platformDetails, 62)) {
    return { updatesResult: { newUpdates: viewerUpdates }, newMessageInfos };
  }

  return {
    threadInfo: threadInfos[request.threadID],
    threadInfos,
    updatesResult: {
      newUpdates: viewerUpdates,
    },
    newMessageInfos,
  };
}

async function removeMembers(
  viewer: Viewer,
  request: RemoveMembersRequest,
): Promise<ChangeThreadSettingsResult> {
  const viewerID = viewer.userID;
  if (request.memberIDs.includes(viewerID)) {
    throw new ServerError('invalid_parameters');
  }

  const [memberIDs, hasPermission] = await Promise.all([
    verifyUserOrCookieIDs(request.memberIDs),
    checkThreadPermission(
      viewer,
      request.threadID,
      threadPermissions.REMOVE_MEMBERS,
    ),
  ]);
  if (memberIDs.length === 0) {
    throw new ServerError('invalid_parameters');
  }
  if (!hasPermission) {
    throw new ServerError('invalid_credentials');
  }

  const query = SQL`
    SELECT m.user, m.role, t.default_role
    FROM memberships m
    LEFT JOIN threads t ON t.id = m.thread
    WHERE m.user IN (${memberIDs}) AND m.thread = ${request.threadID}
  `;
  const [result] = await dbQuery(query);

  let nonDefaultRoleUser = false;
  const actualMemberIDs = [];
  for (const row of result) {
    if (row.role <= 0) {
      continue;
    }
    actualMemberIDs.push(row.user.toString());
    if (row.role !== row.default_role) {
      nonDefaultRoleUser = true;
    }
  }

  if (nonDefaultRoleUser) {
    const hasChangeRolePermission = await checkThreadPermission(
      viewer,
      request.threadID,
      threadPermissions.CHANGE_ROLE,
    );
    if (!hasChangeRolePermission) {
      throw new ServerError('invalid_credentials');
    }
  }

  const changeset = await changeRole(request.threadID, actualMemberIDs, 0);
  const { threadInfos, viewerUpdates } = await commitMembershipChangeset(
    viewer,
    changeset,
  );

  const newMessageInfos = await (async () => {
    if (actualMemberIDs.length === 0) {
      return [];
    }
    const messageData = {
      type: messageTypes.REMOVE_MEMBERS,
      threadID: request.threadID,
      creatorID: viewerID,
      time: Date.now(),
      removedUserIDs: actualMemberIDs,
    };
    return await createMessages(viewer, [messageData]);
  })();

  if (hasMinCodeVersion(viewer.platformDetails, 62)) {
    return { updatesResult: { newUpdates: viewerUpdates }, newMessageInfos };
  }

  return {
    threadInfo: threadInfos[request.threadID],
    threadInfos,
    updatesResult: {
      newUpdates: viewerUpdates,
    },
    newMessageInfos,
  };
}

async function leaveThread(
  viewer: Viewer,
  request: LeaveThreadRequest,
): Promise<LeaveThreadResult> {
  if (!viewer.loggedIn) {
    throw new ServerError('not_logged_in');
  }

  const [fetchThreadResult, hasPermission] = await Promise.all([
    fetchThreadInfos(viewer, SQL`t.id = ${request.threadID}`),
    checkThreadPermission(
      viewer,
      request.threadID,
      threadPermissions.LEAVE_THREAD,
    ),
  ]);

  const threadInfo = fetchThreadResult.threadInfos[request.threadID];

  if (!viewerIsMember(threadInfo)) {
    if (hasMinCodeVersion(viewer.platformDetails, 62)) {
      return {
        updatesResult: { newUpdates: [] },
      };
    }
    const { threadInfos } = await fetchThreadInfos(viewer);
    return {
      threadInfos,
      updatesResult: {
        newUpdates: [],
      },
    };
  }

  if (!hasPermission) {
    throw new ServerError('invalid_parameters');
  }

  const viewerID = viewer.userID;
  if (threadHasAdminRole(threadInfo)) {
    let otherUsersExist = false;
    let otherAdminsExist = false;
    for (const member of threadInfo.members) {
      const role = member.role;
      if (!role || member.id === viewerID) {
        continue;
      }
      otherUsersExist = true;
      if (roleIsAdminRole(threadInfo.roles[role])) {
        otherAdminsExist = true;
        break;
      }
    }
    if (otherUsersExist && !otherAdminsExist) {
      throw new ServerError('invalid_parameters');
    }
  }

  const changeset = await changeRole(request.threadID, [viewerID], 0);
  const { threadInfos, viewerUpdates } = await commitMembershipChangeset(
    viewer,
    changeset,
  );

  const messageData = {
    type: messageTypes.LEAVE_THREAD,
    threadID: request.threadID,
    creatorID: viewerID,
    time: Date.now(),
  };
  await createMessages(viewer, [messageData]);

  if (hasMinCodeVersion(viewer.platformDetails, 62)) {
    return { updatesResult: { newUpdates: viewerUpdates } };
  }

  return {
    threadInfos,
    updatesResult: {
      newUpdates: viewerUpdates,
    },
  };
}

type UpdateThreadOptions = Shape<{
  +forceAddMembers: boolean,
  +forceUpdateRoot: boolean,
  +silenceMessages: boolean,
  +ignorePermissions: boolean,
}>;

async function updateThread(
  viewer: Viewer,
  request: UpdateThreadRequest,
  options?: UpdateThreadOptions,
): Promise<ChangeThreadSettingsResult> {
  if (!viewer.loggedIn) {
    throw new ServerError('not_logged_in');
  }
  const forceAddMembers = options?.forceAddMembers ?? false;
  const forceUpdateRoot = options?.forceUpdateRoot ?? false;
  const silenceMessages = options?.silenceMessages ?? false;
  const ignorePermissions =
    (options?.ignorePermissions && viewer.isScriptViewer) ?? false;
  const validationPromises = {};

  const changedFields = {};
  const sqlUpdate = {};
  const untrimmedName = request.changes.name;
  if (untrimmedName !== undefined && untrimmedName !== null) {
    const name = firstLine(untrimmedName);
    changedFields.name = name;
    sqlUpdate.name = name ?? null;
  }
  const { description } = request.changes;
  if (description !== undefined && description !== null) {
    changedFields.description = description;
    sqlUpdate.description = description ?? null;
  }
  if (request.changes.color) {
    const color = request.changes.color.toLowerCase();
    changedFields.color = color;
    sqlUpdate.color = color;
  }
  const { parentThreadID } = request.changes;
  if (parentThreadID !== undefined) {
    // TODO some sort of message when this changes
    sqlUpdate.parent_thread_id = parentThreadID;
  }

  const threadType = request.changes.type;
  if (threadType !== null && threadType !== undefined) {
    changedFields.type = threadType;
    sqlUpdate.type = threadType;
  }

  if (
    !ignorePermissions &&
    threadType !== null &&
    threadType !== undefined &&
    threadType !== threadTypes.COMMUNITY_OPEN_SUBTHREAD &&
    threadType !== threadTypes.COMMUNITY_SECRET_SUBTHREAD
  ) {
    throw new ServerError('invalid_parameters');
  }

  const newMemberIDs =
    request.changes.newMemberIDs && request.changes.newMemberIDs.length > 0
      ? [...new Set(request.changes.newMemberIDs)]
      : null;

  if (
    Object.keys(sqlUpdate).length === 0 &&
    !newMemberIDs &&
    !forceUpdateRoot
  ) {
    throw new ServerError('invalid_parameters');
  }

  validationPromises.serverThreadInfos = fetchServerThreadInfos(
    SQL`t.id = ${request.threadID}`,
  );

  validationPromises.hasNecessaryPermissions = (async () => {
    if (ignorePermissions) {
      return;
    }
    const checks = [];
    if (sqlUpdate.name !== undefined) {
      checks.push({
        check: 'permission',
        permission: threadPermissions.EDIT_THREAD_NAME,
      });
    }
    if (sqlUpdate.description !== undefined) {
      checks.push({
        check: 'permission',
        permission: threadPermissions.EDIT_THREAD_DESCRIPTION,
      });
    }
    if (sqlUpdate.color !== undefined) {
      checks.push({
        check: 'permission',
        permission: threadPermissions.EDIT_THREAD_COLOR,
      });
    }
    if (parentThreadID !== undefined || sqlUpdate.type !== undefined) {
      checks.push({
        check: 'permission',
        permission: threadPermissions.EDIT_PERMISSIONS,
      });
    }
    if (newMemberIDs) {
      checks.push({
        check: 'permission',
        permission: threadPermissions.ADD_MEMBERS,
      });
    }
    const hasNecessaryPermissions = await checkThread(
      viewer,
      request.threadID,
      checks,
    );
    if (!hasNecessaryPermissions) {
      throw new ServerError('invalid_credentials');
    }
  })();

  const { serverThreadInfos } = await promiseAll(validationPromises);

  const serverThreadInfo = serverThreadInfos.threadInfos[request.threadID];
  if (!serverThreadInfo) {
    throw new ServerError('internal_error');
  }

  // Threads with source message should be visible to everyone, but we can't
  // guarantee it for COMMUNITY_SECRET_SUBTHREAD threads so we forbid it for
  // now. In the future, if we want to support this, we would need to unlink the
  // source message.
  if (
    threadType !== null &&
    threadType !== undefined &&
    threadType !== threadTypes.SIDEBAR &&
    threadType !== threadTypes.COMMUNITY_OPEN_SUBTHREAD &&
    serverThreadInfo.sourceMessageID
  ) {
    throw new ServerError('invalid_parameters');
  }

  // You can't change the parent thread of a current or former SIDEBAR
  if (parentThreadID !== undefined && serverThreadInfo.sourceMessageID) {
    throw new ServerError('invalid_parameters');
  }

  const oldThreadType = serverThreadInfo.type;
  const oldParentThreadID = serverThreadInfo.parentThreadID;
  const oldContainingThreadID = serverThreadInfo.containingThreadID;
  const oldCommunity = serverThreadInfo.community;
  const oldDepth = serverThreadInfo.depth;

  const nextThreadType =
    threadType !== null && threadType !== undefined
      ? threadType
      : oldThreadType;
  let nextParentThreadID =
    parentThreadID !== undefined ? parentThreadID : oldParentThreadID;

  // Does the new thread type preclude a parent?
  if (
    threadType !== undefined &&
    threadType !== null &&
    getThreadTypeParentRequirement(threadType) === 'disabled' &&
    nextParentThreadID !== null
  ) {
    nextParentThreadID = null;
    sqlUpdate.parent_thread_id = null;
  }

  // Does the new thread type require a parent?
  if (
    threadType !== undefined &&
    threadType !== null &&
    getThreadTypeParentRequirement(threadType) === 'required' &&
    nextParentThreadID === null
  ) {
    throw new ServerError('no_parent_thread_specified');
  }

  const determineThreadAncestryPromise = determineThreadAncestry(
    nextParentThreadID,
    nextThreadType,
  );

  const confirmParentPermissionPromise = (async () => {
    if (ignorePermissions || !nextParentThreadID) {
      return;
    }
    if (
      nextParentThreadID === oldParentThreadID &&
      (nextThreadType === threadTypes.SIDEBAR) ===
        (oldThreadType === threadTypes.SIDEBAR)
    ) {
      return;
    }
    const hasParentPermission = await checkThreadPermission(
      viewer,
      nextParentThreadID,
      nextThreadType === threadTypes.SIDEBAR
        ? threadPermissions.CREATE_SIDEBARS
        : threadPermissions.CREATE_SUBCHANNELS,
    );
    if (!hasParentPermission) {
      throw new ServerError('invalid_parameters');
    }
  })();

  const rolesNeedUpdate = forceUpdateRoot || nextThreadType !== oldThreadType;

  const validateNewMembersPromise = (async () => {
    if (!newMemberIDs || ignorePermissions) {
      return;
    }

    const defaultRolePermissionsPromise = (async () => {
      let rolePermissions;
      if (!rolesNeedUpdate) {
        const rolePermissionsQuery = SQL`
          SELECT r.permissions
          FROM threads t
          LEFT JOIN roles r ON r.id = t.default_role
          WHERE t.id = ${request.threadID}
        `;
        const [result] = await dbQuery(rolePermissionsQuery);
        if (result.length > 0) {
          rolePermissions = result[0].permissions;
        }
      }
      if (!rolePermissions) {
        rolePermissions = getRolePermissionBlobs(nextThreadType).Members;
      }
      return rolePermissions;
    })();

    const [defaultRolePermissions, nextThreadAncestry] = await Promise.all([
      defaultRolePermissionsPromise,
      determineThreadAncestryPromise,
    ]);

    const { newMemberIDs: validatedIDs } = await validateCandidateMembers(
      viewer,
      { newMemberIDs },
      {
        threadType: nextThreadType,
        parentThreadID: nextParentThreadID,
        containingThreadID: nextThreadAncestry.containingThreadID,
        defaultRolePermissions,
      },
      { requireRelationship: !forceAddMembers },
    );
    if (
      validatedIDs &&
      Number(validatedIDs?.length) < Number(newMemberIDs?.length)
    ) {
      throw new ServerError('invalid_credentials');
    }
  })();

  const { nextThreadAncestry } = await promiseAll({
    nextThreadAncestry: determineThreadAncestryPromise,
    confirmParentPermissionPromise,
    validateNewMembersPromise,
  });
  if (nextThreadAncestry.containingThreadID !== oldContainingThreadID) {
    sqlUpdate.containing_thread_id = nextThreadAncestry.containingThreadID;
  }
  if (nextThreadAncestry.community !== oldCommunity) {
    if (!ignorePermissions) {
      throw new ServerError('invalid_parameters');
    }
    sqlUpdate.community = nextThreadAncestry.community;
  }
  if (nextThreadAncestry.depth !== oldDepth) {
    sqlUpdate.depth = nextThreadAncestry.depth;
  }

  const updateQueryPromise = (async () => {
    if (Object.keys(sqlUpdate).length === 0) {
      return;
    }
    const updateQuery = SQL`
      UPDATE threads SET ${sqlUpdate} WHERE id = ${request.threadID}
    `;
    await dbQuery(updateQuery);
  })();

  const updateRolesPromise = (async () => {
    if (rolesNeedUpdate) {
      await updateRoles(viewer, request.threadID, nextThreadType);
    }
  })();

  const intermediatePromises = {};
  intermediatePromises.updateQuery = updateQueryPromise;
  intermediatePromises.updateRoles = updateRolesPromise;

  if (newMemberIDs) {
    intermediatePromises.addMembersChangeset = (async () => {
      await Promise.all([updateQueryPromise, updateRolesPromise]);
      return await changeRole(request.threadID, newMemberIDs, null, {
        setNewMembersToUnread: true,
      });
    })();
  }

  const threadRootChanged =
    rolesNeedUpdate || nextParentThreadID !== oldParentThreadID;
  if (threadRootChanged) {
    intermediatePromises.recalculatePermissionsChangeset = (async () => {
      await Promise.all([updateQueryPromise, updateRolesPromise]);
      return await recalculateThreadPermissions(request.threadID);
    })();
  }

  const {
    addMembersChangeset,
    recalculatePermissionsChangeset,
  } = await promiseAll(intermediatePromises);

  const membershipRows = [];
  const relationshipChangeset = new RelationshipChangeset();
  if (recalculatePermissionsChangeset) {
    const {
      membershipRows: recalculateMembershipRows,
      relationshipChangeset: recalculateRelationshipChangeset,
    } = recalculatePermissionsChangeset;
    membershipRows.push(...recalculateMembershipRows);
    relationshipChangeset.addAll(recalculateRelationshipChangeset);
  }
  let addedMemberIDs;
  if (addMembersChangeset) {
    const {
      membershipRows: addMembersMembershipRows,
      relationshipChangeset: addMembersRelationshipChangeset,
    } = addMembersChangeset;
    addedMemberIDs = addMembersMembershipRows
      .filter(row => row.operation === 'save' && Number(row.role) > 0)
      .map(row => row.userID);
    membershipRows.push(...addMembersMembershipRows);
    relationshipChangeset.addAll(addMembersRelationshipChangeset);
  }

  const changeset = { membershipRows, relationshipChangeset };
  const { threadInfos, viewerUpdates } = await commitMembershipChangeset(
    viewer,
    changeset,
    {
      // This forces an update for this thread,
      // regardless of whether any membership rows are changed
      changedThreadIDs:
        Object.keys(sqlUpdate).length > 0
          ? new Set([request.threadID])
          : new Set(),
    },
  );

  let newMessageInfos = [];
  if (!silenceMessages) {
    const time = Date.now();
    const messageDatas = [];
    for (const fieldName in changedFields) {
      const newValue = changedFields[fieldName];
      messageDatas.push({
        type: messageTypes.CHANGE_SETTINGS,
        threadID: request.threadID,
        creatorID: viewer.userID,
        time,
        field: fieldName,
        value: newValue,
      });
    }
    if (addedMemberIDs && addedMemberIDs.length > 0) {
      messageDatas.push({
        type: messageTypes.ADD_MEMBERS,
        threadID: request.threadID,
        creatorID: viewer.userID,
        time,
        addedUserIDs: addedMemberIDs,
      });
    }
    newMessageInfos = await createMessages(viewer, messageDatas);
  }

  if (hasMinCodeVersion(viewer.platformDetails, 62)) {
    return { updatesResult: { newUpdates: viewerUpdates }, newMessageInfos };
  }

  return {
    threadInfo: threadInfos[request.threadID],
    threadInfos,
    updatesResult: {
      newUpdates: viewerUpdates,
    },
    newMessageInfos,
  };
}

async function joinThread(
  viewer: Viewer,
  request: ServerThreadJoinRequest,
): Promise<ThreadJoinResult> {
  if (!viewer.loggedIn) {
    throw new ServerError('not_logged_in');
  }

  const [isMember, hasPermission] = await Promise.all([
    fetchViewerIsMember(viewer, request.threadID),
    checkThreadPermission(
      viewer,
      request.threadID,
      threadPermissions.JOIN_THREAD,
    ),
  ]);
  if (!hasPermission) {
    throw new ServerError('invalid_parameters');
  }

  // TODO: determine code version
  const hasCodeVersionBelow87 = !hasMinCodeVersion(viewer.platformDetails, 87);
  const hasCodeVersionBelow62 = !hasMinCodeVersion(viewer.platformDetails, 62);

  const { calendarQuery } = request;
  if (isMember) {
    const response: ThreadJoinResult = {
      rawMessageInfos: [],
      truncationStatuses: {},
      userInfos: {},
      updatesResult: {
        newUpdates: [],
      },
    };
    if (calendarQuery && hasCodeVersionBelow87) {
      response.rawEntryInfos = [];
    }
    if (hasCodeVersionBelow62) {
      response.threadInfos = {};
    }
    return response;
  }

  if (calendarQuery) {
    const threadFilterIDs = filteredThreadIDs(calendarQuery.filters);
    if (
      !threadFilterIDs ||
      threadFilterIDs.size !== 1 ||
      threadFilterIDs.values().next().value !== request.threadID
    ) {
      throw new ServerError('invalid_parameters');
    }
  }

  const changeset = await changeRole(request.threadID, [viewer.userID], null);

  const membershipResult = await commitMembershipChangeset(viewer, changeset, {
    calendarQuery,
  });

  const messageData = {
    type: messageTypes.JOIN_THREAD,
    threadID: request.threadID,
    creatorID: viewer.userID,
    time: Date.now(),
  };
  const newMessages = await createMessages(viewer, [messageData]);

  const threadSelectionCriteria = {
    threadCursors: { [request.threadID]: false },
  };

  if (!hasCodeVersionBelow87) {
    return {
      rawMessageInfos: newMessages,
      truncationStatuses: {},
      userInfos: membershipResult.userInfos,
      updatesResult: {
        newUpdates: membershipResult.viewerUpdates,
      },
    };
  }

  const [fetchMessagesResult, fetchEntriesResult] = await Promise.all([
    fetchMessageInfos(viewer, threadSelectionCriteria, defaultNumberPerThread),
    calendarQuery ? fetchEntryInfos(viewer, [calendarQuery]) : undefined,
  ]);
  const rawEntryInfos = fetchEntriesResult && fetchEntriesResult.rawEntryInfos;
  const response: ThreadJoinResult = {
    rawMessageInfos: fetchMessagesResult.rawMessageInfos,
    truncationStatuses: fetchMessagesResult.truncationStatuses,
    userInfos: membershipResult.userInfos,
    updatesResult: {
      newUpdates: membershipResult.viewerUpdates,
    },
  };
  if (hasCodeVersionBelow62) {
    response.threadInfos = membershipResult.threadInfos;
  }
  if (rawEntryInfos) {
    response.rawEntryInfos = rawEntryInfos;
  }
  return response;
}

async function updateThreadMembers(viewer: Viewer) {
  const { threadInfos } = await fetchThreadInfos(
    viewer,
    SQL`t.parent_thread_id IS NOT NULL `,
  );

  const updateDatas = [];
  const time = Date.now();
  for (const threadID in threadInfos) {
    updateDatas.push({
      type: updateTypes.UPDATE_THREAD,
      userID: viewer.id,
      time,
      threadID: threadID,
      targetSession: viewer.session,
    });
  }

  await createUpdates(updateDatas);
}

export {
  updateRole,
  removeMembers,
  leaveThread,
  updateThread,
  joinThread,
  updateThreadMembers,
};
