// @flow

import invariant from 'invariant';
import * as React from 'react';

import { searchUsers as searchUserCall } from 'lib/actions/user-actions';
import {
  type ChatThreadItem,
  useFlattenedChatListData,
} from 'lib/selectors/chat-selectors';
import { threadSearchIndex as threadSearchIndexSelector } from 'lib/selectors/nav-selectors';
import { threadInfoSelector } from 'lib/selectors/thread-selectors';
import { usersWithPersonalThreadSelector } from 'lib/selectors/user-selectors';
import {
  threadInBackgroundChatList,
  threadInHomeChatList,
  threadInChatList,
  filterChatThreadList,
} from 'lib/shared/thread-utils';
import { threadTypes } from 'lib/types/thread-types';
import { useServerCall } from 'lib/utils/action-utils';

import { useSelector } from '../redux/redux-utils';
import {
  useChatThreadItem,
  activeChatThreadItem as activeChatThreadItemSelector,
} from '../selectors/chat-selectors';

type ChatTabType = 'Focus' | 'Background';
type ThreadListContextType = {
  +activeTab: ChatTabType,
  +setActiveTab: (newActiveTab: ChatTabType) => void,
  +threadList: $ReadOnlyArray<ChatThreadItem>,
  +searchText: string,
  +setSearchText: (searchText: string) => void,
};

const ThreadListContext: React.Context<?ThreadListContextType> = React.createContext<?ThreadListContextType>();

type ThreadListProviderProps = {
  +children: React.Node,
};
function ThreadListProvider(props: ThreadListProviderProps): React.Node {
  const [activeTab, setActiveTab] = React.useState('Focus');

  const isBackground = activeTab === 'Background';
  const activeChatThreadItem = useSelector(activeChatThreadItemSelector);
  const activeThreadInfo = activeChatThreadItem?.threadInfo;
  const activeThreadID = activeThreadInfo?.id;
  const viewerID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );
  const threadSearchIndex = useSelector(threadSearchIndexSelector);
  const callSearchUsers = useServerCall(searchUserCall);
  const usersWithPersonalThread = useSelector(usersWithPersonalThreadSelector);

  const [searchText, setSearchText] = React.useState('');
  const [threadSearchResults, setThreadSearchResults] = React.useState(
    new Set(),
  );
  const [usersSearchResults, setUsersSearchResults] = React.useState([]);

  const activeSidebarParentThreadInfo = useSelector(state => {
    if (!activeThreadInfo || activeThreadInfo.type !== threadTypes.SIDEBAR) {
      return null;
    }
    const { parentThreadID } = activeThreadInfo;
    invariant(parentThreadID, 'sidebar must have parent thread');
    return threadInfoSelector(state)[parentThreadID];
  });
  const activeTopLevelThreadInfo =
    activeThreadInfo?.type === threadTypes.SIDEBAR
      ? activeSidebarParentThreadInfo
      : activeThreadInfo;

  const activeTopLevelThreadIsFromHomeTab =
    activeTopLevelThreadInfo?.currentUser.subscription.home;

  const activeTopLevelThreadIsFromDifferentTab =
    (activeTab === 'Focus' && activeTopLevelThreadIsFromHomeTab) ||
    (activeTab === 'Background' && !activeTopLevelThreadIsFromHomeTab);

  const activeTopLevelThreadIsInChatList = React.useMemo(
    () => threadInChatList(activeTopLevelThreadInfo),
    [activeTopLevelThreadInfo],
  );

  const shouldChangeTab =
    activeTopLevelThreadIsInChatList && activeTopLevelThreadIsFromDifferentTab;

  const prevActiveThreadIDRef = React.useRef<?string>();
  React.useEffect(() => {
    const prevActiveThreadID = prevActiveThreadIDRef.current;
    prevActiveThreadIDRef.current = activeThreadID;
    if (activeThreadID !== prevActiveThreadID && shouldChangeTab) {
      setActiveTab(activeTopLevelThreadIsFromHomeTab ? 'Focus' : 'Background');
    }
  }, [activeThreadID, shouldChangeTab, activeTopLevelThreadIsFromHomeTab]);

  const activeThreadOriginalTab = React.useMemo(() => {
    if (activeTopLevelThreadIsInChatList) {
      return null;
    }
    return activeTab;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopLevelThreadIsInChatList, activeThreadID]);

  const makeSureActiveSidebarIsIncluded = React.useCallback(
    (threadListData: $ReadOnlyArray<ChatThreadItem>) => {
      if (
        !activeChatThreadItem ||
        activeChatThreadItem.threadInfo.type !== threadTypes.SIDEBAR
      ) {
        return threadListData;
      }

      const sidebarParentIndex = threadListData.findIndex(
        thread =>
          thread.threadInfo.id ===
          activeChatThreadItem.threadInfo.parentThreadID,
      );
      if (sidebarParentIndex === -1) {
        return threadListData;
      }
      const parentItem = threadListData[sidebarParentIndex];

      for (const sidebarItem of parentItem.sidebars) {
        if (sidebarItem.type !== 'sidebar') {
          continue;
        } else if (
          sidebarItem.threadInfo.id === activeChatThreadItem.threadInfo.id
        ) {
          return threadListData;
        }
      }

      let indexToInsert = parentItem.sidebars.findIndex(
        sidebar =>
          sidebar.lastUpdatedTime === undefined ||
          sidebar.lastUpdatedTime < activeChatThreadItem.lastUpdatedTime,
      );
      if (indexToInsert === -1) {
        indexToInsert = parentItem.sidebars.length;
      }
      const activeSidebar = {
        type: 'sidebar',
        lastUpdatedTime: activeChatThreadItem.lastUpdatedTime,
        mostRecentNonLocalMessage:
          activeChatThreadItem.mostRecentNonLocalMessage,
        threadInfo: activeChatThreadItem.threadInfo,
      };
      const newSidebarItems = [...parentItem.sidebars];
      newSidebarItems.splice(indexToInsert, 0, activeSidebar);

      const newThreadListData = [...threadListData];
      newThreadListData[sidebarParentIndex] = {
        ...parentItem,
        sidebars: newSidebarItems,
      };
      return newThreadListData;
    },
    [activeChatThreadItem],
  );

  const chatListData = useFlattenedChatListData();
  const activeTopLevelChatThreadItem = useChatThreadItem(
    activeTopLevelThreadInfo,
  );

  const searchUsers = React.useCallback(
    async (usernamePrefix: string) => {
      if (usernamePrefix.length === 0) {
        return [];
      }

      const { userInfos } = await callSearchUsers(usernamePrefix);
      return userInfos.filter(
        info => !usersWithPersonalThread.has(info.id) && info.id !== viewerID,
      );
    },
    [callSearchUsers, usersWithPersonalThread, viewerID],
  );

  React.useEffect(() => {
    (async () => {
      const results = threadSearchIndex.getSearchResults(searchText);
      setThreadSearchResults(new Set(results));
      setUsersSearchResults(await searchUsers(searchText));
    })();
  }, [searchText, chatListData, threadSearchIndex, searchUsers]);

  const threadFilter = React.useMemo(
    () => (isBackground ? threadInBackgroundChatList : threadInHomeChatList),
    [isBackground],
  );

  const chatListDataWithoutFilter = filterChatThreadList(
    chatListData,
    searchText,
    threadFilter,
    threadSearchResults,
    usersSearchResults,
    viewerID,
  );
  const threadList = React.useMemo(() => {
    let threadListWithTopLevelItem = chatListDataWithoutFilter;

    if (activeTopLevelChatThreadItem && !activeTopLevelThreadIsInChatList) {
      if (activeThreadOriginalTab === activeTab) {
        threadListWithTopLevelItem = [
          activeTopLevelChatThreadItem,
          ...threadListWithTopLevelItem,
        ];
      }
    }
    return makeSureActiveSidebarIsIncluded(threadListWithTopLevelItem);
  }, [
    activeTab,
    activeThreadOriginalTab,
    activeTopLevelChatThreadItem,
    activeTopLevelThreadIsInChatList,
    chatListDataWithoutFilter,
    makeSureActiveSidebarIsIncluded,
  ]);
  const threadListContext = React.useMemo(
    () => ({
      activeTab,
      threadList,
      setActiveTab,
      searchText,
      setSearchText,
    }),
    [activeTab, threadList, searchText],
  );
  return (
    <ThreadListContext.Provider value={threadListContext}>
      {props.children}
    </ThreadListContext.Provider>
  );
}

export { ThreadListProvider, ThreadListContext };
