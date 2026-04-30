import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check once on mount
    Network.getNetworkStateAsync().then(state => {
      // isInternetReachable is null on web (browser can't determine this), treat as online
      const reachable = state.isInternetReachable ?? true;
      setIsOnline(!!(state.isConnected && reachable));
    });

    // Poll every 5 seconds — expo-network doesn't have a listener API
    const interval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      const reachable = state.isInternetReachable ?? true;
      const online = !!(state.isConnected && reachable);
      setIsOnline(prev => {
        if (prev !== online) return online;
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return isOnline;
}
