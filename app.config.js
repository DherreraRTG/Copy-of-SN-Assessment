require('dotenv').config();

module.exports = {
  expo: {
    name: 'SN Assessment',
    slug: 'sn-assessment',
    version: '1.0.0',
    scheme: 'rtgaudit',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0a2540',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0a2540',
      },
      package: 'com.rtg.snassessment',
      versionCode: 1,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'rtgaudit', host: 'assessment' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.rtg.snassessment',
    },
    platforms: ['ios', 'android', 'web'],
    extra: {
      snInstance: process.env.SN_INSTANCE || 'https://roomstogodev.service-now.com',
      apiScope: 'x_rtg_npm',
      eas: {
        projectId: '44f845ff-f733-4614-a979-12397e639161',
      },
    },
    owner: 'dherrerartg',
  },
};
