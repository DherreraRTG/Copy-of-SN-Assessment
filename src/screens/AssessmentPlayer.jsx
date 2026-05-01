/**
 * AssessmentPlayer.jsx
 *
 * Can be reached two ways:
 *   1. Normal navigation from MyAssessments — user taps a downloaded assessment.
 *      route.params = { assessmentData: {...} }
 *
 *   2. Deep link from SN mobile UI Action.
 *      route.params = { instanceSysId: 'abc123', fromDeepLink: true }
 *      In this case we fetch the payload from the API on mount,
 *      cache it locally, then render as normal.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { fetchAssessmentByInstance, submitAssessment, uploadAttachment, completeAssessment } from '../services/assessmentService';
import { assessmentStore } from '../store/assessmentStore';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const CACHE_KEY = (id) => `assessment_instance_${id}`;

async function getCached(instanceSysId) {
  const raw = await AsyncStorage.getItem(CACHE_KEY(instanceSysId));
  return raw ? JSON.parse(raw) : null;
}

async function setCached(instanceSysId, data) {
  await AsyncStorage.setItem(CACHE_KEY(instanceSysId), JSON.stringify(data));
}

// ─────────────────────────────────────────────
// Web file input (rendered via DOM)
// ─────────────────────────────────────────────

function WebFileInput({ value, onChange }) {
  const inputRef = React.useRef(null);
  const files = Array.isArray(value) ? value : (value && typeof value === 'string' && value.startsWith('data:') ? [value] : []);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange([...files, reader.result]);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const remove = (idx) => onChange(files.filter((_, i) => i !== idx));

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    ...files.map((f, idx) =>
      React.createElement('div', { key: idx, style: { display: 'flex', alignItems: 'center', gap: 8 } },
        f.startsWith('data:image') && React.createElement('img', {
          src: f,
          style: { width: 64, height: 64, objectFit: 'cover', borderRadius: 6 },
        }),
        !f.startsWith('data:image') && React.createElement('span', { style: { fontSize: 12, color: '#1a6b9a', flex: 1 } }, `✓ File ${idx + 1} attached`),
        React.createElement('button', {
          type: 'button',
          onClick: () => remove(idx),
          style: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 18, lineHeight: 1 },
        }, '✕'),
      )
    ),
    React.createElement('input', {
      ref: inputRef,
      type: 'file',
      accept: 'image/*,application/pdf',
      onChange: handleChange,
      style: { display: 'none' },
    }),
    React.createElement('button', {
      type: 'button',
      onClick: () => inputRef.current?.click(),
      style: {
        padding: '8px 14px',
        backgroundColor: '#f0f4f8',
        border: '1px solid #d0dce8',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        color: '#3a5068',
        textAlign: 'left',
      },
    }, files.length > 0 ? '📎 Add another file' : '📎 Choose file…'),
  );
}

// ─────────────────────────────────────────────
// SKU Dimensions accordion field
// ─────────────────────────────────────────────

const SKU_DIM_BASE = [
  { key: 'num_components', label: 'Number of Components',                               hint: 'Enter a number' },
  { key: 'hardware_parts', label: 'Number of Hardware Parts',                           hint: 'Enter a number' },
  { key: 'assembly_time',  label: 'How long does the product take to fully assemble?',  hint: 'Minutes' },
];

const SKU_DIM_NPI = [
  { key: 'weight_pkg',     label: 'Fully packaged product weight (product inside)',     hint: 'lbs.' },
  { key: 'width_inside',   label: 'Width of packaged product (product inside)',         hint: 'inches' },
  { key: 'depth_inside',   label: 'Depth of packaged product (product inside)',         hint: 'inches' },
  { key: 'height_inside',  label: 'Height of packaged product (product inside)',        hint: 'inches' },
  { key: 'width_outside',  label: 'Width of outer packaging (without product)',         hint: 'inches' },
  { key: 'depth_outside',  label: 'Depth of outer packaging (without product)',         hint: 'inches' },
  { key: 'height_outside', label: 'Height of outer packaging (without product)',        hint: 'inches' },
];

function SkuDimensionsField({ value, onChange, sessionSkus, mandatory, label, isNPI }) {
  const [expanded, setExpanded] = useState({});

  const fields = isNPI ? [...SKU_DIM_BASE, ...SKU_DIM_NPI] : SKU_DIM_BASE;

  const data = React.useMemo(() => {
    try { return value ? JSON.parse(value) : {}; } catch { return {}; }
  }, [value]);

  function update(skuId, fieldKey, fieldVal) {
    const next = { ...data, [skuId]: { ...(data[skuId] || {}), [fieldKey]: fieldVal } };
    onChange(JSON.stringify(next));
  }

  function completedCount(skuId) {
    const d = data[skuId] || {};
    return fields.filter(f => d[f.key]?.toString().trim()).length;
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {mandatory && <Text style={styles.required}> *</Text>}
      </Text>
      {(sessionSkus || []).map(sku => {
        const isOpen = !!expanded[sku.sys_id];
        const done = completedCount(sku.sys_id);
        const total = fields.length;
        const allDone = done === total;
        return (
          <View key={sku.sys_id} style={styles.skuAccordion}>
            <TouchableOpacity
              style={styles.skuAccordionHeader}
              onPress={() => setExpanded(prev => ({ ...prev, [sku.sys_id]: !prev[sku.sys_id] }))}
              activeOpacity={0.8}
            >
              <Text style={styles.skuAccordionTitle}>{isOpen ? '▾' : '▸'} {sku.label}</Text>
              <View style={[styles.skuBadge, allDone && styles.skuBadgeDone]}>
                <Text style={styles.skuBadgeText}>{done}/{total}</Text>
              </View>
            </TouchableOpacity>
            {isOpen && (
              <View style={styles.skuAccordionBody}>
                {fields.map(f => (
                  <View key={f.key} style={{ marginBottom: 12 }}>
                    <Text style={styles.skuFieldLabel}>* {f.label} <Text style={styles.skuFieldHint}>({f.hint})</Text></Text>
                    <TextInput
                      style={styles.textInput}
                      value={(data[sku.sys_id] || {})[f.key] || ''}
                      onChangeText={v => update(sku.sys_id, f.key, v)}
                      placeholder={f.hint}
                      placeholderTextColor="#9aabb8"
                      keyboardType="numeric"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────
// Question component
// ─────────────────────────────────────────────

const CHOOSE_SKUS_RE = /choose sku/i;

const CHOICE_ORDER = ['no', 'yes', 'n/a', 'na'];
function sortChoices(choices) {
  if (!choices) return [];
  return [...choices].sort((a, b) => {
    const ai = CHOICE_ORDER.indexOf((a.label || '').toLowerCase());
    const bi = CHOICE_ORDER.indexOf((b.label || '').toLowerCase());
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    return aRank - bRank;
  });
}

function QuestionField({ question, value, onChange, sessionSkus, isNPI }) {
  const { datatype, choices, name, question: questionText, mandatory } = question;

  const label = questionText || name;

  // "SKUs Assembly and Dimensions" macro — per-SKU accordion form
  if (/sku.*assembly|assembly.*dimension/i.test(label) || /sku.*assembly|assembly.*dimension/i.test(name)) {
    return <SkuDimensionsField value={value} onChange={onChange} sessionSkus={sessionSkus} mandatory={mandatory} label={label} isNPI={isNPI} />;
  }

  // "Choose SKUs" — multi-select from the session SKUs regardless of datatype
  if (CHOOSE_SKUS_RE.test(label) || CHOOSE_SKUS_RE.test(name)) {
    const selected = value ? value.split(',').filter(Boolean) : [];
    const toggle = (id) => {
      const next = selected.includes(id)
        ? selected.filter(x => x !== id)
        : [...selected, id];
      onChange(next.join(','));
    };
    const skus = sessionSkus || [];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {mandatory && <Text style={styles.required}> *</Text>}
        </Text>
        {skus.length === 0 && (
          <Text style={styles.attachmentNote}>No SKUs selected for this session.</Text>
        )}
        {skus.map((sku) => {
          const isOn = selected.includes(sku.sys_id);
          return (
            <TouchableOpacity
              key={sku.sys_id}
              style={[styles.choiceRow, isOn && styles.choiceSelected]}
              onPress={() => toggle(sku.sys_id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isOn && styles.checkboxSelected]}>
                {isOn && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.choiceLabel, isOn && styles.choiceLabelSelected]}>
                {sku.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (datatype === 'choice') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {mandatory && <Text style={styles.required}> *</Text>}
        </Text>
        {(/(complete this category|want to complete)/i.test(label) ? (choices || []) : sortChoices(choices)).map((choice) => (
          <TouchableOpacity
            key={choice.sys_id}
            style={[styles.choiceRow, value === choice.sys_id && styles.choiceSelected]}
            onPress={() => onChange(value === choice.sys_id ? '' : choice.sys_id)}
            activeOpacity={0.7}
          >
            <View style={[styles.radio, value === choice.sys_id && styles.radioSelected]} />
            <Text style={[styles.choiceLabel, value === choice.sys_id && styles.choiceLabelSelected]}>
              {choice.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (datatype === 'boolean') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {mandatory && <Text style={styles.required}> *</Text>}
        </Text>
        {['Yes', 'No'].map((opt) => {
          const boolVal = opt === 'Yes' ? 'true' : 'false';
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.choiceRow, value === boolVal && styles.choiceSelected]}
              onPress={() => onChange(value === boolVal ? '' : boolVal)}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, value === boolVal && styles.radioSelected]} />
              <Text style={[styles.choiceLabel, value === boolVal && styles.choiceLabelSelected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (datatype === 'attachment') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {mandatory && <Text style={styles.required}> *</Text>}
        </Text>
        {Platform.OS === 'web'
          ? <WebFileInput value={value} onChange={onChange} />
          : <Text style={styles.attachmentNote}>📎 Attachment upload not supported on this platform.</Text>
        }
      </View>
    );
  }

  // string, custom, scale, numeric — text input
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {mandatory && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={styles.textInput}
        value={value || ''}
        onChangeText={onChange}
        multiline={datatype === 'string'}
        numberOfLines={datatype === 'string' ? 4 : 1}
        placeholder="Enter response…"
        placeholderTextColor="#9aabb8"
        keyboardType={datatype === 'numeric' || datatype === 'scale' ? 'numeric' : 'default'}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

function WebTabBar({ categories, activeCategoryIndex, onSelect, isCategoryComplete }) {
  const scrollRef = useRef(null);
  const intervalRef = useRef(null);

  function startScroll(dir) {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft += dir * 12;
    }, 16);
  }
  function stopScroll() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  return React.createElement('div', {
    onMouseMove: (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < 80) startScroll(-1);
      else if (x > rect.width - 80) startScroll(1);
      else stopScroll();
    },
    onMouseLeave: stopScroll,
    style: { backgroundColor: '#0a2540' },
  },
    React.createElement('div', {
      ref: scrollRef,
      style: {
        display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
        msOverflowStyle: 'none', padding: '6px 8px', gap: 4,
      },
    },
      ...categories.map((cat, idx) => {
        const isActive = idx === activeCategoryIndex;
        const complete = isCategoryComplete(cat);
        return React.createElement('button', {
          key: cat.catID,
          onClick: () => onSelect(idx),
          style: {
            padding: '6px 14px', borderRadius: 16, border: 'none',
            cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12,
            fontWeight: isActive ? '600' : '500', flexShrink: 0,
            backgroundColor: isActive ? '#1a6b9a' : 'transparent',
            color: isActive ? '#fff' : '#8aafc8',
          },
        },
          cat.name,
          !complete && React.createElement('span', { style: { color: '#f87171', fontWeight: '700' } }, ' *')
        );
      })
    )
  );
}

export default function AssessmentPlayer({ route, navigation }) {
  const { assessmentData, instanceSysId, fromDeepLink } = route.params || {};
  const isOnline = useOnlineStatus();

  // Fall back to the in-memory store when navigating from SkuSelection (no params on web)
  const initialPayload = assessmentData?.body || assessmentData || assessmentStore.get() || null;
  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);
  const [error, setError] = useState(null);

  const [sessionSkus, setSessionSkus] = useState([]);

  // answers: { [metricID]: string }
  const [answers, setAnswers] = useState({});

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Persist answers and category index to AsyncStorage on every change
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    assessmentStore.saveAnswers(answers);
  }, [answers]);

  useEffect(() => {
    assessmentStore.saveCategoryIndex(activeCategoryIndex);
  }, [activeCategoryIndex]);

  useEffect(() => {
    assessmentStore.loadSkus().then(skus => { if (skus) setSessionSkus(skus); });
  }, []);

  // Filter SKU lines in the Audit Information description to only show selected SKUs
  useEffect(() => {
    if (!payload || sessionSkus.length === 0) return;

    const auditCat = payload.categories?.find(c => /audit info/i.test(c.name));
    if (!auditCat) return;
    const descQ = auditCat.questions?.find(q => /^description$/i.test(q.name));
    if (!descQ) return;

    const skuLabels = new Set(sessionSkus.map(s => s.label.toLowerCase()));

    setAnswers(prev => {
      const current = prev[descQ.metricID] || descQ.existing_string_value || '';
      if (!current) return prev;
      const filtered = current
        .split('\n')
        .filter(line => {
          const m = line.match(/^SKU:\s*(.+)/i);
          if (!m) return true;
          return skuLabels.has(m[1].trim().toLowerCase());
        })
        .join('\n');
      if (filtered === current) return prev;
      return { ...prev, [descQ.metricID]: filtered };
    });
  }, [sessionSkus, payload]);

  // ── Load payload from deep link ────────────────────────
  useEffect(() => {
    if (payload) {
      prefillAnswers(payload);
      setLoading(false);
      return;
    }

    if (!instanceSysId) {
      // Page was refreshed — try to restore from AsyncStorage
      assessmentStore.hydrate().then(stored => {
        if (stored) {
          setPayload(stored);
          prefillAnswers(stored);
        } else {
          setError('No assessment data or instance ID provided.');
        }
        setLoading(false);
      });
      return;
    }

    async function load() {
      setLoading(true);
      try {
        // Try cache first
        const cached = await getCached(instanceSysId);
        if (cached) {
          setPayload(cached);
          prefillAnswers(cached);
        }

        // If online, always fetch fresh
        if (isOnline) {
          const fresh = await fetchAssessmentByInstance(instanceSysId);
          const body = fresh?.result?.body || fresh?.body || fresh;
          await setCached(instanceSysId, body);
          setPayload(body);
          prefillAnswers(body);
        } else if (!cached) {
          setError('No network connection and no cached data for this assessment.');
        }
      } catch (e) {
        setError(e.message || 'Failed to load assessment.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [instanceSysId, isOnline]);

  async function prefillAnswers(data) {
    const prefilled = {};
    (data.categories || []).forEach(cat => {
      (cat.questions || []).forEach(q => {
        if (q.existing_string_value && q.datatype === 'string') {
          prefilled[q.metricID] = q.existing_string_value;
        } else if (q.existing_value && q.existing_value !== '-1') {
          prefilled[q.metricID] = q.existing_value;
        }
      });
    });
    const [saved, savedIndex, loadedSkus] = await Promise.all([
      assessmentStore.loadAnswers(),
      assessmentStore.loadCategoryIndex(),
      assessmentStore.loadSkus(),
    ]);

    let finalAnswers = saved && Object.keys(saved).length > 0 ? { ...prefilled, ...saved } : prefilled;

    // Apply SKU filter to description immediately so saved answers can't overwrite a filtered value
    const skusForFilter = loadedSkus || [];
    if (skusForFilter.length > 0) {
      const auditCat = data.categories?.find(c => /audit info/i.test(c.name));
      if (auditCat) {
        const descQ = auditCat.questions?.find(q => /^description$/i.test(q.name));
        if (descQ && finalAnswers[descQ.metricID]) {
          const skuLabels = new Set(skusForFilter.map(s => s.label.toLowerCase()));
          finalAnswers = {
            ...finalAnswers,
            [descQ.metricID]: finalAnswers[descQ.metricID]
              .split('\n')
              .filter(line => {
                const m = line.match(/^SKU:\s*(.+)/i);
                if (!m) return true;
                return skuLabels.has(m[1].trim().toLowerCase());
              })
              .join('\n'),
          };
        }
      }
    }

    setAnswers(finalAnswers);
    if (savedIndex > 0) setActiveCategoryIndex(savedIndex);
  }

  // ── Update title when payload loads ───────────────────
  useEffect(() => {
    if (payload?.title) {
      navigation.setOptions({ title: payload.title });
    }
  }, [payload]);

  // ── Dependency resolution ──────────────────────────────
  function isVisible(question, categoryQuestions) {
    if (!question.depends_on) return true;

    // Find the parent question by name
    const parent = categoryQuestions.find(q => q.name === question.depends_on);
    if (!parent) return true;

    const parentAnswer = answers[parent.metricID];
    if (!parentAnswer) return false;

    // displayed_when holds the sys_id of the choice that triggers display
    return parentAnswer === question.displayed_when;
  }

  // ── Answer setter ──────────────────────────────────────
  const setAnswer = useCallback((metricID, value) => {
    setAnswers(prev => ({ ...prev, [metricID]: value }));
  }, []);

  // ── Category completion check ──────────────────────────
  function isCategoryComplete(cat) {
    return (cat.questions || [])
      .filter(q => !/will this standard be exempted/i.test(q.question || q.name))
      .filter(q => q.mandatory)
      .filter(q => isVisible(q, cat.questions))
      .every(q => {
        const label = q.question || q.name || '';

        // SKU dimensions — every SKU must have every field filled
        if (/sku.*assembly|assembly.*dimension/i.test(label)) {
          const val = answers[q.metricID];
          if (!val) return false;
          try {
            const data = JSON.parse(val);
            const fields = isNPI ? [...SKU_DIM_BASE, ...SKU_DIM_NPI] : SKU_DIM_BASE;
            return sessionSkus.length > 0 && sessionSkus.every(sku => {
              const skuData = data[sku.sys_id] || {};
              return fields.every(f => skuData[f.key]?.toString().trim());
            });
          } catch { return false; }
        }

        const val = answers[q.metricID];
        if (Array.isArray(val)) return val.length > 0;
        return val !== undefined && val !== '' && val !== null;
      });
  }

  // ── Submit ─────────────────────────────────────────────
  function handleSubmitPress() {
    if (!isOnline) {
      if (Platform.OS === 'web') {
        window.alert('No internet connection. Please connect to Wi-Fi or mobile data before submitting. Your answers are saved and will still be here when you reconnect.');
      } else {
        Alert.alert('No Connection', 'Please connect to Wi-Fi or mobile data before submitting.\n\nYour answers are saved and will still be here when you reconnect.');
      }
      return;
    }

    if (!allComplete) {
      const incomplete = categories
        .filter(c => !isCategoryComplete(c))
        .map(c => `  • ${c.name}`)
        .join('\n');
      if (Platform.OS === 'web') {
        window.alert(`Please complete all required fields (*) in:\n\n${incomplete}`);
      } else {
        Alert.alert('Incomplete Categories', `Please complete all required fields (*) in:\n\n${incomplete}`, [{ text: 'OK' }]);
      }
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Once submitted, answers cannot be changed. Are you sure?')) {
        doSubmit();
      }
    } else {
      Alert.alert(
        'Submit Assessment',
        'Once submitted, answers cannot be changed. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', style: 'default', onPress: () => doSubmit() },
        ]
      );
    }
  }

  async function doSubmit() {
    if (!payload) return;

    const instanceId = instanceSysId || payload.instance_sys_id;
    const metricTypeSysId = payload.sys_id;
    const submittedAt = new Date().toISOString();

    const questionMap = {};
    (payload.categories || []).forEach(cat =>
      (cat.questions || []).forEach(q => { questionMap[q.metricID] = q; })
    );

    // Collect attachment answers for separate upload after submit
    const attachmentAnswers = [];

    const submitCategories = (payload.categories || []).map(cat => ({
      catID: cat.catID,
      questions: (cat.questions || [])
        .filter(q => {
            const v = answers[q.metricID];
            return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== '');
          })
        .map(q => {
          const raw = answers[q.metricID] || '';
          const question = questionMap[q.metricID];

          if (question?.datatype === 'choice') {
            const choice = (question.choices || []).find(c => c.sys_id === raw);
            return {
              metricID: q.metricID,
              value: choice ? choice.value : raw,
              string_value: choice ? choice.label : raw,
            };
          }

          if (question?.datatype === 'boolean') {
            const boolVal = raw === 'true' ? '1' : '0';
            return {
              metricID: q.metricID,
              value: boolVal,
              string_value: raw === 'true' ? 'Yes' : 'No',
            };
          }

          // Strip base64 from body — upload separately after submit (supports multiple files)
          if (question?.datatype === 'attachment') {
            const fileList = Array.isArray(raw) ? raw : (raw && raw.startsWith('data:') ? [raw] : []);
            fileList.forEach(base64 => attachmentAnswers.push({ metricID: q.metricID, base64 }));
            return { metricID: q.metricID, value: '', string_value: '' };
          }

          return { metricID: q.metricID, value: raw, string_value: raw };
        }),
    }));

    const submitBody = {
      metric_type_sys_id: metricTypeSysId,
      instance_sys_id: instanceId,
      task_sys_id: payload.task_sys_id || null,
      submitted_by: null,
      submitted_at: submittedAt,
      categories: submitCategories,
    };

    setSubmitting(true);
    try {
      const result = await submitAssessment(submitBody);
      // Upload attachments, then mark complete — ensures photos land before state changes
      if (attachmentAnswers.length > 0 && instanceId) {
        await Promise.allSettled(
          attachmentAnswers.map(a => uploadAttachment(instanceId, a.metricID, a.base64))
        );
      }
      if (instanceId) {
        await completeAssessment(instanceId);
      }
      await assessmentStore.clear();
      navigation.replace('SubmissionSuccess', {
        instanceNumber: result?.body?.instance_number || instanceId,
        answered: result?.body?.answered ?? null,
        skipped: result?.body?.skipped ?? null,
        submittedAt,
      });
    } catch (e) {
      if (Platform.OS === 'web') {
        window.alert(`Submission failed: ${e.message || 'Please check your connection and try again.'}`);
      } else {
        Alert.alert('Submission Failed', e.message || 'Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ──────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a2540" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!payload) return null;

  const categories = payload.categories || [];
  const activeCategory = categories[activeCategoryIndex];
  const allComplete = categories.every(isCategoryComplete);
  const isNPI = !!(payload.isNPI || /^npi/i.test(payload.title || ''));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Offline banner ── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>⚡ Offline — answers are saved. Reconnect to submit.</Text>
        </View>
      )}

      {/* ── Category tabs ── */}
      <WebTabBar
        categories={categories}
        activeCategoryIndex={activeCategoryIndex}
        onSelect={setActiveCategoryIndex}
        isCategoryComplete={isCategoryComplete}
      />

      {/* ── Questions ── */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeCategory && (
          <>
            <Text style={styles.categoryTitle}>{activeCategory.name}</Text>
            {(activeCategory.questions || [])
              .filter(q => !/will this standard be exempted/i.test(q.question || q.name))
              .filter(q => isVisible(q, activeCategory.questions))
              .sort((a, b) => Number(a.order) - Number(b.order))
              .map(q => (
                <QuestionField
                  key={q.metricID}
                  question={q}
                  value={answers[q.metricID] || ''}
                  onChange={(val) => setAnswer(q.metricID, val)}
                  sessionSkus={sessionSkus}
                  isNPI={isNPI}
                />
              ))}
          </>
        )}

        {/* ── Navigation between categories ── */}
        <View style={styles.navRow}>
          {activeCategoryIndex > 0 && (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => setActiveCategoryIndex(i => i - 1)}
            >
              <Text style={styles.navBtnText}>← Previous</Text>
            </TouchableOpacity>
          )}
          {activeCategoryIndex < categories.length - 1 ? (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnPrimary]}
              onPress={() => setActiveCategoryIndex(i => i + 1)}
            >
              <Text style={[styles.navBtnText, styles.navBtnTextPrimary]}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitPress}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>
                    {allComplete ? 'Submit Assessment' : 'Submit Assessment (*)'}
                  </Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#5a7a8a',
  },
  errorText: {
    fontSize: 15,
    color: '#c0392b',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0a2540',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  offlineBanner: {
    backgroundColor: '#e67e22',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    backgroundColor: '#0a2540',
    flexGrow: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 6,
  },
  tabActive: {
    backgroundColor: '#1a6b9a',
  },
  tabText: {
    color: '#8aafc8',
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a2540',
    marginBottom: 16,
  },
  field: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2f45',
    marginBottom: 10,
    lineHeight: 20,
  },
  required: {
    color: '#e74c3c',
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#f8f9fb',
  },
  choiceSelected: {
    backgroundColor: '#e8f4fd',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#9aabb8',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: '#1a6b9a',
    backgroundColor: '#1a6b9a',
  },
  choiceLabel: {
    fontSize: 14,
    color: '#3a5068',
    flex: 1,
  },
  choiceLabelSelected: {
    color: '#0a2540',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d0dce8',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1a2f45',
    backgroundColor: '#f8f9fb',
    textAlignVertical: 'top',
  },
  attachmentNote: {
    fontSize: 13,
    color: '#9aabb8',
    fontStyle: 'italic',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9aabb8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#1a6b9a',
    backgroundColor: '#1a6b9a',
  },
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0dce8',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  navBtnPrimary: {
    backgroundColor: '#0a2540',
    borderColor: '#0a2540',
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a5068',
  },
  navBtnTextPrimary: {
    color: '#ffffff',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#1a6b9a',
    borderColor: '#1a6b9a',
  },
  submitBtnDisabled: {
    backgroundColor: '#64748b',
    borderColor: '#64748b',
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  tabIncomplete: {
    color: '#f87171',
    fontWeight: '700',
  },
  skuAccordion: {
    borderWidth: 1, borderColor: '#d1dde8', borderRadius: 6,
    marginBottom: 8, overflow: 'hidden',
  },
  skuAccordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#eef2f7', paddingVertical: 10, paddingHorizontal: 12,
  },
  skuAccordionTitle: {
    flex: 1, fontSize: 13, fontWeight: '600', color: '#1e3a5f',
  },
  skuBadge: {
    backgroundColor: '#94a3b8', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  skuBadgeDone: { backgroundColor: '#16a34a' },
  skuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  skuAccordionBody: {
    padding: 12, backgroundColor: '#fff',
  },
  skuFieldLabel: {
    fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4,
  },
  skuFieldHint: {
    fontWeight: '400', color: '#64748b',
  },
});