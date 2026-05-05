import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';

export default function SubmissionSuccess({ route, navigation }) {
  const { instanceNumber, answered, skipped, queued, submittedAt } = route.params || {};
  const [closeFailed, setCloseFailed] = useState(false);

  const time = submittedAt
    ? new Date(submittedAt).toLocaleString()
    : new Date().toLocaleString();

  function handleClose() {
    if (Platform.OS === 'web') {
      window.close();
      // If still here after 300ms, the browser blocked it
      setTimeout(() => setCloseFailed(true), 300);
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'MyAssessments' }] });
    }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={[s.iconWrap, queued && s.iconWrapQueued]}>
          <Text style={s.icon}>{queued ? '📋' : '✓'}</Text>
        </View>

        <Text style={s.heading}>
          {queued ? 'Saved for Sync' : 'Submitted Successfully'}
        </Text>

        <Text style={s.sub}>
          {queued
            ? 'No network connection. Your answers are saved locally and will sync automatically when you reconnect.'
            : 'Your assessment has been submitted to ServiceNow.'}
        </Text>

        <View style={s.divider} />

        <Row label="Submitted at" value={time} />

        <View style={s.divider} />

        {closeFailed ? (
          <Text style={s.closeHint}>You can now close this tab.</Text>
        ) : (
          <TouchableOpacity style={[s.btn, queued && s.btnQueued]} onPress={handleClose}>
            <Text style={s.btnText}>Close Window</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f5f7fa',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapQueued: { backgroundColor: '#fef9c3' },
  icon: { fontSize: 36 },
  heading: {
    fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center',
  },
  sub: {
    fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: '#e2e8f0', width: '100%', marginVertical: 20 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', paddingVertical: 5,
  },
  rowLabel: { fontSize: 13, color: '#64748b' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#0f172a', flexShrink: 1, textAlign: 'right', marginLeft: 16 },
  btn: {
    marginTop: 4, backgroundColor: '#16a34a', borderRadius: 10,
    paddingVertical: 14, width: '100%', alignItems: 'center',
  },
  btnQueued: { backgroundColor: '#ca8a04' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  closeHint: { marginTop: 4, fontSize: 14, color: '#64748b', textAlign: 'center' },
});
