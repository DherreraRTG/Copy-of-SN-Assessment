import { useNavigate, useLocation } from 'react-router-dom';

const ERRORS = {
  auth: {
    icon: '🔐',
    title: 'Authentication Failed',
    message: "We couldn't connect to ServiceNow. This is usually a temporary issue.",
  },
  network: {
    icon: '📡',
    title: 'No Connection',
    message: 'Check your Wi-Fi or mobile data and try again.',
  },
  notfound: {
    icon: '🔍',
    title: 'Assessment Not Found',
    message: "We couldn't find this assessment. It may have been completed or removed.",
  },
  default: {
    icon: '⚠️',
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

function classify(message = '') {
  const m = message.toLowerCase();
  if (m.includes('auth') || m.includes('401') || m.includes('403') || m.includes('oauth')) return 'auth';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch') || m.includes('err_failed')) return 'network';
  if (m.includes('404') || m.includes('not found')) return 'notfound';
  return 'default';
}

export default function ErrorScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { message, onRetry } = location.state || {};
  const type = classify(message);
  const { icon, title, message: friendlyMessage } = ERRORS[type];

  function handleRetry() {
    if (onRetry) {
      onRetry();
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <span style={s.icon}>{icon}</span>
        <p style={s.title}>{title}</p>
        <p style={s.message}>{friendlyMessage}</p>

        {message ? (
          <div style={s.detailBox}>
            <span style={s.detailText}>{message}</span>
          </div>
        ) : null}

        <button style={s.btn} onClick={handleRetry}>Try Again</button>
        <button style={s.secondaryBtn} onClick={() => navigate('/', { replace: true })}>
          Go to Home
        </button>
      </div>
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
    backgroundColor: '#fff', borderRadius: 4, padding: 32,
    width: '100%', maxWidth: 440,
    border: '1px solid #d8dde6',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  icon:    { fontSize: 40, marginBottom: 16, display: 'block' },
  title:   { fontSize: 18, fontWeight: '700', color: '#1b1b38', marginBottom: 8, textAlign: 'center', marginTop: 0 },
  message: { fontSize: 13, color: '#67717e', textAlign: 'center', lineHeight: '20px', marginBottom: 16, marginTop: 0 },
  detailBox: {
    backgroundColor: '#fef2f2', borderRadius: 4, padding: 12,
    width: '100%', marginBottom: 24, border: '1px solid #fecaca',
  },
  detailText: { fontSize: 11, color: '#991b1b', fontFamily: 'monospace', textAlign: 'center', display: 'block' },
  btn: {
    backgroundColor: '#0070d2', borderRadius: 4,
    paddingTop: 12, paddingBottom: 12, width: '100%',
    marginBottom: 10, border: 'none',
    color: '#fff', fontWeight: '700', fontSize: 14,
  },
  secondaryBtn: {
    paddingTop: 8, paddingBottom: 8, width: '100%',
    background: 'none', border: 'none',
    color: '#67717e', fontSize: 13,
  },
};
