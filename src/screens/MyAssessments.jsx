import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { fetchAssessmentByInstance } from '../services/assessmentService';
import { assessmentStore } from '../store/assessmentStore';

export default function MyAssessments({ navigation, route }) {
  const [loading, setLoading] = useState(false);
  const [resumable, setResumable] = useState(false);

  useEffect(() => {
    assessmentStore.hydrate().then(p => setResumable(!!p));
  }, []);

  // Auto-load when arriving from a URL deep link (/assessment?instance_sys_id=...&task_sys_id=...)
  useEffect(() => {
    const instanceSysId = route?.params?.instance_sys_id;
    if (!instanceSysId) return;
    loadById(instanceSysId, route?.params?.task_sys_id || null);
  }, [route?.params?.instance_sys_id]);

  async function loadById(id, taskSysId = null) {
    setLoading(true);
    try {
      await assessmentStore.clear();
      const payload = await fetchAssessmentByInstance(id);
      if (taskSysId) payload.task_sys_id = taskSysId;
      await assessmentStore.set(payload, id);
      setResumable(false);
      navigation.navigate('SkuSelection');
    } catch (e) {
      Alert.alert('Failed to Load', e.message || 'Could not reach ServiceNow. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0a2540" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>NPM Assessment</Text>
      <Text style={styles.sub}>
        Open an assessment from ServiceNow to get started.
      </Text>

      {resumable && !route?.params?.instance_sys_id && (
        <TouchableOpacity style={styles.resumeBtn} onPress={() => navigation.navigate('AssessmentPlayer')}>
          <Text style={styles.resumeBtnText}>Resume In-Progress Assessment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24, justifyContent: 'center' },
  heading: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748b', marginBottom: 28, lineHeight: 20 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#0a2540', fontWeight: '600' },
  resumeBtn: {
    borderWidth: 1, borderColor: '#0a2540', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
  },
  resumeBtnText: { color: '#0a2540', fontWeight: '700', fontSize: 15 },
});
