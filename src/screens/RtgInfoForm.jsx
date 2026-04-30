import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet
} from 'react-native';
import { getResponse } from '../db';

const FIELDS = [
  { key: 'o',           label: 'Order Number',     placeholder: 'e.g. 12345' },
  { key: 'r',           label: 'Route',             placeholder: 'e.g. RT-001' },
  { key: 's',           label: 'Stop',              placeholder: 'e.g. 1' },
  { key: 'd',           label: 'Division',          placeholder: 'e.g. Living Room' },
  { key: 'dt',          label: 'Delivery Type',     placeholder: 'e.g. Standard' },
  { key: 'dd',          label: 'Delivery Date',     placeholder: 'YYYY-MM-DD' },
  { key: 'da',          label: 'Delivery Account',  placeholder: 'e.g. ACC-001' },
  { key: 'rep',         label: 'Rep Name',          placeholder: 'Your full name' },
  { key: 'disposition', label: 'Disposition',       placeholder: '' },
];

const EMPTY_FORM = Object.fromEntries(FIELDS.map(f => [f.key, '']));

export default function RtgInfoForm({ route, navigation }) {
  const { sys_id, title } = route.params;
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    getResponse(sys_id).then(draft => {
      if (draft?.rtg_info) {
        setForm(prev => ({ ...prev, ...draft.rtg_info }));
      }
    });
  }, []);

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handleStart() {
    navigation.navigate('AssessmentPlayer', { sys_id, rtg_info: form });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.sub}>Enter audit details before starting</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {FIELDS.map(f => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              value={form[f.key]}
              onChangeText={v => set(f.key, v)}
              placeholder={f.placeholder}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleStart} style={styles.startBtn}>
          <Text style={styles.startBtnText}>Start Assessment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0a2540', padding: 16, paddingTop: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 13, color: '#94a3b8' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
    color: '#0f172a', fontSize: 14
  },
  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff'
  },
  startBtn: {
    backgroundColor: '#0a2540', borderRadius: 8, paddingVertical: 14, alignItems: 'center'
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 }
});
