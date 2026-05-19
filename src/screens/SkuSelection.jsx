import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessmentStore } from '../store/assessmentStore';

function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid #e0e0e0', borderTopColor: '#0a2540',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

function extractSkus(assessment) {
  if (assessment.available_skus?.length) return assessment.available_skus;
  if (!assessment.description) return [];
  return assessment.description
    .split('\n')
    .filter(l => /^SKU:/i.test(l))
    .map((l, i) => ({
      sys_id: `sku_${i}`,
      label:  l.replace(/^SKU:\s*/i, '').trim(),
    }));
}

export default function SkuSelection() {
  const navigate = useNavigate();
  const [assessment,     setAssessment]     = useState(assessmentStore.get());
  const [assessing,      setAssessing]      = useState(() => extractSkus(assessmentStore.get() || {}));
  const [skipped,        setSkipped]        = useState([]);
  const [hiAssess,       setHiAssess]       = useState([]);
  const [hiSkip,         setHiSkip]         = useState([]);
  const [ready,          setReady]          = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    async function init() {
      let stored = assessment || await assessmentStore.hydrate();
      if (!stored) return;
      if (!assessment) setAssessment(stored);

      const committed = await assessmentStore.loadSkus();
      if (committed) {
        navigate('/player', { replace: true });
        return;
      }

      const draft = await assessmentStore.loadSkuDraft();
      const draftHasContent = draft && (draft.assessing.length > 0 || draft.skipped.length > 0);
      if (draftHasContent) {
        setAssessing(draft.assessing);
        setSkipped(draft.skipped);
      } else {
        setAssessing(extractSkus(stored));
      }
      setReady(true);
    }
    init();
  }, []);

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

  async function doStart() {
    setConfirmVisible(false);
    await assessmentStore.saveSkus(assessing);
    navigate('/player', { replace: true });
  }

  if (!assessment) {
    return (
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spinner />
      </div>
    );
  }

  const description = assessment.description || (() => {
    const cat = assessment.categories?.find(c => c.name === 'Audit Information');
    return cat?.questions?.find(q => q.name === 'Description')?.existing_string_value || null;
  })();

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <p style={s.title}>{assessment.title}</p>
        <p style={s.subtitle}>Remove any SKUs you won't be assessing today.</p>
        {description ? <p style={s.desc}>{description}</p> : null}
      </div>

      {/* Dual-list body */}
      <div style={s.body}>
        {/* Left: Assessing */}
        <div style={s.pane}>
          <div style={s.paneHeader}>
            <span style={s.paneTitle}>Assessing ({assessing.length})</span>
          </div>
          <div style={s.list}>
            {assessing.length === 0 && <span style={s.empty}>No SKUs selected</span>}
            {assessing.map(sk => {
              const hi = hiAssess.includes(sk.sys_id);
              return (
                <button
                  key={sk.sys_id}
                  style={{ ...s.item, ...(hi ? s.itemHi : {}) }}
                  onClick={() => toggleHiAssess(sk.sys_id)}
                >
                  <span style={{ ...s.itemText, ...(hi ? s.itemTextHi : {}) }}>{sk.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle buttons */}
        <div style={s.btnCol}>
          <button
            style={{ ...s.moveBtn, ...s.moveBtnSkip, ...(!hiAssess.length ? s.moveBtnDisabled : {}) }}
            onClick={skip}
            disabled={!hiAssess.length}
          >
            Skip &gt;&gt;
          </button>
          <button
            style={{ ...s.moveBtn, ...(!hiSkip.length ? s.moveBtnDisabled : {}) }}
            onClick={restore}
            disabled={!hiSkip.length}
          >
            &lt;&lt; Add Back
          </button>
        </div>

        {/* Right: Not Assessing */}
        <div style={s.pane}>
          <div style={{ ...s.paneHeader, ...s.paneHeaderSkip }}>
            <span style={s.paneTitle}>Not Assessing ({skipped.length})</span>
          </div>
          <div style={s.list}>
            {skipped.length === 0 && <span style={s.empty}>None removed</span>}
            {skipped.map(sk => {
              const hi = hiSkip.includes(sk.sys_id);
              return (
                <button
                  key={sk.sys_id}
                  style={{ ...s.item, ...(hi ? s.itemHi : {}) }}
                  onClick={() => toggleHiSkip(sk.sys_id)}
                >
                  <span style={{ ...s.itemText, ...(hi ? s.itemTextHi : {}) }}>{sk.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <button
          onClick={() => setConfirmVisible(true)}
          disabled={assessing.length === 0}
          style={{ ...s.startBtn, ...(assessing.length === 0 ? s.startBtnDisabled : {}) }}
        >
          Start Assessment{assessing.length > 0 ? ` (${assessing.length} SKU${assessing.length > 1 ? 's' : ''})` : ''}
        </button>
      </div>

      {/* Confirmation modal */}
      {confirmVisible && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            <p style={s.dialogTitle}>Start Assessment?</p>
            <p style={s.dialogMsg}>
              {`You're about to start with ${assessing.length} SKU${assessing.length !== 1 ? 's' : ''}. Once started, your SKU selection is locked and cannot be changed.`}
            </p>
            <div style={s.dialogBtns}>
              <button style={s.dialogCancel} onClick={() => setConfirmVisible(false)}>
                <span style={s.dialogCancelText}>Cancel</span>
              </button>
              <button style={s.dialogConfirm} onClick={doStart}>
                <span style={s.dialogConfirmText}>Start</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f2f4f7', position: 'relative' },

  header:   { backgroundColor: '#1b1b38', padding: 16, paddingTop: 20 },
  title:    { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4, marginTop: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subtitle: { fontSize: 12, color: '#a0a8c0', marginBottom: 6, marginTop: 0 },
  desc:     { fontSize: 12, color: '#a0a8c0', lineHeight: '18px', marginTop: 4, marginBottom: 0 },

  body: { flex: 1, display: 'flex', flexDirection: 'row', padding: 16, gap: 10, overflow: 'hidden' },
  pane: { flex: 1, border: '1px solid #d8dde6', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  paneHeader: { backgroundColor: '#293043', paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 },
  paneHeaderSkip: { backgroundColor: '#3d2020' },
  paneTitle: { color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center', display: 'block' },
  list: { backgroundColor: '#ffffff', flex: 1, overflowY: 'auto', minHeight: 200, display: 'flex', flexDirection: 'column' },
  empty: { padding: 12, color: '#67717e', fontSize: 13, textAlign: 'center', display: 'block' },
  item: {
    paddingTop: 9, paddingBottom: 9, paddingLeft: 12, paddingRight: 12,
    background: 'none', border: 'none', borderBottom: '1px solid #d8dde6',
    textAlign: 'left', width: '100%',
  },
  itemHi: { backgroundColor: '#e8f0fe' },
  itemText: { fontSize: 13, color: '#1b1b38' },
  itemTextHi: { color: '#0070d2', fontWeight: '600' },

  btnCol: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, width: 72 },
  moveBtn: {
    backgroundColor: '#293043', borderRadius: 4,
    paddingTop: 10, paddingBottom: 10, paddingLeft: 6, paddingRight: 6,
    border: 'none', color: '#fff', fontWeight: '600', fontSize: 12,
    textAlign: 'center', lineHeight: '18px',
  },
  moveBtnSkip:     { backgroundColor: '#5c1a1a' },
  moveBtnDisabled: { opacity: 0.35 },

  footer: { padding: 16, borderTop: '1px solid #d8dde6', backgroundColor: '#fff' },
  startBtn: { backgroundColor: '#0070d2', borderRadius: 4, paddingTop: 13, paddingBottom: 13, border: 'none', color: '#fff', fontWeight: '700', fontSize: 14, width: '100%' },
  startBtnDisabled: { opacity: 0.4 },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 100,
  },
  dialog: {
    backgroundColor: '#fff', borderRadius: 4, padding: 24,
    width: '85%', maxWidth: 400,
    border: '1px solid #d8dde6',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
  },
  dialogTitle:       { fontSize: 16, fontWeight: '700', color: '#1b1b38', marginBottom: 10, marginTop: 0 },
  dialogMsg:         { fontSize: 13, color: '#67717e', lineHeight: '20px', marginBottom: 24, marginTop: 0 },
  dialogBtns:        { display: 'flex', flexDirection: 'row', gap: 10 },
  dialogCancel:      { flex: 1, border: '1px solid #d8dde6', borderRadius: 4, paddingTop: 11, paddingBottom: 11, background: 'none' },
  dialogCancelText:  { color: '#67717e', fontWeight: '600', fontSize: 13 },
  dialogConfirm:     { flex: 1, backgroundColor: '#0070d2', borderRadius: 4, paddingTop: 11, paddingBottom: 11, border: 'none' },
  dialogConfirmText: { color: '#fff', fontWeight: '700', fontSize: 13 },
};
