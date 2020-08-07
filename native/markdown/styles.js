// @flow

import type { GlobalTheme } from '../types/themes';

import { Platform } from 'react-native';

import { getStylesForTheme } from '../themes/colors';

const unboundStyles = {
  link: {
    color: 'link',
    textDecorationLine: 'underline',
  },
  italics: {
    fontStyle: 'italic',
  },
  bold: {
    fontWeight: 'bold',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
  inlineCode: {
    backgroundColor: 'codeBackground',
    fontFamily: Platform.select({
      ios: 'Menlo',
      default: 'monospace',
    }),
    fontSize: Platform.select({
      ios: 17,
      default: 18,
    }),
  },
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  h3: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  h4: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  h5: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  h6: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  blockQuote: {
    backgroundColor: 'blockQuoteBackground',
    borderLeftColor: 'blockQuoteBorder',
    borderLeftWidth: 5,
    padding: 10,
    marginBottom: 6,
    marginVertical: 6,
  },
  codeBlock: {
    backgroundColor: 'codeBackground',
    padding: 10,
    borderRadius: 5,
    marginVertical: 6,
  },
  codeBlockText: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      default: 'monospace',
    }),
    fontSize: Platform.select({
      ios: 17,
      default: 18,
    }),
  },
};

export type MarkdownStyles = typeof unboundStyles;

export function getMarkdownStyles(theme: GlobalTheme) {
  return getStylesForTheme(unboundStyles, theme);
}
