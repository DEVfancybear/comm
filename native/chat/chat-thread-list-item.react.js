// @flow

import * as React from 'react';
import { Text, View } from 'react-native';

import type { ChatThreadItem } from 'lib/selectors/chat-selectors';
import type { ThreadInfo } from 'lib/types/thread-types';
import type { UserInfo } from 'lib/types/user-types';
import { shortAbsoluteDate } from 'lib/utils/date-utils';

import Button from '../components/button.react';
import ColorSplotch from '../components/color-splotch.react';
import { SingleLine } from '../components/single-line.react';
import ThreadAncestorsLabel from '../components/thread-ancestors-label.react';
import UnreadDot from '../components/unread-dot.react';
import { useColors, useStyles } from '../themes/colors';
import ChatThreadListSeeMoreSidebars from './chat-thread-list-see-more-sidebars.react';
import ChatThreadListSidebar from './chat-thread-list-sidebar.react';
import MessagePreview from './message-preview.react';
import SwipeableThread from './swipeable-thread.react';

type Props = {
  +data: ChatThreadItem,
  +onPressItem: (
    threadInfo: ThreadInfo,
    pendingPersonalThreadUserInfo?: UserInfo,
  ) => void,
  +onPressSeeMoreSidebars: (threadInfo: ThreadInfo) => void,
  +onSwipeableWillOpen: (threadInfo: ThreadInfo) => void,
  +currentlyOpenedSwipeableId: string,
};
function ChatThreadListItem({
  data,
  onPressItem,
  onPressSeeMoreSidebars,
  onSwipeableWillOpen,
  currentlyOpenedSwipeableId,
}: Props): React.Node {
  const styles = useStyles(unboundStyles);
  const colors = useColors();

  const lastMessage = React.useMemo(() => {
    const mostRecentMessageInfo = data.mostRecentMessageInfo;
    if (!mostRecentMessageInfo) {
      return (
        <Text style={styles.noMessages} numberOfLines={1}>
          No messages
        </Text>
      );
    }
    return (
      <MessagePreview
        messageInfo={mostRecentMessageInfo}
        threadInfo={data.threadInfo}
      />
    );
  }, [data.mostRecentMessageInfo, data.threadInfo, styles]);

  const sidebars = data.sidebars.map(sidebarItem => {
    if (sidebarItem.type === 'sidebar') {
      const { type, ...sidebarInfo } = sidebarItem;
      return (
        <ChatThreadListSidebar
          sidebarInfo={sidebarInfo}
          onPressItem={onPressItem}
          onSwipeableWillOpen={onSwipeableWillOpen}
          currentlyOpenedSwipeableId={currentlyOpenedSwipeableId}
          key={sidebarItem.threadInfo.id}
        />
      );
    } else if (sidebarItem.type === 'seeMore') {
      return (
        <ChatThreadListSeeMoreSidebars
          threadInfo={data.threadInfo}
          unread={sidebarItem.unread}
          showingSidebarsInline={sidebarItem.showingSidebarsInline}
          onPress={onPressSeeMoreSidebars}
          key="seeMore"
        />
      );
    } else {
      return <View style={styles.spacer} key="spacer" />;
    }
  });

  const onPress = React.useCallback(() => {
    onPressItem(data.threadInfo, data.pendingPersonalThreadUserInfo);
  }, [onPressItem, data.threadInfo, data.pendingPersonalThreadUserInfo]);

  const threadNameStyle = React.useMemo(() => {
    if (!data.threadInfo.currentUser.unread) {
      return styles.threadName;
    }
    return [styles.threadName, styles.unreadThreadName];
  }, [
    data.threadInfo.currentUser.unread,
    styles.threadName,
    styles.unreadThreadName,
  ]);

  const lastActivity = shortAbsoluteDate(data.lastUpdatedTime);
  const lastActivityStyle = React.useMemo(() => {
    if (!data.threadInfo.currentUser.unread) {
      return styles.lastActivity;
    }
    return [styles.lastActivity, styles.unreadLastActivity];
  }, [
    data.threadInfo.currentUser.unread,
    styles.lastActivity,
    styles.unreadLastActivity,
  ]);

  return (
    <>
      <SwipeableThread
        threadInfo={data.threadInfo}
        mostRecentNonLocalMessage={data.mostRecentNonLocalMessage}
        onSwipeableWillOpen={onSwipeableWillOpen}
        currentlyOpenedSwipeableId={currentlyOpenedSwipeableId}
        iconSize={24}
      >
        <Button
          onPress={onPress}
          iosFormat="highlight"
          iosHighlightUnderlayColor={colors.listIosHighlightUnderlay}
          iosActiveOpacity={0.85}
          style={styles.container}
        >
          <View style={styles.content}>
            <View style={styles.colorSplotch}>
              <UnreadDot unread={data.threadInfo.currentUser.unread} />
            </View>
            <View style={styles.colorSplotch}>
              <ColorSplotch color={data.threadInfo.color} size="profile" />
            </View>
            <View style={styles.threadDetails}>
              <ThreadAncestorsLabel threadInfo={data.threadInfo} />
              <View style={styles.row}>
                <SingleLine style={threadNameStyle}>
                  {data.threadInfo.uiName}
                </SingleLine>
              </View>
              <View style={styles.row}>
                {lastMessage}
                <Text style={lastActivityStyle}>{lastActivity}</Text>
              </View>
            </View>
          </View>
        </Button>
      </SwipeableThread>
      {sidebars}
    </>
  );
}

const chatThreadListItemHeight = 70;
const spacerHeight = 6;
const unboundStyles = {
  container: {
    height: chatThreadListItemHeight,
    justifyContent: 'center',
    backgroundColor: 'listBackground',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorSplotch: {
    marginLeft: 6,
    marginBottom: 12,
  },
  threadDetails: {
    paddingLeft: 12,
    paddingRight: 18,
    justifyContent: 'center',
    flex: 1,
    marginTop: 5,
  },
  lastActivity: {
    color: 'listForegroundTertiaryLabel',
    fontSize: 14,
    marginLeft: 10,
  },
  unreadLastActivity: {
    color: 'listForegroundLabel',
    fontWeight: 'bold',
  },
  noMessages: {
    color: 'listForegroundTertiaryLabel',
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threadName: {
    color: 'listForegroundSecondaryLabel',
    flex: 1,
    fontSize: 21,
  },
  unreadThreadName: {
    color: 'listForegroundLabel',
    fontWeight: '500',
  },
  spacer: {
    height: spacerHeight,
  },
};

export { ChatThreadListItem, chatThreadListItemHeight, spacerHeight };
