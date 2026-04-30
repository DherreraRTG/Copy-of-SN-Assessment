import { View, Text, StyleSheet } from 'react-native';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠ Offline — answers saved locally, will sync when reconnected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center'
  }
});
