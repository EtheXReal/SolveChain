/**
 * 应用入口
 */

import { useState } from 'react';
import Home from './pages/Home';
import Editor from './pages/Editor';

type View = { type: 'home' } | { type: 'editor'; graphId: string };

export default function App() {
  const [view, setView] = useState<View>({ type: 'home' });

  const handleSelectGraph = (graphId: string) => {
    setView({ type: 'editor', graphId });
  };

  const handleBack = () => {
    setView({ type: 'home' });
  };

  switch (view.type) {
    case 'editor':
      return <Editor graphId={view.graphId} onBack={handleBack} />;
    case 'home':
    default:
      return <Home onSelectGraph={handleSelectGraph} />;
  }
}
