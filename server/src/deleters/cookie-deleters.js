// @flow

import { cookieLifetime } from 'lib/types/session-types';

import invariant from 'invariant';

import {
  dbQuery,
  SQL,
  SQLStatement,
  mergeOrConditions,
} from '../database/database';

async function deleteCookiesByConditions(
  conditions: $ReadOnlyArray<SQLStatement>,
) {
  invariant(conditions.length > 0, 'no conditions specified');
  const conditionClause = mergeOrConditions(conditions);
  const query = SQL`
    DELETE c, i, s, si, u, iu, fo
    FROM cookies c
    LEFT JOIN ids i ON i.id = c.id
    LEFT JOIN sessions s ON s.cookie = c.id
    LEFT JOIN ids si ON si.id = s.id
    LEFT JOIN updates u ON u.target = c.id OR u.target = s.id
    LEFT JOIN ids iu ON iu.id = u.id
    LEFT JOIN focused fo ON fo.session = c.id OR fo.session = s.id
    WHERE
  `;
  query.append(conditionClause);
  await dbQuery(query);
}

async function deleteCookie(cookieID: string): Promise<void> {
  const condition = SQL`c.id = ${cookieID}`;
  await deleteCookiesByConditions([condition]);
}

async function deleteExpiredCookies(): Promise<void> {
  const earliestInvalidLastUpdate = Date.now() - cookieLifetime;
  const condition = SQL`c.last_used <= ${earliestInvalidLastUpdate}`;
  await deleteCookiesByConditions([condition]);
}

export { deleteCookie, deleteExpiredCookies };
