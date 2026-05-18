import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';

if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    // When the SW activates for the first time, reload once so it
    // takes control and caches all assets for offline use.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_ACTIVATED' && !sessionStorage.getItem('sw_primed')) {
        sessionStorage.setItem('sw_primed', '1');
        window.location.reload();
      }
    });
  });
}
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator, { navigationRef } from './src/navigation';
import { fetchAssessmentByInstance, initAuth, completeAssessment, setSnInstance } from './src/services/assessmentService';
import { assessmentStore } from './src/store/assessmentStore';

/**
 * Parses a rtgaudit:// deep link URL.
 * rtgaudit://assessment?instance_sys_id=abc123
 * Returns { path, params } or null if unrecognized.
 */
function parseDeepLink(url) {
  if (!url) return null;
  try {
    // Strip the scheme
    const withoutScheme = url.replace(/^rtgaudit:\/\//, '');
    const [path, queryString] = withoutScheme.split('?');
    const params = {};
    if (queryString) {
      queryString.split('&').forEach(pair => {
        const [key, val] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
      });
    }
    return { path, params };
  } catch {
    return null;
  }
}

/**
 * Routes a parsed deep link to the correct screen.
 * Waits until navigation is ready before calling navigate.
 */
function handleDeepLink(url) {
  const parsed = parseDeepLink(url);
  if (!parsed) return;

  if (parsed.path === 'assessment' && parsed.params.instance_sys_id) {
    const instanceSysId = parsed.params.instance_sys_id;
    const taskSysId = parsed.params.task_sys_id || null;

    const tryNavigate = async (attempts = 0) => {
      if (!navigationRef.isReady()) {
        if (attempts < 10) setTimeout(() => tryNavigate(attempts + 1), 200);
        return;
      }
      try {
        await setSnInstance(parsed.params.sn_instance || null);
        await assessmentStore.clear();
        const payload = await fetchAssessmentByInstance(instanceSysId);
        if (taskSysId) payload.task_sys_id = taskSysId;
        await assessmentStore.set(payload, instanceSysId);
        navigationRef.navigate('SkuSelection');
      } catch (e) {
        navigateToError(e.message);
      }
    };

    tryNavigate();
  }
}

function navigateToError(message) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Error', { message });
  }
}

export default function App() {
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    // Silently fetch OAuth token on startup so it's ready before any API call
    initAuth().catch(e => navigateToError(e.message));

    // If a previous session submitted answers but failed to call /complete,
    // retry it now that we're online.
    async function retryPendingComplete() {
      try {
        const pending = await assessmentStore.loadPendingComplete();
        if (!pending?.instanceId) return;
        await completeAssessment(pending.instanceId);
        await assessmentStore.clearPendingComplete();
      } catch (_) {}
    }
    retryPendingComplete();
  }, []);

  useEffect(() => {
    // 1. Cold launch: app was not running when the link was tapped
    Linking.getInitialURL().then(url => {
      if (url && !initialUrlHandled.current) {
        initialUrlHandled.current = true;
        handleDeepLink(url);
      }
    });

    // 2. Warm launch: app is already open and a link is tapped
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#1b1b38" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}