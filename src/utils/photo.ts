import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { BackendError } from '@/services/backend';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Opens the photo library or the camera and returns the original image, or null if cancelled. */
export async function pickImage(source: 'library' | 'camera'): Promise<PickedImage | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new BackendError('errors.cameraDenied');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** Crops a square region (in source pixels) and returns a 320px JPEG data URI for the avatar. */
export async function cropToAvatar(image: PickedImage, rect: { originX: number; originY: number; size: number }) {
  const size = Math.floor(Math.min(rect.size, image.width, image.height));
  const originX = Math.round(Math.min(Math.max(rect.originX, 0), image.width - size));
  const originY = Math.round(Math.min(Math.max(rect.originY, 0), image.height - size));
  const rendered = await ImageManipulator.manipulate(image.uri).crop({ originX, originY, width: size, height: size }).resize({ width: 320 }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!saved.base64) throw new Error('No image data');
  return `data:image/jpeg;base64,${saved.base64}`;
}
