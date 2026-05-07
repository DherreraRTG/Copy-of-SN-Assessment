# SN Offline Assessment

Offline-capable mobile assessment app for ServiceNow. Generates APK (Android) or IPA (iOS) for MDM distribution.

## Project Structure

```
sn-assessment-expo/
├── App.jsx                         # Root — mounts nav, sync trigger, offline banner
├── app.json                        # Expo config (instance URL, scope, package name)
├── eas.json                        # EAS Build config (APK/IPA)
├── package.json
│
└── src/
    ├── db/
    │   └── index.js                # AsyncStorage CRUD (replaces IndexedDB)
    │       ├── assessments store
    │       └── response_queue store
    │
    ├── services/
    │   ├── assessmentService.js    # GET + POST to SN Scripted REST
    │   └── syncManager.js          # Background sync with retry/backoff
    │
    ├── hooks/
    │   └── useOnlineStatus.js      # Online/offline via expo-network
    │
    ├── components/
    │   └── OfflineBanner.jsx       # Top banner when offline
    │
    ├── navigation/
    │   └── index.jsx               # React Navigation stack
    │
    └── screens/
        ├── MyAssessments.jsx       # List + download assessments
        └── AssessmentPlayer.jsx    # Question renderer + submit
```

## Setup

### 1. Configure your SN instance
Edit `app.json`:
```json
"extra": {
  "snInstance": "https://roomstogodev.service-now.com",
  "apiScope": "x_rtg_npm"
}
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run locally (Expo Go)
```bash
npx expo start
```
Scan the QR code with the **Expo Go** app on your phone.

---

## Build APK for MDM (Android)

### One-time setup
```bash
npm install -g eas-cli
eas login          # create free account at expo.dev
eas build:configure
```

### Generate APK
```bash
npm run build:android
# or: eas build --platform android --profile preview
```
EAS builds in the cloud — no Android Studio needed. Download the APK from expo.dev and upload to your MDM (Intune/Jamf/Workspace ONE).

---

## Build IPA for MDM (iOS)

Requires an Apple Developer account ($99/yr).
```bash
eas build --platform ios --profile preview
```

---

## Auth Setup

Store credentials in AsyncStorage before the app makes any API calls:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';

// OAuth (preferred)
await AsyncStorage.setItem('sn_token', 'your_bearer_token');

// Basic auth (dev only)
await AsyncStorage.setItem('sn_user', 'username');
await AsyncStorage.setItem('sn_pass', 'password');
```

Consider building a Login screen that sets these on first launch.

---

## Expected SN JSON Schema (GET response)

```json
{
  "result": {
    "sys_id": "abc123",
    "title": "Q1 Vendor Assessment",
    "sections": [
      {
        "sys_id": "sec001",
        "title": "Section 1",
        "order": 1,
        "questions": [
          {
            "sys_id": "q001",
            "question_text": "Rate overall quality",
            "type": "scale",
            "scale_min": 1,
            "scale_max": 5,
            "order": 1,
            "choices": []
          },
          {
            "sys_id": "q002",
            "question_text": "Select applicable options",
            "type": "multi_choice",
            "order": 2,
            "choices": [
              { "value": "A", "label": "Option A" },
              { "value": "B", "label": "Option B" }
            ]
          }
        ]
      }
    ]
  }
}
```

## Supported question types
| type | Renders as |
|---|---|
| `scale` | Circular number buttons |
| `radio` / `choice_list` | Single-select list |
| `multi_choice` | Multi-select checkboxes |
| anything else | Free-text area |
# sn-assessment-expo
