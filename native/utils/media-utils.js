// @flow

import type { Dimensions, MediaType } from 'lib/types/media-types';
import type { GalleryImageInfo } from '../media/image-gallery-image.react';

import { Platform, Image } from 'react-native';
import base64 from 'base-64';
import ImageResizer from 'react-native-image-resizer';

import {
  fileInfoFromData,
  mimeTypesToMediaTypes,
} from 'lib/utils/media-utils';

type ReactNativeBlob = 
  & Blob
  & { data: { type: string, name: string, size: number } };
export type MediaValidationResult = {
  uri: string,
  dimensions: Dimensions,
  mediaType: MediaType,
  blob: ReactNativeBlob,
};
async function validateMedia(
  imageInfo: GalleryImageInfo,
): Promise<?MediaValidationResult> {
  const { uri, ...dimensions } = imageInfo;
  const response = await fetch(uri);
  const blob = await response.blob();
  const reportedMIME = blob.data.type;
  const mediaType = mimeTypesToMediaTypes[reportedMIME];
  if (!mediaType) {
    return null;
  }
  return { uri, dimensions, mediaType, blob };
}

function blobToDataURI(blob: Blob): Promise<string> {
  const fileReader = new FileReader();
  return new Promise((resolve, reject) => {
    fileReader.onerror = error => {
      fileReader.abort();
      reject(error);
    };
    fileReader.onload = event => {
      resolve(event.target.result);
    };
    fileReader.readAsDataURL(blob);
  });
}

function stringToIntArray(str: string): Uint8Array {
  const array = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i);
  }
  return array;
}

function dataURIToIntArray(dataURI: string): Uint8Array {
  let uri = dataURI;
  uri = uri.replace(/\r?\n/g, '');
  const firstComma = uri.indexOf(',');
  if (-1 === firstComma || firstComma <= 4) {
    throw new TypeError('malformed data-URI');
  }
  const meta = uri.substring(5, firstComma).split(';');

  let base64Encoded = false;
  let charset = 'US-ASCII';
  for (let i = 0; i < meta.length; i++) {
    if (meta[i] === 'base64') {
      base64Encoded = true;
    } else if (meta[i].indexOf('charset=') === 0) {
      charset = meta[i].substring(8);
    }
  }

  let data = unescape(uri.substring(firstComma + 1));
  if (base64Encoded) {
    data = base64.decode(data);
  }

  return stringToIntArray(data);
}

function getDimensions(uri: string): Promise<Dimensions> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width: number, height: number) => resolve({ height, width }),
      reject,
    );
  });
}

type MediaConversionResult = {|
  uploadURI: string,
  shouldDisposePath: ?string,
  name: string,
  mime: string,
  mediaType: MediaType,
  dimensions: Dimensions,
|};
async function convertMedia(
  validationResult: MediaValidationResult,
): Promise<?MediaConversionResult> {
  const { uri, dimensions } = validationResult;
  let { blob } = validationResult;

  const { type: reportedMIME, size } = blob.data;
  if (reportedMIME === "image/heic" || size > 500000) {
    try {
      const compressFormat = reportedMIME === "image/png" ? "PNG" : "JPEG";
      const { uri: resizedURI, path, name } =
        await ImageResizer.createResizedImage(
          uri,
          3000,
          2000,
          compressFormat,
          0.92,
        );
      const resizedDimensions = await getDimensions(resizedURI);
      return {
        uploadURI: resizedURI,
        shouldDisposePath: path,
        name,
        mime: "image/jpeg",
        mediaType: "photo",
        dimensions: resizedDimensions,
      };
    } catch (e) { }
  }

  const dataURI = await blobToDataURI(blob);
  const intArray = dataURIToIntArray(dataURI);

  const blobName = blob.data.name;
  const fileInfo = fileInfoFromData(intArray, blobName);
  if (!fileInfo) {
    return null;
  }

  const { name, mime, mediaType } = fileInfo;
  return {
    uploadURI: Platform.OS === "ios" ? dataURI : uri,
    shouldDisposePath: null,
    name,
    mime,
    mediaType,
    dimensions,
  };
}

export {
  validateMedia,
  convertMedia,
};
