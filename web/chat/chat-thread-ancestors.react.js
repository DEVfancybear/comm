// @flow

import classNames from 'classnames';
import * as React from 'react';

import { useAncestorThreads } from 'lib/shared/ancestor-threads';
import { memberHasAdminPowers, colorIsDark } from 'lib/shared/thread-utils';
import type { ThreadInfo } from 'lib/types/thread-types';

import { useSelector } from '../redux/redux-utils';
import SWMansionIcon from '../SWMansionIcon.react';
import css from './chat-thread-ancestors.css';

type ThreadAncestorsProps = {
  +threadInfo: ThreadInfo,
};
function ThreadAncestors(props: ThreadAncestorsProps): React.Node {
  const { threadInfo } = props;
  const { color: threadColor } = threadInfo;
  const darkColor = colorIsDark(threadColor);
  const threadColorStyle = React.useMemo(
    () => ({
      backgroundColor: `#${threadColor}`,
      color: darkColor
        ? 'var(--thread-ancestor-color-light)'
        : 'var(--thread-ancestor-color-dark)',
    }),
    [darkColor, threadColor],
  );
  const fullStructureButtonColorStyle = React.useMemo(
    () => ({ color: `#${threadColor}` }),
    [threadColor],
  );

  const ancestorThreads = useAncestorThreads(threadInfo);

  const userInfos = useSelector(state => state.userStore.userInfos);
  const community = ancestorThreads[0] ?? threadInfo;
  const keyserverOwnerUsername: ?string = React.useMemo(() => {
    for (const member of community.members) {
      if (memberHasAdminPowers(member)) {
        return userInfos[member.id].username;
      }
    }
    return undefined;
  }, [community.members, userInfos]);

  const keyserverInfo = React.useMemo(
    () => (
      <div className={css.ancestorKeyserver}>
        <div className={css.ancestorKeyserverOperator}>
          <SWMansionIcon icon="cloud" size={10} />
          <span>{keyserverOwnerUsername}</span>
        </div>
        <div
          style={threadColorStyle}
          className={classNames(css.ancestorName, css.ancestorKeyserverName)}
        >
          {community.uiName}
        </div>
      </div>
    ),
    [community.uiName, keyserverOwnerUsername, threadColorStyle],
  );

  const middlePath = React.useMemo(() => {
    if (ancestorThreads.length < 2) {
      return null;
    }
    return (
      <>
        <div className={css.ancestorSeparator}>
          <SWMansionIcon icon="chevron-right" size={10} />
        </div>
        <div style={threadColorStyle} className={css.ancestorName}>
          &hellip;
        </div>
      </>
    );
  }, [ancestorThreads.length, threadColorStyle]);

  const threadHasNoAncestors = community === threadInfo;

  const currentThread = React.useMemo(() => {
    if (threadHasNoAncestors) {
      return null;
    }
    return (
      <>
        <div className={css.ancestorSeparator}>
          <SWMansionIcon icon="chevron-right" size={10} />
        </div>
        <div style={threadColorStyle} className={css.ancestorName}>
          {threadInfo.uiName}
        </div>
      </>
    );
  }, [threadHasNoAncestors, threadColorStyle, threadInfo.uiName]);

  return (
    <>
      <div className={css.ancestorThreadsContainer}>
        {keyserverInfo}
        {middlePath}
        {currentThread}
      </div>
      <button
        style={fullStructureButtonColorStyle}
        className={css.seeFullStructure}
      >
        See full structure
      </button>
    </>
  );
}

export default ThreadAncestors;
