import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ERRORS = {
  auth: {
    icon: '🔐',
    title: 'Authentication Failed',
    message: "We couldn't connect to ServiceNow. This is usually a temporary issue.",
  },
  network: {
    icon: '📡',
    title: 'No Connection',
    message: 'Check your Wi-Fi or mobile data and try again.',
  },
  notfound: {
    icon: '🔍',
    title: 'Assessment Not Found',
    message: "We couldn't find this assessment. It may have been completed or removed.",
  },
  default: {
    icon: '⚠️',
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

function classify(message = '') {
  const m = message.toLowerCase();
  if (m.includes('auth') || m.includes('401') || m.includes('403') || m.includes('oauth')) return 'auth';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch') || m.includes('err_failed')) return 'network';
  if (m.includes('404') || m.includes('not found')) return 'notfound';
  return 'default';
}

export default function ErrorScreen({ route, navigation }) {
  const { message, onRetry } = route?.params || {};
  const type = classify(message);
  const { icon, title, message: friendlyMessage } = ERRORS[type];

  function handleRetry() {
    if (onRetry) {
      onRetry();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'MyAssessments' }] });
    }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.icon}>{icon}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{friendlyMessage}</Text>

        {message ? (
          <View style={s.detailBox}>
            <Text style={s.detailText}>{message}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={s.btn} onPress={handleRetry}>
          <Text style={s.btnText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MyAssessments' }] })}>
          <Text style={s.secondaryBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f5f7fa',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32,
    width: '100%', maxWidth: 440, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  icon:    { fontSize: 48, marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  detailBox: {
    backgroundColor: '#fef2f2', borderRadius: 8, padding: 12,
    width: '100%', marginBottom: 24,
  },
  detailText: { fontSize: 11, color: '#991b1b', fontFamily: 'monospace', textAlign: 'center' },
  btn: {
    backgroundColor: '#0a2540', borderRadius: 10,
    paddingVertical: 13, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn:    { paddingVertical: 8, width: '100%', alignItems: 'center' },
  secondaryBtnText:{ color: '#64748b', fontSize: 13 },
});
