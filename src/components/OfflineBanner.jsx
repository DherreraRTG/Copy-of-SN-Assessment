import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div style={{
      backgroundColor: '#b45309',
      paddingTop: 8, paddingBottom: 8,
      paddingLeft: 16, paddingRight: 16,
      display: 'flex', justifyContent: 'center',
    }}>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
        ⚠ Offline — answers saved locally, will sync when reconnected
      </span>
    </div>
  );
}
