// @flow

import classNames from 'classnames';
import * as React from 'react';

import {
  useShouldShowDisconnectedBar,
  useDisconnectedBar,
} from 'lib/hooks/disconnected-bar';

import css from './disconnected-bar.css';

function DisconnectedBar(): React.Node {
  const { shouldShowDisconnectedBar } = useShouldShowDisconnectedBar();
  const [showing, setShowing] = React.useState(
    shouldShowDisconnectedBar ? true : false,
  );

  const barCause = useDisconnectedBar(setShowing);
  const isDisconnected = barCause === 'disconnected';
  const text = isDisconnected ? 'DISCONNECTED' : 'CONNECTING…';
  if (!showing) {
    return null;
  }

  const textClasses = classNames(css.barText, {
    [css.disconnected]: isDisconnected,
    [css.connecting]: !isDisconnected,
  });
  return (
    <div className={css.barContainer}>
      <div className={textClasses}>{text}</div>
    </div>
  );
}

export default DisconnectedBar;
