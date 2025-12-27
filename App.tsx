
import React from 'react';
import { Terminal } from './components/Terminal';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] text-green-400 font-mono p-4 sm:p-8 flex flex-col justify-center">
      <div className="max-w-5xl w-full mx-auto flex flex-col h-[85vh] relative">
        <div className="absolute -inset-1 bg-green-900/20 blur-xl pointer-events-none"></div>
        <header className="mb-4 flex justify-between items-center text-xs opacity-50 uppercase tracking-widest px-2">
          <div>POSIX Nanokernel Simulation</div>
          <div>State: Optimal // Hardware: Virtualized</div>
        </header>
        <Terminal />
        <footer className="mt-4 text-[10px] text-center opacity-30">
          BREAKTHROUGH DESIGN // VIRTUAL MICRO-BUS IPC ENABLED // GEMINI AI INTEGRATED
        </footer>
      </div>
    </div>
  );
};

export default App;
