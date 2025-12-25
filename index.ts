import { registerRootComponent } from 'expo';
import { AppRegistry, Platform } from 'react-native';

import App from './App';
import { notificationHandler, NOTIFICATION_HANDLER_TASK } from './src/stores/NotificationStore';

// Register the headless task for Android notification listener
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(
    NOTIFICATION_HANDLER_TASK,
    () => notificationHandler
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
