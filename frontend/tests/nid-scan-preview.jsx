import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import NidScanPreview from '../src/components/NidScanPreview';
import '../src/index.css';

export default function Preview() {
  const [stage, setStage] = useState('reading');
  return <main style={{ maxWidth: 600, margin: '24px auto', padding: 16 }}>
    <h1 className="mb-4 text-xl font-bold">NID scanner preview QA</h1>
    <label>Stage <select value={stage} onChange={e => setStage(e.target.value)}>
      <option value="prepare">Preparing</option><option value="reading">Reading</option>
      <option value="retry">Retry</option><option value="done">Stopped</option>
    </select></label>
    <div className="mt-4"><NidScanPreview preview={stage === 'prepare' ? '' : '/tests/nid-scan-fixture.png'} scanning={stage !== 'done'} progress={42} pass={stage === 'retry' ? 2 : 1} lang="bn" /></div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
