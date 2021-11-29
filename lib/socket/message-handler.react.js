// @flow

import * as React from 'react';
import { useDispatch } from 'react-redux';

import { processMessagesActionType } from '../actions/message-actions';
import { convertNewMessagesPayload } from '../shared/message-utils';
import {
  type ClientServerSocketMessage,
  serverSocketMessageTypes,
  type SocketListener,
} from '../types/socket-types';

type Props = {
  +addListener: (listener: SocketListener) => void,
  +removeListener: (listener: SocketListener) => void,
};
export default function MessageHandler(props: Props): React.Node {
  const { addListener, removeListener } = props;

  const dispatch = useDispatch();
  const onMessage = React.useCallback(
    (message: ClientServerSocketMessage) => {
      if (message.type !== serverSocketMessageTypes.MESSAGES) {
        return;
      }
      const clientMessagePayload = convertNewMessagesPayload(
        message.payload,
        'server_to_client',
      );

      dispatch({
        type: processMessagesActionType,
        payload: clientMessagePayload,
      });
    },
    [dispatch],
  );
  React.useEffect(() => {
    addListener(onMessage);
    return () => {
      removeListener(onMessage);
    };
  }, [addListener, removeListener, onMessage]);

  return null;
}
