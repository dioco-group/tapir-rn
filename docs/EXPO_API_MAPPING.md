# Expo SDK → Tapir Bridge API Mapping

This document maps Expo SDK APIs to their Tapir Bridge equivalents.
We aim to mirror Expo's mature API design where possible.

---

## expo-battery

```js
// Expo SDK
import * as Battery from 'expo-battery';

await Battery.getBatteryLevelAsync();        // 0.0 - 1.0
await Battery.getBatteryStateAsync();        // UNKNOWN, UNPLUGGED, CHARGING, FULL
await Battery.isLowPowerModeEnabledAsync();  // boolean
Battery.addBatteryLevelListener(callback);
Battery.addBatteryStateListener(callback);
```

```js
// Tapir Bridge
await tapir.phone.battery.getLevel();        // 0.0 - 1.0
await tapir.phone.battery.getState();        // "unknown" | "unplugged" | "charging" | "full"
await tapir.phone.battery.isLowPowerMode();  // boolean
tapir.on('phone.battery.level', callback);
tapir.on('phone.battery.state', callback);
```

---

## @react-native-community/netinfo

```js
// NetInfo
import NetInfo from '@react-native-community/netinfo';

const state = await NetInfo.fetch();
// { type: "wifi", isConnected: true, isInternetReachable: true, details: {...} }

NetInfo.addEventListener(state => { ... });
```

```js
// Tapir Bridge
const state = await tapir.phone.network.getState();
// { type: "wifi" | "cellular" | "none", isConnected: true, isInternetReachable: true }

tapir.on('phone.network.change', callback);
```

---

## expo-location

```js
// Expo SDK
import * as Location from 'expo-location';

await Location.requestForegroundPermissionsAsync();
await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
// { coords: { latitude, longitude, altitude, accuracy, ... }, timestamp }

await Location.watchPositionAsync(options, callback);
```

```js
// Tapir Bridge
await tapir.location.requestPermission();
await tapir.location.getCurrent({ accuracy: 'high' });
// { latitude, longitude, altitude, accuracy, timestamp }

tapir.location.watch({ accuracy: 'high' }, callback);
tapir.location.stopWatch();
```

---

## expo-notifications

```js
// Expo SDK
import * as Notifications from 'expo-notifications';

await Notifications.requestPermissionsAsync();
await Notifications.scheduleNotificationAsync({
  content: { title: "Hello", body: "World" },
  trigger: null  // immediately
});

Notifications.addNotificationReceivedListener(callback);
```

```js
// Tapir Bridge
await tapir.notifications.requestPermission();
await tapir.notifications.post({ title: "Hello", body: "World" });

tapir.on('notification', callback);  // Already implemented for incoming
```

---

## expo-haptics

```js
// Expo SDK
import * as Haptics from 'expo-haptics';

await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
await Haptics.selectionAsync();
```

```js
// Tapir Bridge
await tapir.phone.haptics.impact('medium');  // light | medium | heavy
await tapir.phone.haptics.notification('success');  // success | warning | error
await tapir.phone.haptics.selection();
```

---

## expo-sharing

```js
// Expo SDK
import * as Sharing from 'expo-sharing';

const available = await Sharing.isAvailableAsync();
await Sharing.shareAsync(fileUri, { mimeType, dialogTitle, UTI });
```

```js
// Tapir Bridge
await tapir.phone.share({
  message: "Check this out!",
  url: "https://example.com",
  title: "Share via"
});
```

---

## expo-intent-launcher (Android only)

```js
// Expo SDK
import { startActivityAsync, ActivityAction } from 'expo-intent-launcher';

await startActivityAsync(ActivityAction.LOCATION_SOURCE_SETTINGS);
await startActivityAsync(ActivityAction.WIRELESS_SETTINGS);
await startActivityAsync('android.settings.BLUETOOTH_SETTINGS');
```

```js
// Tapir Bridge
await tapir.phone.openSettings('location');
await tapir.phone.openSettings('wifi');
await tapir.phone.openSettings('bluetooth');

// Or direct intent
await tapir.phone.intent({
  action: 'android.intent.action.VIEW',
  data: 'geo:37.7749,-122.4194'
});
```

---

## expo-mail-composer

```js
// Expo SDK
import * as MailComposer from 'expo-mail-composer';

const available = await MailComposer.isAvailableAsync();
await MailComposer.composeAsync({
  recipients: ['email@example.com'],
  subject: 'Hello',
  body: 'Message body',
  isHtml: false,
  attachments: []
});
```

```js
// Tapir Bridge
await tapir.phone.email({
  to: ['email@example.com'],
  cc: [],
  bcc: [],
  subject: 'Hello',
  body: 'Message body',
  isHtml: false
});
```

---

## expo-sms

```js
// Expo SDK
import * as SMS from 'expo-sms';

const available = await SMS.isAvailableAsync();
await SMS.sendSMSAsync(['1234567890'], 'Hello!');
```

```js
// Tapir Bridge
await tapir.phone.sms({
  to: ['1234567890'],
  body: 'Hello!'
});
```

---

## expo-linking

```js
// Expo SDK
import * as Linking from 'expo-linking';

await Linking.openURL('https://example.com');
await Linking.openURL('tel:+1234567890');
await Linking.openURL('sms:+1234567890');
await Linking.openURL('mailto:email@example.com');
```

```js
// Tapir Bridge
await tapir.phone.openUrl('https://example.com');
await tapir.phone.dial('+1234567890');      // Opens dialer
await tapir.phone.call('+1234567890');      // Initiates call (needs permission)
```

---

## expo-sensors (Accelerometer, Gyroscope, etc.)

```js
// Expo SDK
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';

Accelerometer.setUpdateInterval(100);
const subscription = Accelerometer.addListener(({ x, y, z }) => { ... });
subscription.remove();
```

```js
// Tapir Bridge - PHONE sensors
tapir.phone.sensors.accelerometer.subscribe(({ x, y, z }) => { ... });
tapir.phone.sensors.accelerometer.setInterval(100);
tapir.phone.sensors.accelerometer.unsubscribe();

tapir.phone.sensors.gyroscope.subscribe(callback);
tapir.phone.sensors.magnetometer.subscribe(callback);
```

```js
// Tapir Bridge - DEVICE sensors (from Tapir hardware)
tapir.device.sensors.accelerometer.subscribe(callback);
tapir.device.sensors.gyroscope.subscribe(callback);
tapir.device.sensors.magnetometer.subscribe(callback);
```

---

## expo-pedometer

```js
// Expo SDK
import { Pedometer } from 'expo-sensors';

const available = await Pedometer.isAvailableAsync();
const { steps } = await Pedometer.getStepCountAsync(startDate, endDate);
Pedometer.watchStepCount(callback);
```

```js
// Tapir Bridge
await tapir.phone.pedometer.isAvailable();
await tapir.phone.pedometer.getSteps(startDate, endDate);
tapir.phone.pedometer.watch(callback);
tapir.phone.pedometer.stopWatch();
```

---

## expo-local-authentication

```js
// Expo SDK
import * as LocalAuthentication from 'expo-local-authentication';

const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Authenticate',
  fallbackLabel: 'Use passcode'
});
// { success: true } or { success: false, error: 'user_cancel' }
```

```js
// Tapir Bridge
await tapir.phone.auth.hasHardware();
await tapir.phone.auth.isEnrolled();
const result = await tapir.phone.auth.authenticate({
  prompt: 'Authenticate to continue',
  fallbackLabel: 'Use passcode'
});
// { success: true } or { success: false, error: 'user_cancel' }
```

---

## expo-keep-awake

```js
// Expo SDK
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

await activateKeepAwakeAsync();
deactivateKeepAwake();
```

```js
// Tapir Bridge
await tapir.phone.keepAwake(true);
await tapir.phone.keepAwake(false);
```

---

## expo-media-library

```js
// Expo SDK
import * as MediaLibrary from 'expo-media-library';

await MediaLibrary.requestPermissionsAsync();
const { assets } = await MediaLibrary.getAssetsAsync({ first: 20 });
```

```js
// Tapir Bridge
await tapir.phone.media.requestPermission();
const photos = await tapir.phone.media.getPhotos({ limit: 20 });
```

---

## expo-calendar

```js
// Expo SDK
import * as Calendar from 'expo-calendar';

await Calendar.requestCalendarPermissionsAsync();
const calendars = await Calendar.getCalendarsAsync();
const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
```

```js
// Tapir Bridge
await tapir.phone.calendar.requestPermission();
const calendars = await tapir.phone.calendar.getCalendars();
const events = await tapir.phone.calendar.getEvents({
  calendarIds: [...],
  startDate: new Date(),
  endDate: new Date(Date.now() + 86400000)
});
```

---

## expo-contacts

```js
// Expo SDK
import * as Contacts from 'expo-contacts';

await Contacts.requestPermissionsAsync();
const { data } = await Contacts.getContactsAsync({
  fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers]
});
```

```js
// Tapir Bridge
await tapir.phone.contacts.requestPermission();
const contacts = await tapir.phone.contacts.getAll({
  fields: ['emails', 'phoneNumbers']
});
```

---

## Summary: Final API Structure

```
window.tapir
├── device                    # Tapir hardware
│   ├── info()
│   ├── battery
│   │   ├── getLevel()
│   │   └── getState()
│   ├── vibrate()
│   └── sensors
│       ├── accelerometer
│       ├── gyroscope
│       └── magnetometer
│
├── display
│   ├── terminal()
│   ├── clear()
│   └── write()
│
├── led
│   ├── set()
│   ├── setAll()
│   └── off()
│
├── phone                     # Host phone
│   ├── battery
│   │   ├── getLevel()
│   │   ├── getState()
│   │   └── isLowPowerMode()
│   ├── network
│   │   └── getState()
│   ├── haptics
│   │   ├── impact()
│   │   ├── notification()
│   │   └── selection()
│   ├── sensors
│   │   ├── accelerometer
│   │   ├── gyroscope
│   │   └── magnetometer
│   ├── pedometer
│   │   ├── getSteps()
│   │   └── watch()
│   ├── auth
│   │   └── authenticate()
│   ├── calendar
│   │   └── getEvents()
│   ├── contacts
│   │   └── getAll()
│   ├── media
│   │   └── getPhotos()
│   ├── keepAwake()
│   ├── share()
│   ├── email()
│   ├── sms()
│   ├── dial()
│   ├── openUrl()
│   ├── openSettings()
│   └── intent()
│
├── location
│   ├── requestPermission()
│   ├── getCurrent()
│   └── watch()
│
├── notifications
│   ├── requestPermission()
│   ├── post()
│   └── list()
│
├── ai
│   └── chat()
│
├── voice
│   ├── speak()
│   └── listen()
│
├── storage
│   ├── get()
│   ├── set()
│   ├── remove()
│   └── keys()
│
└── launcher
    ├── home()
    ├── back()
    └── getApps()
```

