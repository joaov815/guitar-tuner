// Adopts the UIKit scene-based life cycle, which apps built with the iOS 27 SDK (Xcode 27)
// must use — otherwise iOS terminates the app at launch with:
//   "UIScene life cycle is required for apps built with this SDK."
//
// Expo SDK 57 ships `ExpoAppSceneDelegate` for this but its prebuild template doesn't wire it up,
// so this plugin does:
//   1. Info.plist: declare a scene manifest pointing at EXExpoAppSceneDelegate.
//   2. AppDelegate: conform to ExpoReactNativeFactoryProvider and stop creating the window /
//      starting React Native itself — the scene delegate does that when the scene connects.
// Remove this plugin once Expo's template adopts scenes on its own.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const START_REACT_NATIVE = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = mod.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return mod; // already applied

    const classDecl = 'class AppDelegate: ExpoAppDelegate {';
    if (!src.includes(classDecl) || !src.includes(START_REACT_NATIVE)) {
      throw new Error(
        'withSceneLifecycle: AppDelegate.swift does not match the expected Expo template; update the plugin.',
      );
    }
    src = src.replace(classDecl, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    src = src.replace(
      START_REACT_NATIVE,
      '    // The window and React Native are started by EXExpoAppSceneDelegate (see plugins/withSceneLifecycle.js).\n',
    );
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = (config) => withSceneAppDelegate(withSceneManifest(config));
