// @flow

import type { Store } from 'redux';
import type { NavInfo, AppState, Action } from './redux-setup';

import invariant from 'invariant';
import { createSelector } from 'reselect';

import { partialNavInfoFromURL } from 'lib/utils/url-utils';

function urlForYearAndMonth(year: number, month: number) {
  return `year/${year}/month/${month}/`;
}

const monthURL = createSelector(
  (state: AppState) => state.navInfo,
  (navInfo: NavInfo) => urlForYearAndMonth(navInfo.year, navInfo.month),
);

function urlForHomeAndCalendarID(home: bool, calendarID: ?string) {
  if (home) {
    return "home/";
  }
  invariant(calendarID, "either home or calendarID should be set");
  return `calendar/${calendarID}/`;
}

const thisNavURLFragment = createSelector(
  (state: AppState) => state.navInfo,
  (navInfo: NavInfo) => urlForHomeAndCalendarID(
    navInfo.home,
    navInfo.calendarID
  ),
);

const thisURL = createSelector(
  monthURL,
  thisNavURLFragment,
  (monthURL: string, thisNavURLFragment: string) =>
    thisNavURLFragment + monthURL,
);

function canonicalURLFromReduxState(navInfo: NavInfo, currentURL: string) {
  const partialNavInfo = partialNavInfoFromURL(currentURL);
  let newURL = urlForHomeAndCalendarID(navInfo.home, navInfo.calendarID);
  if (partialNavInfo.year !== undefined) {
    newURL += `year/${navInfo.year}/`;
  }
  if (partialNavInfo.month !== undefined) {
    newURL += `month/${navInfo.month}/`;
  }
  if (navInfo.verify) {
    newURL += `verify/${navInfo.verify}/`;
  }
  return newURL;
}

// This function returns an "onEnter" handler for our single react-router Route.
// We use it to redirect the URL to be consistent with the initial Redux state
// determined on the server side. However, for the rest of the application URL
// changes propagate to Redux, so we turn this off after the initial run.
let urlRedirectedFromInitialReduxState = false;
function redirectURLFromInitialReduxState(store: Store<AppState, Action>) {
  return (nextState: Object, replace: Function) => {
    if (urlRedirectedFromInitialReduxState) {
      return;
    }
    urlRedirectedFromInitialReduxState = true;
    const newURL = canonicalURLFromReduxState(
      store.getState().navInfo,
      nextState.location.pathname,
    );
    if (nextState.location.pathname !== newURL) {
      replace(newURL);
    }
  };
}

// This function returns an "onChange" handler for our single react-router
// Route. Since we only have a single wildcard route, this handler will be run
// whenever the URL is changed programmatically on the client side.
function redirectURLFromAppTransition(store: Store<AppState, Action>) {
  return (prevState: Object, nextState: Object, replace: Function) => {
    const partialNavInfo = partialNavInfoFromURL(nextState.location.pathname);
    if (!partialNavInfo.home && !partialNavInfo.calendarID) {
      replace(
        thisNavURLFragment(store.getState()) + nextState.location.pathname,
      );
    }
  };
}

// Given a URL, this function parses out a navInfo object, leaving values as
// default if they are unspecified. 
function navInfoFromURL(url: string): NavInfo {
  const partialNavInfo = partialNavInfoFromURL(url);
  const today = new Date();
  return {
    year: partialNavInfo.year ? partialNavInfo.year : today.getFullYear(),
    month: partialNavInfo.month ? partialNavInfo.month : (today.getMonth() + 1),
    home: !!partialNavInfo.home,
    calendarID: partialNavInfo.calendarID ? partialNavInfo.calendarID : null,
    verify: partialNavInfo.verify ? partialNavInfo.verify : null,
  };
}

export {
  urlForYearAndMonth,
  monthURL,
  urlForHomeAndCalendarID,
  thisNavURLFragment,
  thisURL,
  canonicalURLFromReduxState,
  redirectURLFromInitialReduxState,
  redirectURLFromAppTransition,
  navInfoFromURL,
};
