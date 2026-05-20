import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import rtgLogo from '/public/rtg-logo.png';
import storage from '../lib/storage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { fetchAssessmentByInstance, submitAssessment, uploadAttachment, completeAssessment } from '../services/assessmentService';
import { assessmentStore } from '../store/assessmentStore';
import { photoStore, blobToBase64 } from '../utils/photoStore';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const CACHE_KEY = (id) => `assessment_instance_${id}`;

async function getCached(instanceSysId) {
  const raw = await storage.getItem(CACHE_KEY(instanceSysId));
  return raw ? JSON.parse(raw) : null;
}

async function setCached(instanceSysId, data) {
  await storage.setItem(CACHE_KEY(instanceSysId), JSON.stringify(data));
}

function Spinner({ color = '#0a2540', size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `3px solid #e0e0e0`, borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

// ─────────────────────────────────────────────
// Image compression + file input
// ─────────────────────────────────────────────

function compressImage(dataUrl, maxWidth = 900, targetKB = 50) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const maxLen = targetKB * 1024 * 1.37;
      let quality = 0.7;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > maxLen && quality > 0.2) {
        quality = Math.round((quality - 0.1) * 10) / 10;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function WebFileInput({ value, onChange }) {
  const inputRef = React.useRef(null);
  const [previewUrls, setPreviewUrls] = React.useState({});
  const loadedKeys = React.useRef(new Set());

  const files = Array.isArray(value)
    ? value
    : (value && typeof value === 'string' && (value.startsWith('data:') || value.startsWith('idb:'))
      ? [value] : []);

  React.useEffect(() => {
    const pending = files.filter(f => f.startsWith('idb:') && !loadedKeys.current.has(f));
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const key of pending) {
        loadedKeys.current.add(key);
        const entry = await photoStore.load(key);
        if (entry?.blob && entry.type?.startsWith('image/') && !cancelled) {
          next[key] = URL.createObjectURL(entry.blob);
        }
      }
      if (!cancelled && Object.keys(next).length) setPreviewUrls(prev => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [files.join('|')]);

  React.useEffect(() => {
    return () => Object.values(previewUrls).forEach(u => u && URL.revokeObjectURL(u));
  }, []);

  const handleChange = async (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    const refs = [];
    const newUrls = {};
    for (const file of selected) {
      try {
        const key = await photoStore.save(file);
        refs.push(key);
        loadedKeys.current.add(key);
        if (file.type.startsWith('image/')) newUrls[key] = URL.createObjectURL(file);
      } catch (err) {
        await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => { refs.push(reader.result); resolve(); };
          reader.readAsDataURL(file);
        });
      }
    }
    if (Object.keys(newUrls).length) setPreviewUrls(prev => ({ ...prev, ...newUrls }));
    onChange([...files, ...refs]);
    e.target.value = '';
  };

  const remove = async (idx) => {
    const f = files[idx];
    if (f.startsWith('idb:')) {
      photoStore.remove(f);
      if (previewUrls[f]) {
        URL.revokeObjectURL(previewUrls[f]);
        setPreviewUrls(prev => { const n = { ...prev }; delete n[f]; return n; });
      }
    }
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {files.map((f, idx) => {
        const src = f.startsWith('data:image') ? f : (f.startsWith('idb:') ? previewUrls[f] : null);
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {src
              ? <img src={src} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} alt="" />
              : <span style={{ fontSize: 12, color: '#1a6b9a', flex: 1 }}>{`✓ File ${idx + 1} attached`}</span>}
            <button
              type="button"
              onClick={() => remove(idx)}
              style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >✕</button>
          </div>
        );
      })}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '8px 14px', backgroundColor: '#f0f4f8',
          border: '1px solid #d0dce8', borderRadius: 8,
          fontSize: 13, color: '#3a5068', textAlign: 'left',
        }}
      >
        {files.length > 0 ? '📎 Add another file' : '📎 Choose file…'}
      </button>
    </div>
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
    <div style={styles.field}>
      <span style={styles.label}>
        {label}
        {mandatory && <span style={styles.required}> *</span>}
      </span>
      {(sessionSkus || []).map(sku => {
        const isOpen = !!expanded[sku.sys_id];
        const done  = completedCount(sku.sys_id);
        const total = fields.length;
        const allDone = done === total;
        return (
          <div key={sku.sys_id} style={styles.skuAccordion}>
            <button
              style={styles.skuAccordionHeader}
              onClick={() => setExpanded(prev => ({ ...prev, [sku.sys_id]: !prev[sku.sys_id] }))}
            >
              <span style={styles.skuAccordionTitle}>{isOpen ? '▾' : '▸'} {sku.label}</span>
              <span style={{ ...styles.skuBadge, ...(allDone ? styles.skuBadgeDone : {}) }}>
                <span style={styles.skuBadgeText}>{done}/{total}</span>
              </span>
            </button>
            {isOpen && (
              <div style={styles.skuAccordionBody}>
                {fields.map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <span style={styles.skuFieldLabel}>* {f.label} <span style={styles.skuFieldHint}>({f.hint})</span></span>
                    <input
                      style={styles.textInput}
                      value={(data[sku.sys_id] || {})[f.key] || ''}
                      onChange={e => update(sku.sys_id, f.key, e.target.value)}
                      placeholder={f.hint}
                      type="number"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
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
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function QuestionField({ question, value, onChange, sessionSkus, isNPI }) {
  const { datatype, choices, name, question: questionText, mandatory } = question;
  const textareaRef = React.useRef(null);

  // Auto-resize textarea
  React.useEffect(() => {
    if (datatype !== 'string') return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(80, el.scrollHeight) + 'px';
  }, [value, datatype]);

  const label = questionText || name;

  if (/sku.*assembly|assembly.*dimension|skus\s+assembly/i.test(label) || /sku.*assembly|assembly.*dimension|skus\s+assembly/i.test(name)) {
    return <SkuDimensionsField value={value} onChange={onChange} sessionSkus={sessionSkus} mandatory={mandatory} label={label} isNPI={isNPI} />;
  }

  if (CHOOSE_SKUS_RE.test(label) || CHOOSE_SKUS_RE.test(name)) {
    const selected = value ? value.split(',').filter(Boolean) : [];
    const toggle = (id) => {
      const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
      onChange(next.join(','));
    };
    const skus = sessionSkus || [];
    return (
      <div style={styles.field}>
        <span style={styles.label}>
          {label}
          {mandatory && <span style={styles.required}> *</span>}
        </span>
        {skus.length === 0 && <span style={styles.attachmentNote}>No SKUs selected for this session.</span>}
        {skus.map((sku) => {
          const isOn = selected.includes(sku.sys_id);
          return (
            <button
              key={sku.sys_id}
              style={{ ...styles.choiceRow, ...(isOn ? styles.choiceSelected : {}) }}
              onClick={() => toggle(sku.sys_id)}
            >
              <div style={{ ...styles.checkbox, ...(isOn ? styles.checkboxSelected : {}) }}>
                {isOn && <span style={styles.checkmark}>✓</span>}
              </div>
              <span style={{ ...styles.choiceLabel, ...(isOn ? styles.choiceLabelSelected : {}) }}>
                {sku.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (datatype === 'choice') {
    return (
      <div style={styles.field}>
        <span style={styles.label}>
          {label}
          {mandatory && <span style={styles.required}> *</span>}
        </span>
        {(/(complete this category|want to complete)/i.test(label) ? (choices || []) : sortChoices(choices)).map((choice) => (
          <button
            key={choice.sys_id}
            style={{ ...styles.choiceRow, ...(value === choice.sys_id ? styles.choiceSelected : {}) }}
            onClick={() => onChange(value === choice.sys_id ? '' : choice.sys_id)}
          >
            <div style={{ ...styles.radio, ...(value === choice.sys_id ? styles.radioSelected : {}) }} />
            <span style={{ ...styles.choiceLabel, ...(value === choice.sys_id ? styles.choiceLabelSelected : {}) }}>
              {choice.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (datatype === 'boolean') {
    return (
      <div style={styles.field}>
        <span style={styles.label}>
          {label}
          {mandatory && <span style={styles.required}> *</span>}
        </span>
        {['Yes', 'No'].map((opt) => {
          const boolVal = opt === 'Yes' ? 'true' : 'false';
          return (
            <button
              key={opt}
              style={{ ...styles.choiceRow, ...(value === boolVal ? styles.choiceSelected : {}) }}
              onClick={() => onChange(value === boolVal ? '' : boolVal)}
            >
              <div style={{ ...styles.radio, ...(value === boolVal ? styles.radioSelected : {}) }} />
              <span style={{ ...styles.choiceLabel, ...(value === boolVal ? styles.choiceLabelSelected : {}) }}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (datatype === 'attachment') {
    return (
      <div style={styles.field}>
        <span style={styles.label}>
          {label}
          {mandatory && <span style={styles.required}> *</span>}
        </span>
        <WebFileInput value={value} onChange={onChange} />
      </div>
    );
  }

  // string, custom, scale, numeric
  return (
    <div style={styles.field}>
      <span style={styles.label}>
        {label}
        {mandatory && <span style={styles.required}> *</span>}
      </span>
      {datatype === 'string' ? (
        <textarea
          ref={textareaRef}
          style={{ ...styles.textInput, minHeight: 80, resize: 'none', overflow: 'hidden' }}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter response…"
        />
      ) : (
        <input
          style={styles.textInput}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter response…"
          type={datatype === 'numeric' || datatype === 'scale' ? 'number' : 'text'}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab bar
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

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < 80) startScroll(-1);
        else if (x > rect.width - 80) startScroll(1);
        else stopScroll();
      }}
      onMouseLeave={stopScroll}
      style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #d8dde6' }}
    >
      <div
        ref={scrollRef}
        style={{
          display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
          msOverflowStyle: 'none', padding: '0 8px', gap: 0,
        }}
      >
        {categories.map((cat, idx) => {
          const isActive  = idx === activeCategoryIndex;
          const complete  = isCategoryComplete(cat);
          return (
            <button
              key={cat.catID}
              onClick={() => onSelect(idx)}
              style={{
                padding: '10px 16px', border: 'none',
                borderBottom: isActive ? '2px solid #0070d2' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12,
                fontWeight: isActive ? '600' : '400', flexShrink: 0,
                backgroundColor: 'transparent',
                color: isActive ? '#0070d2' : '#67717e',
                marginBottom: '-1px',
              }}
            >
              {cat.name}
              {!complete && <span style={{ color: '#d93025', fontWeight: '700' }}> *</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function AssessmentPlayer() {
  const navigate  = useNavigate();
  const isOnline  = useOnlineStatus();

  const initialPayload = assessmentStore.get() || null;
  const [payload,  setPayload]  = useState(initialPayload);
  const [loading,  setLoading]  = useState(!initialPayload);
  const [error,    setError]    = useState(null);

  const [sessionSkus, setSessionSkus] = useState([]);
  const [answers,     setAnswers]     = useState({});

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const categoryHydrated = useRef(false);

  // Persist answers to localStorage on every change
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    assessmentStore.saveAnswers(answers).catch(e => {
      if (e?.message === 'QUOTA_EXCEEDED') {
        window.alert('Storage full — your last photo could not be saved. Submit what you have or remove some photos to continue.');
      }
    });
  }, [answers]);

  useEffect(() => {
    if (!categoryHydrated.current) return;
    assessmentStore.saveCategoryIndex(activeCategoryIndex);
  }, [activeCategoryIndex]);

  useEffect(() => {
    assessmentStore.loadSkus().then(skus => { if (skus) setSessionSkus(skus); });
  }, []);

  // Filter SKU lines in description to only show selected SKUs
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

  // Load payload (from store or hydrate from localStorage on page refresh)
  useEffect(() => {
    if (payload) {
      prefillAnswers(payload);
      setLoading(false);
      return;
    }

    assessmentStore.hydrate().then(async stored => {
      if (stored) {
        setPayload(stored);
        await prefillAnswers(stored);
      } else {
        setError('No assessment data found. Please open an assessment from ServiceNow.');
      }
      setLoading(false);
    });
  }, []);

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

    if (loadedSkus && loadedSkus.length > 0) setSessionSkus(loadedSkus);
    setAnswers(finalAnswers);
    categoryHydrated.current = true;
    if (savedIndex > 0) setActiveCategoryIndex(savedIndex);
  }

  // ── Dependency resolution ──────────────────────────────
  function isVisible(question, categoryQuestions) {
    const gatingQ = categoryQuestions.find(q =>
      /(complete this category|want to complete)/i.test(q.question || q.name)
    );
    if (gatingQ && gatingQ.metricID !== question.metricID) {
      const yesChoice = (gatingQ.choices || []).find(c => /^yes$/i.test(c.label));
      if (!yesChoice || answers[gatingQ.metricID] !== yesChoice.sys_id) return false;
    }

    if (!question.depends_on) return true;

    const parent = categoryQuestions.find(
      q => q.name === question.depends_on || q.metricID === question.depends_on
    );
    if (!parent) return true;

    const parentAnswer = answers[parent.metricID];
    if (!parentAnswer) return false;

    return parentAnswer === question.displayed_when;
  }

  const setAnswer = useCallback((metricID, value) => {
    setAnswers(prev => ({ ...prev, [metricID]: value }));
  }, []);

  function isCategoryComplete(cat) {
    const gatingQ = (cat.questions || []).find(q =>
      /(complete this category|want to complete)/i.test(q.question || q.name)
    );
    if (gatingQ) {
      const noChoice = (gatingQ.choices || []).find(c => /^no$/i.test(c.label));
      if (noChoice && answers[gatingQ.metricID] === noChoice.sys_id) return true;
    }

    return (cat.questions || [])
      .filter(q => !/will this standard be exempted/i.test(q.question || q.name))
      .filter(q => q.mandatory)
      .filter(q => isVisible(q, cat.questions))
      .every(q => {
        const label = q.question || q.name || '';
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
      window.alert('No internet connection. Please connect to Wi-Fi or mobile data before submitting. Your answers are saved and will still be here when you reconnect.');
      return;
    }

    if (!allComplete) {
      const incomplete = categories
        .filter(c => !isCategoryComplete(c))
        .map(c => `  • ${c.name}`)
        .join('\n');
      window.alert(`Please complete all required fields (*) in:\n\n${incomplete}`);
      return;
    }

    if (window.confirm('Once submitted, answers cannot be changed. Are you sure?')) {
      doSubmit();
    }
  }

  async function doSubmit() {
    if (!payload) return;

    const preKnownInstanceId = payload.instance_sys_id;
    const metricTypeSysId   = payload.sys_id;
    const submittedAt        = new Date().toISOString();

    const questionMap = {};
    (payload.categories || []).forEach(cat =>
      (cat.questions || []).forEach(q => { questionMap[q.metricID] = q; })
    );

    const attachmentAnswers = [];

    const submitCategories = (payload.categories || []).map(cat => ({
      catID: cat.catID,
      questions: (cat.questions || [])
        .filter(q => isVisible(q, cat.questions))
        .filter(q => {
          const v = answers[q.metricID];
          return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== '');
        })
        .map(q => {
          const raw      = answers[q.metricID] || '';
          const question = questionMap[q.metricID];

          if (question?.datatype === 'choice') {
            const choice = (question.choices || []).find(c => c.sys_id === raw);
            return { metricID: q.metricID, value: choice ? choice.value : raw, string_value: choice ? choice.label : raw };
          }

          if (question?.datatype === 'boolean') {
            return {
              metricID: q.metricID,
              value: raw === 'true' ? '1' : '0',
              string_value: raw === 'true' ? 'Yes' : 'No',
            };
          }

          if (question?.datatype === 'attachment') {
            const fileList = Array.isArray(raw) ? raw : (raw && (raw.startsWith('data:') || raw.startsWith('idb:')) ? [raw] : []);
            fileList.forEach(fileRef => attachmentAnswers.push({ metricID: q.metricID, fileRef }));
            return { metricID: q.metricID, value: '', string_value: '' };
          }

          return { metricID: q.metricID, value: raw, string_value: raw };
        }),
    }));

    const submitBody = {
      metric_type_sys_id: metricTypeSysId,
      instance_sys_id:    preKnownInstanceId,
      task_sys_id:        payload.task_sys_id || null,
      submitted_by:       null,
      submitted_at:       submittedAt,
      categories:         submitCategories,
    };

    setSubmitting(true);
    try {
      const result = await submitAssessment(submitBody);
      const instanceId = preKnownInstanceId || result?.body?.instance_sys_id;

      let failedPhotoCount = 0;
      if (attachmentAnswers.length > 0 && instanceId) {
        setUploadProgress({ done: 0, total: attachmentAnswers.length });
        for (let i = 0; i < attachmentAnswers.length; i++) {
          const { metricID, fileRef } = attachmentAnswers[i];
          let uploaded = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              let base64;
              if (fileRef.startsWith('idb:')) {
                const entry = await photoStore.load(fileRef);
                if (!entry?.blob) throw new Error('Photo missing from local storage');
                base64 = await blobToBase64(entry.blob);
              } else {
                base64 = fileRef;
              }
              await uploadAttachment(instanceId, metricID, base64);
              uploaded = true;
              break;
            } catch (err) {
              console.warn(`Photo ${i + 1} upload attempt ${attempt + 1} failed:`, err?.message);
              if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            }
          }
          if (!uploaded) failedPhotoCount++;
          setUploadProgress({ done: i + 1, total: attachmentAnswers.length });
        }
        setUploadProgress(null);
        if (failedPhotoCount > 0) {
          console.error(`${failedPhotoCount} of ${attachmentAnswers.length} photo(s) failed to upload after 3 attempts.`);
        }
      }

      if (instanceId) {
        const instanceNumber = result?.body?.instance_number || instanceId;
        await assessmentStore.savePendingComplete({ instanceId, submittedAt, instanceNumber });
        await completeAssessment(instanceId);
        await assessmentStore.clearPendingComplete();
      }

      await assessmentStore.clear();
      await photoStore.clear();
      navigate('/success', {
        replace: true,
        state: {
          instanceNumber:   result?.body?.instance_number || instanceId,
          answered:         result?.body?.answered ?? null,
          skipped:          result?.body?.skipped   ?? null,
          submittedAt,
          failedPhotoCount: failedPhotoCount > 0 ? failedPhotoCount : undefined,
          totalPhotos:      attachmentAnswers.length > 0 ? attachmentAnswers.length : undefined,
        },
      });
    } catch (e) {
      const msg = e.message || '';
      const isNetworkError = msg === 'Failed to fetch' || msg.includes('ERR_INTERNET_DISCONNECTED') || msg.includes('Network request failed') || msg.includes('Load failed');
      const isCompleteFailure = msg.toLowerCase().includes('complete');

      if (isCompleteFailure) {
        await assessmentStore.clear();
        await photoStore.clear();
        navigate('/success', { replace: true, state: { instanceNumber: null, answered: null, skipped: null, submittedAt } });
        return;
      }

      const userMsg = isNetworkError
        ? 'Unable to reach the server. Please check your connection and try again.\n\nYour answers are still saved.'
        : `Submission failed: ${msg || 'Please try again.'}`;
      window.alert(userMsg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ──────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={styles.errorText}>{error}</p>
        <button style={styles.retryBtn} onClick={() => navigate('/')}>
          Go Back
        </button>
      </div>
    );
  }

  if (!payload) return null;

  const categories      = payload.categories || [];
  const activeCategory  = categories[activeCategoryIndex];
  const isNPI           = !!(payload.isNPI || /^npi/i.test(payload.title || ''));
  const allComplete     = categories.every(isCategoryComplete);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* App header with RTG logo */}
      <div style={{ backgroundColor: '#1b1b38', height: 56, display: 'flex', alignItems: 'center', paddingLeft: 20, flexShrink: 0 }}>
        <img src={rtgLogo} style={{ height: 34, width: 155, objectFit: 'contain' }} alt="RTG" />
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={styles.offlineBannerText}>⚡ Offline — answers are saved. Reconnect to submit.</span>
        </div>
      )}

      {/* Category tabs */}
      <WebTabBar
        categories={categories}
        activeCategoryIndex={activeCategoryIndex}
        onSelect={setActiveCategoryIndex}
        isCategoryComplete={isCategoryComplete}
      />

      {/* Page title band */}
      <div style={styles.pageTitleBand}>
        <span style={styles.pageTitleText}>{payload?.title || 'Assessment'}</span>
      </div>

      {/* Questions scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f2f4f7' }}>
        <div style={{ padding: 16, paddingBottom: 40 }}>
          {activeCategory && (
            <>
              <p style={styles.categoryTitle}>{activeCategory.name}</p>
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

          {/* Navigation between categories */}
          <div style={styles.navRow}>
            {activeCategoryIndex > 0 && (
              <button style={styles.navBtn} onClick={() => setActiveCategoryIndex(i => i - 1)}>
                ← Previous
              </button>
            )}
            {activeCategoryIndex < categories.length - 1 ? (
              <button style={{ ...styles.navBtn, ...styles.navBtnPrimary }} onClick={() => setActiveCategoryIndex(i => i + 1)}>
                Next →
              </button>
            ) : (
              <button
                style={{ ...styles.navBtn, ...styles.submitBtn, ...(submitting ? styles.submitBtnDisabled : {}) }}
                onClick={handleSubmitPress}
                disabled={submitting}
              >
                {submitting
                  ? uploadProgress
                    ? `Uploading… ${Math.round(uploadProgress.done / uploadProgress.total * 100)}%`
                    : 'Submitting…'
                  : allComplete ? 'Submit Assessment' : 'Submit Assessment (*)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = {
  center: {
    flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: 24, minHeight: '100vh', backgroundColor: '#f5f7fa',
    flexDirection: 'column',
  },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#0070d2', borderRadius: 4,
    paddingTop: 10, paddingBottom: 10, paddingLeft: 24, paddingRight: 24,
    border: 'none', color: '#fff', fontWeight: '600',
  },
  pageTitleBand: {
    backgroundColor: '#ffffff',
    paddingLeft: 20, paddingRight: 20, paddingTop: 14, paddingBottom: 14,
    borderBottom: '1px solid #d8dde6', flexShrink: 0,
  },
  pageTitleText: { fontSize: 20, fontWeight: '700', color: '#1b1b38' },
  offlineBanner: {
    backgroundColor: '#fff3cd',
    paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderBottom: '1px solid #ffc107', flexShrink: 0,
  },
  offlineBannerText: { color: '#856404', fontSize: 12, fontWeight: '600' },
  categoryTitle: { fontSize: 16, fontWeight: '700', color: '#1b1b38', marginBottom: 16, marginTop: 0 },
  field: {
    backgroundColor: '#ffffff', borderRadius: 4, padding: 14,
    marginBottom: 8, border: '1px solid #d8dde6',
    display: 'flex', flexDirection: 'column',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#1b1b38', marginBottom: 10, lineHeight: '20px', display: 'block' },
  required: { color: '#d93025' },
  choiceRow: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10,
    borderRadius: 4, marginBottom: 4,
    backgroundColor: '#f8f9fb', border: '1px solid #d8dde6',
    width: '100%', textAlign: 'left',
  },
  choiceSelected: { backgroundColor: '#e8f0fe', borderColor: '#0070d2' },
  radio: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid #8a94a0', marginRight: 10, flexShrink: 0,
  },
  radioSelected: { borderColor: '#0070d2', backgroundColor: '#0070d2' },
  choiceLabel: { fontSize: 13, color: '#1b1b38', flex: 1 },
  choiceLabelSelected: { color: '#0070d2', fontWeight: '600' },
  textInput: {
    border: '1px solid #d8dde6', borderRadius: 4,
    padding: 10, fontSize: 13, color: '#1b1b38',
    backgroundColor: '#ffffff', width: '100%',
    outline: 'none', boxSizing: 'border-box',
  },
  attachmentNote: { fontSize: 13, color: '#67717e', fontStyle: 'italic' },
  checkbox: {
    width: 16, height: 16, borderRadius: 3,
    border: '2px solid #8a94a0', marginRight: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxSelected: { borderColor: '#0070d2', backgroundColor: '#0070d2' },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: '14px' },
  navRow: {
    display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 16, gap: 10,
  },
  navBtn: {
    flex: 1, paddingTop: 11, paddingBottom: 11, borderRadius: 4,
    border: '1px solid #d8dde6', backgroundColor: '#ffffff',
    fontSize: 13, fontWeight: '600', color: '#1b1b38',
  },
  navBtnPrimary: { backgroundColor: '#0070d2', borderColor: '#0070d2', color: '#ffffff' },
  submitBtn: { flex: 1, backgroundColor: '#0070d2', borderColor: '#0070d2', color: '#ffffff', fontWeight: '700' },
  submitBtnDisabled: { backgroundColor: '#8a94a0', borderColor: '#8a94a0', opacity: 0.7 },
  skuAccordion: { border: '1px solid #d8dde6', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  skuAccordionHeader: {
    display: 'flex', alignItems: 'center',
    backgroundColor: '#f2f4f7', paddingTop: 10, paddingBottom: 10,
    paddingLeft: 12, paddingRight: 12,
    border: 'none', width: '100%', textAlign: 'left',
  },
  skuAccordionTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1b1b38' },
  skuBadge: {
    backgroundColor: '#8a94a0', borderRadius: 10,
    paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
  },
  skuBadgeDone: { backgroundColor: '#3ba755' },
  skuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  skuAccordionBody: { padding: 12, backgroundColor: '#fff' },
  skuFieldLabel: { fontSize: 12, fontWeight: '600', color: '#1b1b38', marginBottom: 4, display: 'block' },
  skuFieldHint: { fontWeight: '400', color: '#67717e' },
};
