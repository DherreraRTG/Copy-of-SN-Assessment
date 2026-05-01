import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Network from 'expo-network';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    Platform.OS === 'web' ? navigator.onLine : true
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      // expo-network cannot determine reachability in browsers — use native browser events
      const handleOnline  = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online',  handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online',  handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Native: expo-network polling
    Network.getNetworkStateAsync().then(state => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    });

    const interval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnline(prev => prev !== online ? online : prev);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return isOnline;
}
