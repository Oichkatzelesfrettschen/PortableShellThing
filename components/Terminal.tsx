
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HistoryItem, NodeType, SyscallContext } from '../types';
import { initialFileSystem } from '../constants/initialFileSystem';
import { VFS } from '../kernel/VFS';
import { commands } from '../commands';

const CRT_EFFECT_CLASS = "relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,255,0,0.02))] before:bg-[length:100%_4px,3px_100%] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:animate-[flicker_0.1s_infinite] after:opacity-[0.03]";

export const Terminal: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [cwd, setCwd] = useState('/home/user');
  const [hostname, setHostname] = useState('nanokernel');
  const [username, setUsername] = useState('user');
  const [group, setGroup] = useState('user');
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interaction states
  const [passwordPrompt, setPasswordPrompt] = useState<{ prompt: string, resolve: (v: string) => void } | null>(null);
  const [editor, setEditor] = useState<{ filename: string, content: string, onSave: (v: string) => void } | null>(null);

  const vfsRef = useRef(new VFS(initialFileSystem));
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editor) editorRef.current?.focus();
    else if (isSearching) searchInputRef.current?.focus();
    else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [history, editor, isSearching, passwordPrompt]);

  useEffect(() => {
    const motd = vfsRef.current.getNode('/etc/motd', '/')?.content || "";
    setHistory([{
      command: 'system-init',
      output: [{ text: motd, type: 'system' }],
      cwd: '/',
      timestamp: Date.now()
    }]);
  }, []);

  const searchResult = useMemo(() => {
    if (!isSearching || !searchQuery) return '';
    return commandHistory.find(cmd => cmd.includes(searchQuery)) || '';
  }, [isSearching, searchQuery, commandHistory]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordPrompt) {
      const p = input;
      setInput('');
      const resolve = passwordPrompt.resolve;
      setPasswordPrompt(null);
      resolve(p);
      return;
    }

    let finalInput = isSearching ? (searchResult || searchQuery) : input;
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
    }

    const trimmedInput = finalInput.trim();
    if (!trimmedInput || isProcessing) return;

    setCommandHistory(prev => [trimmedInput, ...prev.filter(h => h !== trimmedInput)].slice(0, 50));
    setHistoryPointer(-1);

    const [cmdName, ...args] = trimmedInput.split(/\s+/);
    setIsProcessing(true);

    const newHistoryItem: HistoryItem = {
      command: trimmedInput,
      output: [],
      cwd,
      timestamp: Date.now()
    };

    const cmd = commands[cmdName];
    if (cmd) {
      try {
        const ctx: SyscallContext = {
          args,
          vfs: vfsRef.current,
          cwd,
          username,
          group,
          hostname,
          setCwd: setCwd,
          setHostname: setHostname,
          setUser: (u, g) => { setUsername(u); setGroup(g); },
          clear: () => setHistory([]),
          openEditor: (f, c, s) => setEditor({ filename: f, content: c, onSave: s }),
          promptPassword: (prompt) => new Promise(resolve => setPasswordPrompt({ prompt, resolve })),
        };
        const result = await cmd.execute(ctx);
        if (Array.isArray(result)) {
          newHistoryItem.output = result.map(text => ({ text, type: 'default' }));
        } else if (result) {
          newHistoryItem.output = [{ text: result, type: 'default' }];
        }
      } catch (error) {
        newHistoryItem.output = [{ text: `System Error: ${error}`, type: 'error' }];
      }
    } else {
      newHistoryItem.output = [{ text: `sh: command not found: ${cmdName}`, type: 'error' }];
    }

    if (cmdName !== 'clear' && !editor) setHistory(prev => [...prev, newHistoryItem]);
    setInput('');
    setIsProcessing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (passwordPrompt) return;
    if (e.ctrlKey && e.key === 'r') { e.preventDefault(); setIsSearching(true); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyPointer < commandHistory.length - 1) {
        const next = historyPointer + 1;
        setHistoryPointer(next);
        setInput(commandHistory[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer > 0) {
        const next = historyPointer - 1;
        setHistoryPointer(next);
        setInput(commandHistory[next]);
      } else { setHistoryPointer(-1); setInput(''); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const matches = Object.keys(commands).filter(c => c.startsWith(input));
      if (matches.length === 1) setInput(matches[0]);
    } else if (e.key === 'Escape') setIsSearching(false);
  };

  if (editor) {
    return (
      <div className={`flex-1 flex flex-col bg-black rounded-lg shadow-2xl border border-green-900/30 font-mono text-green-400 ${CRT_EFFECT_CLASS}`}>
        <div className="bg-blue-900 text-white px-4 py-1 flex justify-between text-sm">
          <span>nano 5.4</span>
          <span>{editor.filename}</span>
          <span>[Modified]</span>
        </div>
        <textarea
          ref={editorRef}
          value={editor.content}
          onChange={(e) => setEditor({ ...editor, content: e.target.value })}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'x') { e.preventDefault(); setEditor(null); }
            if (e.ctrlKey && e.key === 'o') { e.preventDefault(); editor.onSave(editor.content); }
          }}
          className="flex-1 bg-transparent p-4 outline-none border-none resize-none text-green-400"
          spellCheck="false"
        />
        <div className="bg-gray-800 text-[10px] p-2 flex gap-4 text-white uppercase">
          <span>^O WriteOut</span>
          <span>^X Exit</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex-1 flex flex-col bg-black p-6 rounded-lg shadow-2xl border border-green-900/30 font-mono text-green-400 ${CRT_EFFECT_CLASS}`}
      onClick={() => (isSearching ? searchInputRef.current : inputRef.current)?.focus()}
    >
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        .custom-cursor::after {
          content: ''; display: inline-block; width: 8px; height: 1.2em;
          background: #4ade80; vertical-align: middle; margin-left: 2px;
          animation: blink 1s step-end infinite;
        }
      `}</style>

      <div className="flex-1 overflow-y-auto terminal-output space-y-2 pr-2">
        {history.map((item, idx) => (
          <div key={idx} className="mb-4">
            {item.command !== 'system-init' && (
              <div className="flex gap-2 opacity-80">
                <span className="text-blue-400 font-bold">{username}@{hostname}</span>
                <span className="text-purple-400">{item.cwd}</span>
                <span className="text-white">$ {item.command}</span>
              </div>
            )}
            <div className="pl-4 mt-1">
              {item.output.map((line, lIdx) => (
                <pre key={lIdx} className={`whitespace-pre-wrap ${
                  line.type === 'error' ? 'text-red-400' : 
                  line.type === 'system' ? 'text-yellow-400 italic' : 
                  'text-green-400'
                }`} style={{ textShadow: '0 0 5px rgba(74, 222, 128, 0.4)' }}>
                  {line.text}
                </pre>
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleCommand} className="mt-4 flex gap-2 items-center relative min-h-[1.5em]">
        {passwordPrompt ? (
          <div className="flex-1 flex gap-2">
            <span className="text-white">{passwordPrompt.prompt}</span>
            <input
              ref={inputRef}
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              className="bg-transparent border-none outline-none text-green-400 w-full"
            />
          </div>
        ) : isSearching ? (
          <div className="flex-1 flex gap-2 text-white italic">
            <span className="text-blue-400">(reverse-i-search)'</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-yellow-400 w-32"
            />
            <span>': {searchResult}</span>
          </div>
        ) : (
          <>
            <div className="flex gap-2 shrink-0">
              <span className={`${username === 'root' ? 'text-red-500' : 'text-blue-400'} font-bold`}>{username}@{hostname}</span>
              <span className="text-purple-400">{cwd}</span>
              <span className="text-white">{username === 'root' ? '#' : '$'}</span>
            </div>
            <div className="flex-1 relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                autoFocus
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-transparent border-none outline-none text-green-400 caret-transparent"
                disabled={isProcessing}
              />
              <div className="absolute left-0 pointer-events-none whitespace-pre">
                <span className="text-green-400">{input}</span>
                {!isProcessing && <span className="custom-cursor"></span>}
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  );
};
