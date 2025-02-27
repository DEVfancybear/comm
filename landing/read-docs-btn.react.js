// @flow

import * as React from 'react';

import css from './read-docs-btn.css';

function ReadDocsButton(): React.Node {
  return (
    <a
      href="https://www.notion.so/Comm-4ec7bbc1398442ce9add1d7953a6c584"
      className={css.buttonContainer}
    >
      <button className={css.button}>
        <span className={css.buttonText}>Read the documentation</span>
        <img
          src="https://dh9fld3hutpxf.cloudfront.net/corner_arrow.svg"
          className={css.cornerIcon}
        />
      </button>
    </a>
  );
}
export default ReadDocsButton;
