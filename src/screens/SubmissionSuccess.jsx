import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function SubmissionSuccess() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { instanceNumber, answered, skipped, submittedAt } = location.state || {};
  const [closeFailed, setCloseFailed] = useState(false);

  const time = submittedAt
    ? new Date(submittedAt).toLocaleString()
    : new Date().toLocaleString();

  function handleClose() {
    window.close();
    setTimeout(() => setCloseFailed(true), 300);
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.iconWrap}>
          <span style={s.icon}>✓</span>
        </div>

        <p style={s.heading}>Submitted Successfully</p>
        <p style={s.sub}>Your assessment has been submitted to ServiceNow.</p>

        <div style={s.divider} />
        <Row label="Submitted at" value={time} />
        <div style={s.divider} />

        {closeFailed ? (
          <p style={s.closeHint}>You can now close this tab.</p>
        ) : (
          <button style={s.btn} onClick={handleClose}>Close Window</button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  );
}

const s = {
  container: {
    flex: 1, backgroundColor: '#f2f4f7',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: 24, minHeight: '100vh',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 4, padding: 28,
    width: '100%', maxWidth: 480,
    border: '1px solid #d8dde6',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: '50%',
    backgroundColor: '#e3f5e9',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  icon:    { fontSize: 32 },
  heading: { fontSize: 20, fontWeight: '700', color: '#1b1b38', marginBottom: 8, textAlign: 'center', marginTop: 0 },
  sub:     { fontSize: 13, color: '#67717e', textAlign: 'center', lineHeight: '20px', marginBottom: 4, marginTop: 0 },
  divider: { height: 1, backgroundColor: '#d8dde6', width: '100%', marginTop: 20, marginBottom: 20 },
  row: {
    display: 'flex', justifyContent: 'space-between',
    width: '100%', paddingTop: 5, paddingBottom: 5,
  },
  rowLabel: { fontSize: 13, color: '#67717e' },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#1b1b38', flexShrink: 1, textAlign: 'right', marginLeft: 16 },
  btn: {
    marginTop: 4, backgroundColor: '#0070d2', borderRadius: 4,
    paddingTop: 13, paddingBottom: 13, width: '100%',
    border: 'none', color: '#fff', fontWeight: '700', fontSize: 14,
  },
  closeHint: { marginTop: 4, fontSize: 13, color: '#67717e', textAlign: 'center' },
};
