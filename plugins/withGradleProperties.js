/**
 * Expo Config Plugin to add custom gradle.properties
 * Fixes MMKV namespace conflict warning
 */
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withCustomGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    // Add property to disable duplicate namespace check (MMKV workaround)
    config.modResults.push({
      type: 'property',
      key: 'android.enableDuplicateNamespaceCheck',
      value: 'false',
    });

    return config;
  });
};

