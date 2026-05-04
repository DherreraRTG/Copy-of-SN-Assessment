import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform
} from 'react-native';
import { assessmentStore } from '../store/assessmentStore';

function confirmAlert(title, message, onConfirm) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', style: 'default', onPress: onConfirm },
    ]);
  }
}

function extractSkus(assessment) {
  if (assessment.available_skus?.length) return assessment.available_skus;
  if (!assessment.description) return [];
  return assessment.description
    .split('\n')
    .filter(l => /^SKU:/i.test(l))
    .map((l, i) => ({
      sys_id: `sku_${i}`,
      label: l.replace(/^SKU:\s*/i, '').trim()
    }));
}

export default function SkuSelection({ navigation }) {
  const [assessment, setAssessment] = useState(assessmentStore.get());
  const [assessing, setAssessing] = useState(() => extractSkus(assessmentStore.get() || {}));
  const [skipped,   setSkipped]   = useState([]);
  const [hiAssess,  setHiAssess]  = useState([]);
  const [hiSkip,    setHiSkip]    = useState([]);
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    async function init() {
      let stored = assessment || await assessmentStore.hydrate();
      if (!stored) return;
      if (!assessment) setAssessment(stored);

      // If Start was already pressed, go straight to the player
      const committed = await assessmentStore.loadSkus();
      if (committed) {
        navigation.replace('AssessmentPlayer');
        return;
      }

      // Restore draft selection if available and non-empty
      const draft = await assessmentStore.loadSkuDraft();
      const draftHasContent = draft && (draft.assessing.length > 0 || draft.skipped.length > 0);
      if (draftHasContent) {
        setAssessing(draft.assessing);
        setSkipped(draft.skipped);
      } else {
        // No draft or empty draft (e.g. leftover from a bug) — use the assessment's SKUs
        setAssessing(extractSkus(stored));
      }
      setReady(true);
    }
    init();
  }, []);

  // Auto-save draft on every selection change (not before init has restored state)
  useEffect(() => {
    if (!ready) return;
    assessmentStore.saveSkuDraft({ assessing, skipped });
  }, [assessing, skipped, ready]);

  function toggleHiAssess(id) {
    setHiAssess(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleHiSkip(id) {
    setHiSkip(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function skip() {
    const moving = assessing.filter(s => hiAssess.includes(s.sys_id));
    setSkipped(prev => [...prev, ...moving]);
    setAssessing(prev => prev.filter(s => !hiAssess.includes(s.sys_id)));
    setHiAssess([]);
  }

  function restore() {
    const moving = skipped.filter(s => hiSkip.includes(s.sys_id));
    setAssessing(prev => [...prev, ...moving]);
    setSkipped(prev => prev.filter(s => !hiSkip.includes(s.sys_id)));
    setHiSkip([]);
  }

  function handleStart() {
    const count = assessing.length;
    confirmAlert(
      'Start Assessment?',
      `You're about to start with ${count} SKU${count !== 1 ? 's' : ''}. Once started, your SKU selection is locked and cannot be changed.`,
      async () => {
        await assessmentStore.saveSkus(assessing);
        navigation.replace('AssessmentPlayer');
      }
    );
  }

  if (!assessment) {
    return <View style={s.loading}><ActivityIndicator color="#0a2540" size="large" /></View>;
  }

  const description = assessment.description || (() => {
    const cat = assessment.categories?.find(c => c.name === 'Audit Information');
    return cat?.questions?.find(q => q.name === 'Description')?.existing_string_value || null;
  })();

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>{assessment.title}</Text>
        <Text style={s.subtitle}>
          Remove any SKUs you won't be assessing today.
        </Text>
        {description ? (
          <Text style={s.desc}>{description}</Text>
        ) : null}
      </View>

      {/* Dual-list body */}
      <View style={s.body}>
        {/* Left: Assessing */}
        <View style={s.pane}>
          <View style={s.paneHeader}>
            <Text style={s.paneTitle}>Assessing ({assessing.length})</Text>
          </View>
          <ScrollView style={s.list}>
            {assessing.length === 0 && (
              <Text style={s.empty}>No SKUs selected</Text>
            )}
            {assessing.map(sk => {
              const hi = hiAssess.includes(sk.sys_id);
              return (
                <TouchableOpacity
                  key={sk.sys_id}
                  style={[s.item, hi && s.itemHi]}
                  onPress={() => toggleHiAssess(sk.sys_id)}
                >
                  <Text style={[s.itemText, hi && s.itemTextHi]}>{sk.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Middle buttons */}
        <View style={s.btnCol}>
          <TouchableOpacity
            style={[s.moveBtn, s.moveBtnSkip, !hiAssess.length && s.moveBtnDisabled]}
            onPress={skip}
            disabled={!hiAssess.length}
          >
            <Text style={s.moveBtnText}>{'Skip\n>>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.moveBtn, !hiSkip.length && s.moveBtnDisabled]}
            onPress={restore}
            disabled={!hiSkip.length}
          >
            <Text style={s.moveBtnText}>{'<<\nAdd Back'}</Text>
          </TouchableOpacity>
        </View>

        {/* Right: Not Assessing */}
        <View style={s.pane}>
          <View style={[s.paneHeader, s.paneHeaderSkip]}>
            <Text style={s.paneTitle}>Not Assessing ({skipped.length})</Text>
          </View>
          <ScrollView style={s.list}>
            {skipped.length === 0 && (
              <Text style={s.empty}>None removed</Text>
            )}
            {skipped.map(sk => {
              const hi = hiSkip.includes(sk.sys_id);
              return (
                <TouchableOpacity
                  key={sk.sys_id}
                  style={[s.item, hi && s.itemHi]}
                  onPress={() => toggleHiSkip(sk.sys_id)}
                >
                  <Text style={[s.itemText, hi && s.itemTextHi]}>{sk.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          onPress={handleStart}
          disabled={assessing.length === 0}
          style={[s.startBtn, assessing.length === 0 && s.startBtnDisabled]}
        >
          <Text style={s.startBtnText}>
            Start Assessment{assessing.length > 0 ? ` (${assessing.length} SKU${assessing.length > 1 ? 's' : ''})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { backgroundColor: '#0a2540', padding: 16, paddingTop: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#8fa8c8', marginBottom: 6 },
  desc: { fontSize: 12, color: '#8fa8c8', lineHeight: 18, marginTop: 4 },

  body: { flex: 1, flexDirection: 'row', padding: 16, gap: 10 },
  pane: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden' },
  paneHeader: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 10 },
  paneHeaderSkip: { backgroundColor: '#4b2e2e' },
  paneTitle: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  list: { backgroundColor: '#0d1525', flex: 1, minHeight: 200 },
  empty: { padding: 12, color: '#8fa8c8', fontSize: 13, textAlign: 'center' },
  item: {
    paddingVertical: 9, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#1c2333'
  },
  itemHi: { backgroundColor: '#0070d2' },
  itemText: { fontSize: 13, color: '#d4e4ff' },
  itemTextHi: { color: '#fff', fontWeight: '600' },

  btnCol: { justifyContent: 'center', gap: 12, width: 72 },
  moveBtn: {
    backgroundColor: '#334155', borderRadius: 6,
    paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center'
  },
  moveBtnSkip: { backgroundColor: '#7f1d1d' },
  moveBtnDisabled: { opacity: 0.35 },
  moveBtnText: { color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  startBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 }
});
