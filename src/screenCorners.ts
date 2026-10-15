import { Dimensions, Platform } from 'react-native';

// iOS doesn't expose the display's corner radius, so look it up by screen size (in points).
// Values are the published display corner radii for each iPhone screen size.
const IPHONE_RADII: Record<string, number> = {
  '375x812': 42, // iPhone X, XS, 11 Pro (39) and 12/13 mini (44)
  '414x896': 41.5, // iPhone XR, XS Max, 11, 11 Pro Max
  '390x844': 47.33, // iPhone 12, 13, 14, 16e
  '428x926': 53.33, // iPhone 12/13 Pro Max, 14 Plus
  '393x852': 55, // iPhone 14 Pro, 15, 15 Pro, 16
  '430x932': 55, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  '402x874': 62, // iPhone 16 Pro, 17, 17 Pro
  '440x956': 62, // iPhone 16 Pro Max, 17 Pro Max
};

/**
 * Corner radius of the device's display, so full-screen outlines follow the rounded corners
 * instead of being clipped. Returns 0 on the web and on iPhones with square screens.
 */
export function screenCornerRadius(bottomInset: number) {
  if (Platform.OS === 'web') return 0;
  if (Platform.OS === 'ios') {
    if (bottomInset === 0) return 0; // home-button iPhones and iPads with square corners
    const { width, height } = Dimensions.get('screen');
    const key = `${Math.round(Math.min(width, height))}x${Math.round(Math.max(width, height))}`;
    return IPHONE_RADII[key] ?? 55;
  }
  return 24; // typical rounded Android display
}
