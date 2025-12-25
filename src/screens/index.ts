export { HomeScreen } from './HomeScreen';
export { DeviceScreen } from './DeviceScreen';
export { SettingsScreen } from './SettingsScreen';
export { TerminalScreen } from './TerminalScreen';
export { LedTestScreen } from './LedTestScreen';
export { MiniAppScreen } from './MiniAppScreen';
export { LauncherScreen } from './LauncherScreen';
export { SimulatorScreen } from './SimulatorScreen';

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Device: undefined;
  Settings: undefined;
  Terminal: undefined;
  LedTest: undefined;
  MiniApp: undefined;
  Launcher: undefined;
  Simulator: undefined;
  AppConfig: { appIndex: number };
};

