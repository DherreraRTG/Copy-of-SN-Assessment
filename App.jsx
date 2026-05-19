import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MyAssessments from './src/screens/MyAssessments';
import SkuSelection from './src/screens/SkuSelection';
import AssessmentPlayer from './src/screens/AssessmentPlayer';
import SubmissionSuccess from './src/screens/SubmissionSuccess';
import ErrorScreen from './src/screens/ErrorScreen';
import { initAuth, completeAssessment } from './src/services/assessmentService';
import { assessmentStore } from './src/store/assessmentStore';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_ACTIVATED' && !sessionStorage.getItem('sw_primed')) {
        sessionStorage.setItem('sw_primed', '1');
        window.location.reload();
      }
    });
  });
}

export default function App() {
  useEffect(() => {
    initAuth().catch(() => {});

    async function retryPendingComplete() {
      try {
        const pending = await assessmentStore.loadPendingComplete();
        if (!pending?.instanceId) return;
        await completeAssessment(pending.instanceId);
        await assessmentStore.clearPendingComplete();
      } catch (_) {}
    }
    retryPendingComplete();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<MyAssessments />} />
        <Route path="/assessment" element={<MyAssessments />} />
        <Route path="/sku-selection" element={<SkuSelection />} />
        <Route path="/player"     element={<AssessmentPlayer />} />
        <Route path="/success"    element={<SubmissionSuccess />} />
        <Route path="/error"      element={<ErrorScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
