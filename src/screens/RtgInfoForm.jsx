import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getResponse } from '../db';

const FIELDS = [
  { key: 'o',           label: 'Order Number',    placeholder: 'e.g. 12345' },
  { key: 'r',           label: 'Route',            placeholder: 'e.g. RT-001' },
  { key: 's',           label: 'Stop',             placeholder: 'e.g. 1' },
  { key: 'd',           label: 'Division',         placeholder: 'e.g. Living Room' },
  { key: 'dt',          label: 'Delivery Type',    placeholder: 'e.g. Standard' },
  { key: 'dd',          label: 'Delivery Date',    placeholder: 'YYYY-MM-DD' },
  { key: 'da',          label: 'Delivery Account', placeholder: 'e.g. ACC-001' },
  { key: 'rep',         label: 'Rep Name',         placeholder: 'Your full name' },
  { key: 'disposition', label: 'Disposition',      placeholder: '' },
];

const EMPTY_FORM = Object.fromEntries(FIELDS.map(f => [f.key, '']));

export default function RtgInfoForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sys_id, title } = location.state || {};
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!sys_id) return;
    getResponse(sys_id).then(draft => {
      if (draft?.rtg_info) setForm(prev => ({ ...prev, ...draft.rtg_info }));
    });
  }, []);

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handleStart() {
    navigate('/player', { state: { sys_id, rtg_info: form } });
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <p style={s.title}>{title}</p>
        <p style={s.sub}>Enter audit details before starting</p>
      </div>

      <div style={s.scroll}>
        <div style={s.content}>
          {FIELDS.map(f => (
            <div key={f.key} style={s.field}>
              <label style={s.label}>{f.label}</label>
              <input
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                style={s.input}
                autoCorrect="off"
                autoCapitalize="none"
              />
            </div>
          ))}
        </div>
      </div>

      <div style={s.footer}>
        <button onClick={handleStart} style={s.startBtn}>Start Assessment</button>
      </div>
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f8fafc' },
  header:    { backgroundColor: '#0a2540', padding: 16, paddingTop: 20 },
  title:     { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4, marginTop: 0 },
  sub:       { fontSize: 13, color: '#94a3b8', margin: 0 },
  scroll:    { flex: 1, overflowY: 'auto' },
  content:   { padding: 16, display: 'flex', flexDirection: 'column', gap: 16 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:     { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: {
    border: '1px solid #cbd5e1', borderRadius: 8,
    paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
    backgroundColor: '#fff', color: '#0f172a', fontSize: 14,
    outline: 'none',
  },
  footer:   { padding: 16, borderTop: '1px solid #e2e8f0', backgroundColor: '#fff' },
  startBtn: {
    backgroundColor: '#0a2540', borderRadius: 8,
    paddingTop: 14, paddingBottom: 14, width: '100%',
    border: 'none', color: '#fff', fontWeight: '700', fontSize: 15,
  },
};
