// @flow

import { createSelector } from 'reselect';

import {
  serverEntryInfo,
  serverEntryInfosObject,
  filterRawEntryInfosByCalendarQuery,
  convertRawEntryInfos,
} from '../shared/entry-utils';
import {
  convertRawThreadInfo,
  convertRawThreadInfos,
} from '../shared/thread-utils';
import threadWatcher from '../shared/thread-watcher';
import type { RawEntryInfo, CalendarQuery } from '../types/entry-types';
import type { AppState } from '../types/redux-types';
import type { ClientReportCreationRequest } from '../types/report-types';
import {
  serverRequestTypes,
  type ClientServerRequest,
  type ClientClientResponse,
} from '../types/request-types';
import type { SessionState } from '../types/session-types';
import type { OneTimeKeyGenerator } from '../types/socket-types';
import type { RawThreadInfo } from '../types/thread-types';
import type { CurrentUserInfo, UserInfos } from '../types/user-types';
import { getConfig } from '../utils/config';
import { minimumOneTimeKeysRequired } from '../utils/crypto-utils';
import { values, hash } from '../utils/objects';
import { currentCalendarQuery } from './nav-selectors';

const queuedReports: (
  state: AppState,
) => $ReadOnlyArray<ClientReportCreationRequest> = createSelector(
  (state: AppState) => state.reportStore.queuedReports,
  (
    mainQueuedReports: $ReadOnlyArray<ClientReportCreationRequest>,
  ): $ReadOnlyArray<ClientReportCreationRequest> => mainQueuedReports,
);

const getClientResponsesSelector: (
  state: AppState,
) => (
  calendarActive: boolean,
  oneTimeKeyGenerator: ?OneTimeKeyGenerator,
  serverRequests: $ReadOnlyArray<ClientServerRequest>,
) => $ReadOnlyArray<ClientClientResponse> = createSelector(
  (state: AppState) => state.threadStore.threadInfos,
  (state: AppState) => state.entryStore.entryInfos,
  (state: AppState) => state.userStore.userInfos,
  (state: AppState) => state.currentUserInfo,
  currentCalendarQuery,
  (
    threadInfos: { +[id: string]: RawThreadInfo },
    entryInfos: { +[id: string]: RawEntryInfo },
    userInfos: UserInfos,
    currentUserInfo: ?CurrentUserInfo,
    calendarQuery: (calendarActive: boolean) => CalendarQuery,
  ) => (
    calendarActive: boolean,
    oneTimeKeyGenerator: ?OneTimeKeyGenerator,
    serverRequests: $ReadOnlyArray<ClientServerRequest>,
  ): $ReadOnlyArray<ClientClientResponse> => {
    const clientResponses = [];
    const serverRequestedPlatformDetails = serverRequests.some(
      request => request.type === serverRequestTypes.PLATFORM_DETAILS,
    );
    for (const serverRequest of serverRequests) {
      if (
        serverRequest.type === serverRequestTypes.PLATFORM &&
        !serverRequestedPlatformDetails
      ) {
        clientResponses.push({
          type: serverRequestTypes.PLATFORM,
          platform: getConfig().platformDetails.platform,
        });
      } else if (serverRequest.type === serverRequestTypes.PLATFORM_DETAILS) {
        clientResponses.push({
          type: serverRequestTypes.PLATFORM_DETAILS,
          platformDetails: getConfig().platformDetails,
        });
      } else if (serverRequest.type === serverRequestTypes.CHECK_STATE) {
        const filteredEntryInfos = filterRawEntryInfosByCalendarQuery(
          serverEntryInfosObject(
            convertRawEntryInfos(values(entryInfos), 'client_to_server'),
          ),
          calendarQuery(calendarActive),
        );
        // We use server thread ID schema, when calculating the hash
        const hashResults = {};
        for (const key in serverRequest.hashesToCheck) {
          const expectedHashValue = serverRequest.hashesToCheck[key];
          let hashValue;
          if (key === 'threadInfos') {
            hashValue = hash(
              convertRawThreadInfos(threadInfos, 'client_to_server'),
            );
          } else if (key === 'entryInfos') {
            hashValue = hash(filteredEntryInfos);
          } else if (key === 'userInfos') {
            hashValue = hash(userInfos);
          } else if (key === 'currentUserInfo') {
            hashValue = hash(currentUserInfo);
          } else if (key.startsWith('threadInfo|')) {
            const threadID = key.split('|').slice(-1)[0];
            hashValue = hash(
              threadInfos[threadID]
                ? convertRawThreadInfo(
                    threadInfos[threadID],
                    'client_to_server',
                  )
                : threadInfos[threadID],
            );
          } else if (key.startsWith('entryInfo|')) {
            const [, entryID] = key.split('|');
            let rawEntryInfo = filteredEntryInfos[entryID];
            if (rawEntryInfo) {
              rawEntryInfo = serverEntryInfo(rawEntryInfo);
            }
            hashValue = hash(rawEntryInfo);
          } else if (key.startsWith('userInfo|')) {
            const [, userID] = key.split('|');
            hashValue = hash(userInfos[userID]);
          } else {
            continue;
          }
          hashResults[key] = expectedHashValue === hashValue;
        }

        const { failUnmentioned } = serverRequest;
        if (failUnmentioned && failUnmentioned.threadInfos) {
          for (const threadID in threadInfos) {
            const key = `threadInfo|${threadID}`;
            const hashResult = hashResults[key];
            if (hashResult === null || hashResult === undefined) {
              hashResults[key] = false;
            }
          }
        }
        if (failUnmentioned && failUnmentioned.entryInfos) {
          for (const entryID in filteredEntryInfos) {
            const key = `entryInfo|${entryID}`;
            const hashResult = hashResults[key];
            if (hashResult === null || hashResult === undefined) {
              hashResults[key] = false;
            }
          }
        }
        if (failUnmentioned && failUnmentioned.userInfos) {
          for (const userID in userInfos) {
            const key = `userInfo|${userID}`;
            const hashResult = hashResults[key];
            if (hashResult === null || hashResult === undefined) {
              hashResults[key] = false;
            }
          }
        }

        clientResponses.push({
          type: serverRequestTypes.CHECK_STATE,
          hashResults,
        });
      } else if (
        serverRequest.type === serverRequestTypes.MORE_ONE_TIME_KEYS &&
        oneTimeKeyGenerator
      ) {
        const keys: string[] = [];
        for (let i = 0; i < minimumOneTimeKeysRequired; ++i) {
          keys.push(oneTimeKeyGenerator(i));
        }
        clientResponses.push({
          type: serverRequestTypes.MORE_ONE_TIME_KEYS,
          keys,
        });
      }
    }
    return clientResponses;
  },
);

const sessionStateFuncSelector: (
  state: AppState,
) => (calendarActive: boolean) => SessionState = createSelector(
  (state: AppState) => state.messageStore.currentAsOf,
  (state: AppState) => state.updatesCurrentAsOf,
  currentCalendarQuery,
  (
    messagesCurrentAsOf: number,
    updatesCurrentAsOf: number,
    calendarQuery: (calendarActive: boolean) => CalendarQuery,
  ) => (calendarActive: boolean): SessionState => ({
    calendarQuery: calendarQuery(calendarActive),
    messagesCurrentAsOf,
    updatesCurrentAsOf,
    watchedIDs: threadWatcher.getWatchedIDs(),
  }),
);

export { queuedReports, getClientResponsesSelector, sessionStateFuncSelector };
