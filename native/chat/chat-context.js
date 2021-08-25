// @flow

import invariant from 'invariant';
import * as React from 'react';

import type { ChatMessageItem } from 'lib/selectors/chat-selectors';
import type { SetState } from 'lib/types/hook-types';
import type { ThreadInfo } from 'lib/types/thread-types';

import type { ChatMessageItemWithHeight } from '../types/chat-types';

export type MessagesMeasurer = (
  $ReadOnlyArray<ChatMessageItem>,
  ?ThreadInfo,
  ($ReadOnlyArray<ChatMessageItemWithHeight>) => mixed,
) => void;

export type RegisteredMeasurer = {
  +measure: MessagesMeasurer,
  +unregister: () => void,
};

export type ChatContextType = {
  +registerMeasurer: () => RegisteredMeasurer,
  +currentTransitionSidebarSourceID: ?string,
  +setCurrentTransitionSidebarSourceID: SetState<?string>,
  +setCurrentChatInputBarHeight: (height: number) => mixed,
  +currentChatInputBarHeight: { current: number },
};
const ChatContext: React.Context<?ChatContextType> = React.createContext(null);

function useHeightMeasurer(): MessagesMeasurer {
  const chatContext = React.useContext(ChatContext);
  invariant(chatContext, 'Chat context should be set');

  const measureRegistrationRef = React.useRef();
  if (!measureRegistrationRef.current) {
    measureRegistrationRef.current = chatContext.registerMeasurer();
  }
  const measureRegistration = measureRegistrationRef.current;
  React.useEffect(() => {
    return measureRegistration.unregister;
  }, [measureRegistration]);
  return measureRegistration.measure;
}

export { ChatContext, useHeightMeasurer };
