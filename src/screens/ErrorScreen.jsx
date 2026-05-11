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
    flex: 1, backgroundColor: '#f2f4f7',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 4, padding: 32,
    width: '100%', maxWidth: 440, alignItems: 'center',
    borderWidth: 1, borderColor: '#d8dde6',
  },
  icon:    { fontSize: 40, marginBottom: 16 },
  title:   { fontSize: 18, fontWeight: '700', color: '#1b1b38', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13, color: '#67717e', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  detailBox: {
    backgroundColor: '#fef2f2', borderRadius: 4, padding: 12,
    width: '100%', marginBottom: 24, borderWidth: 1, borderColor: '#fecaca',
  },
  detailText: { fontSize: 11, color: '#991b1b', fontFamily: 'monospace', textAlign: 'center' },
  btn: {
    backgroundColor: '#0070d2', borderRadius: 4,
    paddingVertical: 12, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn:    { paddingVertical: 8, width: '100%', alignItems: 'center' },
  secondaryBtnText:{ color: '#67717e', fontSize: 13 },
});
