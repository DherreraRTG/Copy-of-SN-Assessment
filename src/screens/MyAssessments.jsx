import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchAssessmentByInstance, setSnInstance } from '../services/assessmentService';
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

export default function MyAssessments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading]   = useState(false);
  const [resumable, setResumable] = useState(false);

  useEffect(() => {
    assessmentStore.hydrate().then(p => setResumable(!!p));
  }, []);

  useEffect(() => {
    const instanceSysId = searchParams.get('instance_sys_id');
    if (!instanceSysId) return;
    const snInstance = searchParams.get('sn_instance') || null;
    setSnInstance(snInstance).then(() =>
      loadById(instanceSysId, searchParams.get('task_sys_id') || null)
    );
  }, [searchParams.get('instance_sys_id')]);

  async function loadById(id, taskSysId = null) {
    setLoading(true);
    try {
      await assessmentStore.clear();
      const payload = await fetchAssessmentByInstance(id);
      if (taskSysId) payload.task_sys_id = taskSysId;
      await assessmentStore.set(payload, id);
      setResumable(false);
      navigate('/sku-selection');
    } catch (e) {
      window.alert('Failed to Load: ' + (e.message || 'Could not reach ServiceNow. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={s.container}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={s.container}>
      <p style={s.heading}>NPM Assessment</p>
      <p style={s.sub}>Open an assessment from ServiceNow to get started.</p>
      {resumable && !searchParams.get('instance_sys_id') && (
        <button style={s.resumeBtn} onClick={() => navigate('/player')}>
          Resume In-Progress Assessment
        </button>
      )}
    </div>
  );
}

const s = {
  container: {
    flex: 1, backgroundColor: '#f2f4f7',
    padding: 24, display: 'flex', flexDirection: 'column',
    justifyContent: 'center', minHeight: '100vh',
  },
  heading: { fontSize: 22, fontWeight: '700', color: '#1b1b38', marginBottom: 8, marginTop: 0 },
  sub: { fontSize: 13, color: '#67717e', marginBottom: 28, lineHeight: '20px', marginTop: 0 },
  resumeBtn: {
    backgroundColor: '#0070d2', borderRadius: 4,
    paddingTop: 13, paddingBottom: 13,
    border: 'none', color: '#ffffff', fontWeight: '600', fontSize: 14,
    width: '100%', textAlign: 'center',
  },
};
