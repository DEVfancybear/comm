// @flow

import t from 'tcomb';

function tBool(value: bool) {
  return t.irreducible('true', x => x === true);
}

export {
  tBool,
};
