// @flow

import * as React from 'react';
import { StyleSheet } from 'react-native';
import { createSelector } from 'reselect';

import { selectBackgroundIsDark } from '../navigation/nav-selectors';
import { NavContext } from '../navigation/navigation-context';
import { useSelector } from '../redux/redux-utils';
import type { AppState } from '../redux/state-types';
import type { GlobalTheme } from '../types/themes';

const light = Object.freeze({
  redButton: '#BB8888',
  greenButton: '#6EC472',
  vibrantRedButton: '#F53100',
  vibrantGreenButton: '#00C853',
  mintButton: '#44CC99',
  redText: '#AA0000',
  greenText: 'green',
  link: '#036AFF',
  markdownLink: '#000000',
  panelBackground: '#E9E9EF',
  panelBackgroundLabel: '#888888',
  panelForeground: 'white',
  panelForegroundBorder: '#CCCCCC',
  panelForegroundLabel: 'black',
  panelForegroundSecondaryLabel: '#333333',
  panelForegroundTertiaryLabel: '#888888',
  panelIosHighlightUnderlay: '#EEEEEEDD',
  panelSecondaryForeground: '#F5F5F5',
  panelSecondaryForegroundBorder: '#D1D1D6',
  modalForeground: 'white',
  modalForegroundBorder: '#CCCCCC',
  modalForegroundLabel: 'black',
  modalForegroundSecondaryLabel: '#888888',
  modalForegroundTertiaryLabel: '#AAAAAA',
  modalBackground: '#EEEEEE',
  modalBackgroundLabel: '#333333',
  modalBackgroundSecondaryLabel: '#AAAAAA',
  modalIosHighlightUnderlay: '#CCCCCCDD',
  modalSubtext: '#CCCCCC',
  modalSubtextLabel: '#555555',
  modalButton: '#BBBBBB',
  modalButtonLabel: 'black',
  modalContrastBackground: 'black',
  modalContrastForegroundLabel: 'white',
  modalContrastOpacity: 0.7,
  listForegroundLabel: 'black',
  listForegroundSecondaryLabel: '#333333',
  listForegroundTertiaryLabel: '#666666',
  listForegroundQuaternaryLabel: '#AAAAAA',
  listBackground: 'white',
  listBackgroundLabel: 'black',
  listBackgroundSecondaryLabel: '#444444',
  listBackgroundTernaryLabel: '#999999',
  listSeparator: '#EEEEEE',
  listSeparatorLabel: '#555555',
  listInputBar: '#E2E2E2',
  listInputBorder: '#AAAAAAAA',
  listInputButton: '#888888',
  listInputBackground: '#DDDDDD',
  listIosHighlightUnderlay: '#DDDDDDDD',
  listSearchBackground: '#E2E2E2',
  listSearchIcon: '#AAAAAA',
  listChatBubble: '#DDDDDDBB',
  navigationCard: '#FFFFFF',
  floatingButtonBackground: '#999999',
  floatingButtonLabel: '#EEEEEE',
  blockQuoteBackground: '#D3D3D3',
  blockQuoteBorder: '#C0C0C0',
  codeBackground: '#DCDCDC',
  disconnectedBarBackground: '#FFFFFF',

  tabBarBackground: '#F5F5F5',
  tabBarAccent: '#AE94DB',
  headerChevron: '#0A0A0A',
  navigationChevron: '#A4A4A2',
  editButton: '#A4A4A2',
});
export type Colors = $Exact<typeof light>;

const dark: Colors = Object.freeze({
  redButton: '#FF4444',
  greenButton: '#43A047',
  vibrantRedButton: '#F53100',
  vibrantGreenButton: '#00C853',
  mintButton: '#44CC99',
  redText: '#FF4444',
  greenText: '#44FF44',
  link: '#129AFF',
  markdownLink: '#FFFFFF',
  panelBackground: '#0A0A0A',
  panelBackgroundLabel: '#C7C7CC',
  panelForeground: '#1D1D1D',
  panelForegroundBorder: '#2C2C2E',
  panelForegroundLabel: 'white',
  panelForegroundSecondaryLabel: '#CCCCCC',
  panelForegroundTertiaryLabel: '#AAAAAA',
  panelIosHighlightUnderlay: '#313035',
  panelSecondaryForeground: '#333333',
  panelSecondaryForegroundBorder: '#666666',
  modalForeground: '#1C1C1E',
  modalForegroundBorder: '#1C1C1E',
  modalForegroundLabel: 'white',
  modalForegroundSecondaryLabel: '#AAAAAA',
  modalForegroundTertiaryLabel: '#666666',
  modalBackground: '#0A0A0A',
  modalBackgroundLabel: '#CCCCCC',
  modalBackgroundSecondaryLabel: '#555555',
  modalIosHighlightUnderlay: '#AAAAAA88',
  modalSubtext: '#444444',
  modalSubtextLabel: '#AAAAAA',
  modalButton: '#666666',
  modalButtonLabel: 'white',
  modalContrastBackground: 'white',
  modalContrastForegroundLabel: 'black',
  modalContrastOpacity: 0.85,
  listForegroundLabel: 'white',
  listForegroundSecondaryLabel: '#CCCCCC',
  listForegroundTertiaryLabel: '#999999',
  listForegroundQuaternaryLabel: '#555555',
  listBackground: '#0A0A0A',
  listBackgroundLabel: '#C7C7CC',
  listBackgroundSecondaryLabel: '#BBBBBB',
  listBackgroundTernaryLabel: '#888888',
  listSeparator: '#3A3A3C',
  listSeparatorLabel: '#EEEEEE',
  listInputBar: '#555555',
  listInputBorder: '#333333',
  listInputButton: '#AAAAAA',
  listInputBackground: '#1D1D1D',
  listIosHighlightUnderlay: '#BBBBBB88',
  listSearchBackground: '#1D1D1D',
  listSearchIcon: '#AAAAAA',
  listChatBubble: '#26252A',
  navigationCard: '#2A2A2A',
  floatingButtonBackground: '#666666',
  floatingButtonLabel: 'white',
  blockQuoteBackground: '#A9A9A9',
  blockQuoteBorder: '#808080',
  codeBackground: '#0A0A0A',
  disconnectedBarBackground: '#1D1D1D',

  tabBarBackground: '#0A0A0A',
  tabBarAccent: '#AE94DB',
  headerChevron: '#FFFFFF',
  navigationChevron: '#5B5B5D',
  editButton: '#5B5B5D',
});
const colors = { light, dark };

const colorsSelector: (state: AppState) => Colors = createSelector(
  (state: AppState) => state.globalThemeInfo.activeTheme,
  (theme: ?GlobalTheme) => {
    const explicitTheme = theme ? theme : 'light';
    return colors[explicitTheme];
  },
);

const magicStrings = new Set();
for (const theme in colors) {
  for (const magicString in colors[theme]) {
    magicStrings.add(magicString);
  }
}

type Styles = { [name: string]: { [field: string]: mixed } };

type ReplaceField = (input: any) => any;
export type StyleSheetOf<S: Styles> = $ObjMap<S, ReplaceField>;

function stylesFromColors<IS: Styles>(
  obj: IS,
  themeColors: Colors,
): StyleSheetOf<IS> {
  const result = {};
  for (const key in obj) {
    const style = obj[key];
    const filledInStyle = { ...style };
    for (const styleKey in style) {
      const styleValue = style[styleKey];
      if (typeof styleValue !== 'string') {
        continue;
      }
      if (magicStrings.has(styleValue)) {
        const mapped = themeColors[styleValue];
        if (mapped) {
          filledInStyle[styleKey] = mapped;
        }
      }
    }
    result[key] = filledInStyle;
  }
  return StyleSheet.create(result);
}

function styleSelector<IS: Styles>(
  obj: IS,
): (state: AppState) => StyleSheetOf<IS> {
  return createSelector(colorsSelector, (themeColors: Colors) =>
    stylesFromColors(obj, themeColors),
  );
}

function useStyles<IS: Styles>(obj: IS): StyleSheetOf<IS> {
  const ourColors = useColors();
  return React.useMemo(() => stylesFromColors(obj, ourColors), [
    obj,
    ourColors,
  ]);
}

function useOverlayStyles<IS: Styles>(obj: IS): StyleSheetOf<IS> {
  const navContext = React.useContext(NavContext);
  const navigationState = navContext && navContext.state;

  const theme = useSelector(
    (state: AppState) => state.globalThemeInfo.activeTheme,
  );

  const backgroundIsDark = React.useMemo(
    () => selectBackgroundIsDark(navigationState, theme),
    [navigationState, theme],
  );
  const syntheticTheme = backgroundIsDark ? 'dark' : 'light';

  return React.useMemo(() => stylesFromColors(obj, colors[syntheticTheme]), [
    obj,
    syntheticTheme,
  ]);
}

function useColors(): Colors {
  return useSelector(colorsSelector);
}

function getStylesForTheme<IS: Styles>(
  obj: IS,
  theme: GlobalTheme,
): StyleSheetOf<IS> {
  return stylesFromColors(obj, colors[theme]);
}

export type IndicatorStyle = 'white' | 'black';
function useIndicatorStyle(): IndicatorStyle {
  const theme = useSelector(
    (state: AppState) => state.globalThemeInfo.activeTheme,
  );
  return theme && theme === 'dark' ? 'white' : 'black';
}
const indicatorStyleSelector: (
  state: AppState,
) => IndicatorStyle = createSelector(
  (state: AppState) => state.globalThemeInfo.activeTheme,
  (theme: ?GlobalTheme) => {
    return theme && theme === 'dark' ? 'white' : 'black';
  },
);

export type KeyboardAppearance = 'default' | 'light' | 'dark';
const keyboardAppearanceSelector: (
  state: AppState,
) => KeyboardAppearance = createSelector(
  (state: AppState) => state.globalThemeInfo.activeTheme,
  (theme: ?GlobalTheme) => {
    return theme && theme === 'dark' ? 'dark' : 'light';
  },
);

function useKeyboardAppearance(): KeyboardAppearance {
  return useSelector(keyboardAppearanceSelector);
}

export {
  colors,
  colorsSelector,
  styleSelector,
  useStyles,
  useOverlayStyles,
  useColors,
  getStylesForTheme,
  useIndicatorStyle,
  indicatorStyleSelector,
  useKeyboardAppearance,
};
