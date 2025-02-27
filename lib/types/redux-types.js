// @flow

import type { Shape } from '../types/core';
import type {
  LogOutResult,
  LogInStartingPayload,
  LogInResult,
  RegisterResult,
  DefaultNotificationPayload,
} from './account-types';
import type {
  ActivityUpdateSuccessPayload,
  QueueActivityUpdatesPayload,
  SetThreadUnreadStatusPayload,
} from './activity-types';
import type { EnabledApps, SupportedApps } from './enabled-apps';
import type {
  RawEntryInfo,
  EntryStore,
  SaveEntryPayload,
  CreateEntryPayload,
  DeleteEntryResult,
  RestoreEntryPayload,
  FetchEntryInfosResult,
  CalendarQueryUpdateResult,
  CalendarQueryUpdateStartingPayload,
} from './entry-types';
import type {
  CalendarFilter,
  CalendarThreadFilter,
  SetCalendarDeletedFilterPayload,
} from './filter-types';
import type { LifecycleState } from './lifecycle-state-types';
import type { LoadingStatus, LoadingInfo } from './loading-types';
import type { UpdateMultimediaMessageMediaPayload } from './media-types';
import type {
  MessageStore,
  RawMultimediaMessageInfo,
  FetchMessageInfosPayload,
  SendMessagePayload,
  SaveMessagesPayload,
  NewMessagesPayload,
  MessageStorePrunePayload,
  LocallyComposedMessageInfo,
  ClientDBMessageInfo,
} from './message-types';
import type { RawTextMessageInfo } from './messages/text';
import type { BaseNavInfo } from './nav-types';
import type { RelationshipErrors } from './relationship-types';
import type {
  EnabledReports,
  ClearDeliveredReportsPayload,
  QueueReportsPayload,
  ReportStore,
} from './report-types';
import type { ProcessServerRequestsPayload } from './request-types';
import type { UserSearchResult } from './search-types';
import type { SetSessionPayload } from './session-types';
import type {
  ConnectionInfo,
  StateSyncFullActionPayload,
  StateSyncIncrementalActionPayload,
  UpdateConnectionStatusPayload,
  SetLateResponsePayload,
  UpdateDisconnectedBarPayload,
} from './socket-types';
import type { SubscriptionUpdateResult } from './subscription-types';
import type {
  ThreadStore,
  ChangeThreadSettingsPayload,
  LeaveThreadPayload,
  NewThreadResult,
  ThreadJoinPayload,
} from './thread-types';
import type { ClientUpdatesResultWithUserInfos } from './update-types';
import type { CurrentUserInfo, UserStore } from './user-types';

export type BaseAppState<NavInfo: BaseNavInfo> = {
  navInfo: NavInfo,
  currentUserInfo: ?CurrentUserInfo,
  entryStore: EntryStore,
  threadStore: ThreadStore,
  userStore: UserStore,
  messageStore: MessageStore,
  updatesCurrentAsOf: number, // millisecond timestamp
  loadingStatuses: { [key: string]: { [idx: number]: LoadingStatus } },
  calendarFilters: $ReadOnlyArray<CalendarFilter>,
  urlPrefix: string,
  connection: ConnectionInfo,
  watchedThreadIDs: $ReadOnlyArray<string>,
  lifecycleState: LifecycleState,
  enabledApps: EnabledApps,
  reportStore: ReportStore,
  nextLocalID: number,
  dataLoaded: boolean,
  ...
};

// Web JS runtime doesn't have access to the cookie for security reasons.
// Native JS doesn't have a sessionID because the cookieID is used instead.
// Web JS doesn't have a device token because it's not a device...
export type NativeAppState = BaseAppState<*> & {
  sessionID?: void,
  deviceToken: ?string,
  cookie: ?string,
  ...
};
export type WebAppState = BaseAppState<*> & {
  sessionID: ?string,
  deviceToken?: void,
  cookie?: void,
  ...
};
export type AppState = NativeAppState | WebAppState;

export type BaseAction =
  | {
      +type: '@@redux/INIT',
      +payload?: void,
    }
  | {
      +type: 'FETCH_ENTRIES_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_ENTRIES_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_ENTRIES_SUCCESS',
      +payload: FetchEntryInfosResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LOG_OUT_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LOG_OUT_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LOG_OUT_SUCCESS',
      +payload: LogOutResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_ACCOUNT_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_ACCOUNT_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_ACCOUNT_SUCCESS',
      +payload: LogOutResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CREATE_LOCAL_ENTRY',
      +payload: RawEntryInfo,
    }
  | {
      +type: 'CREATE_ENTRY_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CREATE_ENTRY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CREATE_ENTRY_SUCCESS',
      +payload: CreateEntryPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SAVE_ENTRY_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SAVE_ENTRY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SAVE_ENTRY_SUCCESS',
      +payload: SaveEntryPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CONCURRENT_MODIFICATION_RESET',
      +payload: {
        +id: string,
        +dbText: string,
      },
    }
  | {
      +type: 'DELETE_ENTRY_STARTED',
      +loadingInfo: LoadingInfo,
      +payload: {
        +localID: ?string,
        +serverID: ?string,
      },
    }
  | {
      +type: 'DELETE_ENTRY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_ENTRY_SUCCESS',
      +payload: ?DeleteEntryResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LOG_IN_STARTED',
      +loadingInfo: LoadingInfo,
      +payload: LogInStartingPayload,
    }
  | {
      +type: 'LOG_IN_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LOG_IN_SUCCESS',
      +payload: LogInResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REGISTER_STARTED',
      +loadingInfo: LoadingInfo,
      +payload: LogInStartingPayload,
    }
  | {
      +type: 'REGISTER_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REGISTER_SUCCESS',
      +payload: RegisterResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_USER_PASSWORD_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_USER_PASSWORD_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_USER_PASSWORD_SUCCESS',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_THREAD_SETTINGS_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_THREAD_SETTINGS_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_THREAD_SETTINGS_SUCCESS',
      +payload: ChangeThreadSettingsPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_THREAD_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_THREAD_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'DELETE_THREAD_SUCCESS',
      +payload: LeaveThreadPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'NEW_THREAD_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'NEW_THREAD_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'NEW_THREAD_SUCCESS',
      +payload: NewThreadResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REMOVE_USERS_FROM_THREAD_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REMOVE_USERS_FROM_THREAD_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REMOVE_USERS_FROM_THREAD_SUCCESS',
      +payload: ChangeThreadSettingsPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_THREAD_MEMBER_ROLES_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_THREAD_MEMBER_ROLES_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'CHANGE_THREAD_MEMBER_ROLES_SUCCESS',
      +payload: ChangeThreadSettingsPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_REVISIONS_FOR_ENTRY_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_REVISIONS_FOR_ENTRY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_REVISIONS_FOR_ENTRY_SUCCESS',
      +payload: {
        +entryID: string,
        +text: string,
        +deleted: boolean,
      },
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'RESTORE_ENTRY_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'RESTORE_ENTRY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'RESTORE_ENTRY_SUCCESS',
      +payload: RestoreEntryPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'JOIN_THREAD_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'JOIN_THREAD_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'JOIN_THREAD_SUCCESS',
      +payload: ThreadJoinPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LEAVE_THREAD_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LEAVE_THREAD_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'LEAVE_THREAD_SUCCESS',
      +payload: LeaveThreadPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_NEW_SESSION',
      +payload: SetSessionPayload,
    }
  | {
      +type: 'persist/REHYDRATE',
      +payload: ?BaseAppState<*>,
    }
  | {
      +type: 'FETCH_MESSAGES_BEFORE_CURSOR_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_MESSAGES_BEFORE_CURSOR_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_MESSAGES_BEFORE_CURSOR_SUCCESS',
      +payload: FetchMessageInfosPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_MOST_RECENT_MESSAGES_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_MOST_RECENT_MESSAGES_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FETCH_MOST_RECENT_MESSAGES_SUCCESS',
      +payload: FetchMessageInfosPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_TEXT_MESSAGE_STARTED',
      +loadingInfo?: LoadingInfo,
      +payload: RawTextMessageInfo,
    }
  | {
      +type: 'SEND_TEXT_MESSAGE_FAILED',
      +error: true,
      +payload: Error & {
        +localID: string,
        +threadID: string,
      },
      +loadingInfo?: LoadingInfo,
    }
  | {
      +type: 'SEND_TEXT_MESSAGE_SUCCESS',
      +payload: SendMessagePayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_MULTIMEDIA_MESSAGE_STARTED',
      +loadingInfo?: LoadingInfo,
      +payload: RawMultimediaMessageInfo,
    }
  | {
      +type: 'SEND_MULTIMEDIA_MESSAGE_FAILED',
      +error: true,
      +payload: Error & {
        +localID: string,
        +threadID: string,
      },
      +loadingInfo?: LoadingInfo,
    }
  | {
      +type: 'SEND_MULTIMEDIA_MESSAGE_SUCCESS',
      +payload: SendMessagePayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEARCH_USERS_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEARCH_USERS_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEARCH_USERS_SUCCESS',
      +payload: UserSearchResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SAVE_DRAFT',
      +payload: {
        +key: string,
        +draft: string,
      },
    }
  | {
      +type: 'UPDATE_ACTIVITY_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_ACTIVITY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_ACTIVITY_SUCCESS',
      +payload: ActivityUpdateSuccessPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_DEVICE_TOKEN_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_DEVICE_TOKEN_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_DEVICE_TOKEN_SUCCESS',
      +payload: string,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_REPORT_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_REPORT_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_REPORT_SUCCESS',
      +payload?: ClearDeliveredReportsPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_REPORTS_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_REPORTS_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SEND_REPORTS_SUCCESS',
      +payload?: ClearDeliveredReportsPayload,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'QUEUE_REPORTS',
      +payload: QueueReportsPayload,
    }
  | {
      +type: 'SET_URL_PREFIX',
      +payload: string,
    }
  | {
      +type: 'SAVE_MESSAGES',
      +payload: SaveMessagesPayload,
    }
  | {
      +type: 'UPDATE_CALENDAR_THREAD_FILTER',
      +payload: CalendarThreadFilter,
    }
  | {
      +type: 'CLEAR_CALENDAR_THREAD_FILTER',
      +payload?: void,
    }
  | {
      +type: 'SET_CALENDAR_DELETED_FILTER',
      +payload: SetCalendarDeletedFilterPayload,
    }
  | {
      +type: 'UPDATE_SUBSCRIPTION_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_SUBSCRIPTION_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_SUBSCRIPTION_SUCCESS',
      +payload: SubscriptionUpdateResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_CALENDAR_QUERY_STARTED',
      +loadingInfo: LoadingInfo,
      +payload?: CalendarQueryUpdateStartingPayload,
    }
  | {
      +type: 'UPDATE_CALENDAR_QUERY_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_CALENDAR_QUERY_SUCCESS',
      +payload: CalendarQueryUpdateResult,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'FULL_STATE_SYNC',
      +payload: StateSyncFullActionPayload,
    }
  | {
      +type: 'INCREMENTAL_STATE_SYNC',
      +payload: StateSyncIncrementalActionPayload,
    }
  | {
      +type: 'PROCESS_SERVER_REQUESTS',
      +payload: ProcessServerRequestsPayload,
    }
  | {
      +type: 'UPDATE_CONNECTION_STATUS',
      +payload: UpdateConnectionStatusPayload,
    }
  | {
      +type: 'QUEUE_ACTIVITY_UPDATES',
      +payload: QueueActivityUpdatesPayload,
    }
  | {
      +type: 'UNSUPERVISED_BACKGROUND',
      +payload?: void,
    }
  | {
      +type: 'UPDATE_LIFECYCLE_STATE',
      +payload: LifecycleState,
    }
  | {
      +type: 'ENABLE_APP',
      +payload: SupportedApps,
    }
  | {
      +type: 'DISABLE_APP',
      +payload: SupportedApps,
    }
  | {
      +type: 'UPDATE_REPORTS_ENABLED',
      +payload: Shape<EnabledReports>,
    }
  | {
      +type: 'PROCESS_UPDATES',
      +payload: ClientUpdatesResultWithUserInfos,
    }
  | {
      +type: 'PROCESS_MESSAGES',
      +payload: NewMessagesPayload,
    }
  | {
      +type: 'MESSAGE_STORE_PRUNE',
      +payload: MessageStorePrunePayload,
    }
  | {
      +type: 'SET_MESSAGE_STORE_MESSAGES',
      +payload: $ReadOnlyArray<ClientDBMessageInfo>,
    }
  | {
      +type: 'SET_LATE_RESPONSE',
      +payload: SetLateResponsePayload,
    }
  | {
      +type: 'UPDATE_DISCONNECTED_BAR',
      +payload: UpdateDisconnectedBarPayload,
    }
  | {
      +type: 'REQUEST_ACCESS_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REQUEST_ACCESS_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'REQUEST_ACCESS_SUCCESS',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_MULTIMEDIA_MESSAGE_MEDIA',
      +payload: UpdateMultimediaMessageMediaPayload,
    }
  | {
      +type: 'CREATE_LOCAL_MESSAGE',
      +payload: LocallyComposedMessageInfo,
    }
  | {
      +type: 'UPDATE_RELATIONSHIPS_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_RELATIONSHIPS_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'UPDATE_RELATIONSHIPS_SUCCESS',
      +payload: RelationshipErrors,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_THREAD_UNREAD_STATUS_STARTED',
      +payload: {
        +threadID: string,
        +unread: boolean,
      },
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_THREAD_UNREAD_STATUS_FAILED',
      +error: true,
      +payload: Error,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_THREAD_UNREAD_STATUS_SUCCESS',
      +payload: SetThreadUnreadStatusPayload,
    }
  | {
      +type: 'SET_THREAD_STORE',
      +payload: ThreadStore,
    }
  | {
      +type: 'SET_USER_SETTINGS_STARTED',
      +payload?: void,
      +loadingInfo: LoadingInfo,
    }
  | {
      +type: 'SET_USER_SETTINGS_SUCCESS',
      +payload: DefaultNotificationPayload,
    }
  | {
      +type: 'SET_USER_SETTINGS_FAILED',
      +payload: Error,
      +loadingInfo: LoadingInfo,
    };

export type ActionPayload = ?(Object | Array<*> | $ReadOnlyArray<*> | string);
export type SuperAction = {
  type: string,
  payload?: ActionPayload,
  loadingInfo?: LoadingInfo,
  error?: boolean,
};
type ThunkedAction = (dispatch: Dispatch) => void;
export type PromisedAction = (dispatch: Dispatch) => Promise<void>;
export type Dispatch = ((promisedAction: PromisedAction) => Promise<void>) &
  ((thunkedAction: ThunkedAction) => void) &
  ((action: SuperAction) => boolean);

// This is lifted from redux-persist/lib/constants.js
// I don't want to add redux-persist to the web/server bundles...
// import { REHYDRATE } from 'redux-persist';
export const rehydrateActionType = 'persist/REHYDRATE';
