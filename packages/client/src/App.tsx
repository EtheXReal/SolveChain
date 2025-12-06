/**
 * 应用入口
 * 支持 v1（决策图）和 v2（项目-场景）两种模式
 */

import { useState } from 'react';
import { ThemeProvider } from './themes/ThemeContext';
import Home from './pages/Home';
import Editor from './pages/Editor';
import ProjectList from './pages/ProjectList';
import ProjectEditor from './pages/ProjectEditor';

type View =
  | { type: 'home' }
  | { type: 'editor'; graphId: string }
  | { type: 'projects' }
  | { type: 'project-editor'; projectId: string };

// 切换是否使用 v2.0 项目模式
const USE_V2_MODE = true;

export default function App() {
  const [view, setView] = useState<View>(USE_V2_MODE ? { type: 'projects' } : { type: 'home' });

  // v1 模式
  const handleSelectGraph = (graphId: string) => {
    setView({ type: 'editor', graphId });
  };

  // v2 模式
  const handleSelectProject = (projectId: string) => {
    setView({ type: 'project-editor', projectId });
  };

  const handleBack = () => {
    setView(USE_V2_MODE ? { type: 'projects' } : { type: 'home' });
  };

  const renderContent = () => {
    switch (view.type) {
      case 'editor':
        return <Editor graphId={view.graphId} onBack={handleBack} />;
      case 'projects':
        return <ProjectList onSelectProject={handleSelectProject} />;
      case 'project-editor':
        return <ProjectEditor projectId={view.projectId} onBack={handleBack} />;
      case 'home':
      default:
        return <Home onSelectGraph={handleSelectGraph} />;
    }
  };

  return (
    <ThemeProvider>
      {renderContent()}
    </ThemeProvider>
  );
}
