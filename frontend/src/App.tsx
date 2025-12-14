import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';

interface AgentResponse {
  model: string;
  content: string;
  timestamp: string;
  error?: string;
  id?: string;
}

interface ConvergenceAssessment {
  isConverged: boolean;
  confidenceScore: number;
  reasoning: string;
}

interface DebateRound {
  roundNumber: number;
  responses: AgentResponse[];
  convergenceCheck?: ConvergenceAssessment;
}

interface DebateSession {
  id: string;
  config: any;
  status: string;
  rounds: DebateRound[];
  finalAnswer?: string;
  convergenceAssessment?: ConvergenceAssessment;
}

interface ChatBubbleData {
  id: string;
  type: 'user' | 'agent' | 'summary';
  author: string;
  content: string;
  timestamp: string;
  roundNumber?: number;
  collapsed?: boolean;
  convergenceCheck?: ConvergenceAssessment;
}

const AVAILABLE_MODELS = [
  'deepseek',
  'supermind-agent-v1',
  'gemini-2.5-pro',
  'gpt-5',
  'grok-4-fast'
];

function App() {
  const [apiKey, setApiKey] = useState('');
  const [topic, setTopic] = useState('What are the benefits of functional programming?');
  const [selectedModels, setSelectedModels] = useState<string[]>(['deepseek', 'gemini-2.5-pro']);
  const [maxRounds, setMaxRounds] = useState(5);
  const [convergenceThreshold, setConvergenceThreshold] = useState(0.8);
  const [moderatorModel, setModeratorModel] = useState('deepseek');
  const [synthesizerModel, setSynthesizerModel] = useState('deepseek');

  const [isDebating, setIsDebating] = useState(false);
  const [session, setSession] = useState<DebateSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);

  // Flattened chat history for bubbles
  const [chatHistory, setChatHistory] = useState<ChatBubbleData[]>([]);

  // Continuation state
  const [continuationInput, setContinuationInput] = useState('');

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, session?.finalAnswer]);

  const startDebate = async () => {
    if (!apiKey) {
      setError('Please enter an API Key');
      return;
    }

    setIsDebating(true);
    setError(null);
    setSession(null);
    setChatHistory([{
      id: uuidv4(),
      type: 'user',
      author: 'You',
      content: topic,
      timestamp: new Date().toISOString()
    }]);

    // Collapse config on start
    setIsConfigCollapsed(true);

    try {
      const res = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          models: selectedModels,
          maxRounds,
          convergenceThreshold,
          moderatorModel,
          synthesizerModel,
          apiKey
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      connectToStream(data.sessionId);

    } catch (err: any) {
      setError(err.message || 'Failed to start debate');
      setIsDebating(false);
      setIsConfigCollapsed(false);
    }
  };

  const continueDebate = async () => {
    if (!session || !continuationInput.trim()) return;

    // Add user bubble immediately
    const userMsg: ChatBubbleData = {
      id: uuidv4(),
      type: 'user',
      author: 'You',
      content: continuationInput,
      timestamp: new Date().toISOString()
    };

    // Clear final answer from session to remove the "Current Consensus" card
    setSession(prev => prev ? { ...prev, finalAnswer: undefined } : null);

    setChatHistory(prev => [...prev, userMsg]);
    setIsDebating(true);

    try {
      const res = await fetch(`/api/debate/${session.id}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: continuationInput })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setContinuationInput('');
      connectToStream(session.id);

    } catch (err: any) {
      setError(err.message || 'Failed to continue debate');
      setIsDebating(false);
    }
  };

  const connectToStream = (sessionId: string) => {
    const eventSource = new EventSource(`/api/debate/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'init') {
        const sess = message.session;
        setSession(sess);
      } else if (message.type === 'agent_response') {
        const response = message.response;
        setChatHistory(prev => {
          if (prev.some(m => m.content === response.content && m.author === response.model)) {
            return prev;
          }
          return [...prev, {
            id: uuidv4(),
            type: 'agent',
            author: response.model,
            content: response.content,
            timestamp: response.timestamp,
          }];
        });
      } else if (message.type === 'round') {
        setSession(prev => {
          if (!prev) return null;
          const existingRound = prev.rounds.find(r => r.roundNumber === message.round.roundNumber);
          if (existingRound) return prev;
          return {
            ...prev,
            rounds: [...prev.rounds, message.round]
          };
        });
      } else if (message.type === 'complete') {
        setSession(prev => {
          if (!prev) return null;
          return {
            ...prev,
            status: 'completed',
            finalAnswer: message.finalAnswer,
            convergenceAssessment: message.convergenceAssessment
          };
        });

        // Add summary bubble
        setChatHistory(prev => {
          // Mark all previous uncollapsed agent messages as collapsed
          const newHistory = prev.map(msg => {
            if (msg.type === 'agent' && !msg.collapsed) {
              return { ...msg, collapsed: true };
            }
            return msg;
          });

          // Add summary
          return [...newHistory, {
            id: uuidv4(),
            type: 'summary',
            author: 'Moderator',
            content: message.finalAnswer,
            timestamp: new Date().toISOString(),
            convergenceCheck: message.convergenceAssessment
          }];
        });

        eventSource.close();
        setIsDebating(false);
      } else if (message.type === 'error') {
        setError(message.error);
        eventSource.close();
        setIsDebating(false);
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE Error', e);
      eventSource.close();
      setIsDebating(false);
    };
  };

  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      if (selectedModels.length > 2) {
        setSelectedModels(selectedModels.filter(m => m !== model));
      }
    } else {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const toggleCollapse = (startIdx: number, endIdx: number) => {
    setChatHistory(prev => {
      const newHist = [...prev];
      // We can just toggle the first one in the group or store a separate mapping.
      // Easiest is to just toggle 'collapsed' for these items.
      for (let i = startIdx; i <= endIdx; i++) {
        if (newHist[i]) {
          newHist[i] = { ...newHist[i], collapsed: !newHist[i].collapsed };
        }
      }
      return newHist;
    });
  };

  return (
    <div className="min-h-screen bg-background text-primary p-4 md:p-8 font-sans">
      <header className="mb-8 text-center pt-10">
        <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-tight">
          Multi-Agent Debate Arena
        </h1>
        <p className="text-secondary mt-3 text-base font-light tracking-wide">Orchestrate debates between multiple AI models</p>
      </header>

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">

        {/* Configuration Panel */}
        <div className={`transition-all duration-300 ease-in-out ${isConfigCollapsed ? 'w-full md:w-16 h-fit overflow-hidden' : 'w-full md:w-1/3'}`}>
          <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-xl p-4 shadow-lg h-fit relative">
            <button
              onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
              className={`text-secondary hover:text-primary transition-all duration-300 z-10 ${isConfigCollapsed
                ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 hover:bg-gray-700/50 rounded-lg'
                : 'absolute top-4 right-4'
                }`}
              title={isConfigCollapsed ? "Expand Config" : "Collapse Config"}
            >
              {isConfigCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              )}
            </button>

            <h2 className={`text-lg font-medium mb-6 flex items-center gap-2 text-primary ${isConfigCollapsed ? 'hidden' : 'block'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Configuration
            </h2>

            {isConfigCollapsed && (
              <div className="w-full h-full flex flex-col items-center pt-10 gap-4" onClick={() => setIsConfigCollapsed(false)}>
                {/* Text removed as requested - Clean Icon View */}
              </div>
            )}

            <div className={`space-y-4 ${isConfigCollapsed ? 'hidden' : 'block'}`}>
              <div>
                <label className="block text-sm text-secondary mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full bg-white/50 border border-secondary/30 rounded p-2 focus:ring-2 focus:ring-secondary outline-none text-primary placeholder-primary/50"
                  placeholder="Enter AI Builder Token"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1">Topic</label>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-white/50 border border-secondary/30 rounded p-2 h-24 resize-none focus:ring-2 focus:ring-secondary outline-none text-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-2">Participating Models</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_MODELS.map(model => (
                    <button
                      key={model}
                      onClick={() => toggleModel(model)}
                      className={`p-2 text-xs rounded transition-colors ${selectedModels.includes(model)
                        ? 'bg-primary text-white'
                        : 'bg-white/50 text-secondary hover:bg-secondary/10'
                        }`}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Rounds: {maxRounds}</label>
                  <input
                    type="range" min="1" max="10"
                    value={maxRounds}
                    onChange={e => setMaxRounds(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Threshold: {convergenceThreshold}</label>
                  <input
                    type="range" min="0.1" max="1.0" step="0.1"
                    value={convergenceThreshold}
                    onChange={e => setConvergenceThreshold(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Moderator & Synthesizer</label>
                  <div className="flex gap-2">
                    <select
                      value={moderatorModel}
                      onChange={e => setModeratorModel(e.target.value)}
                      className="w-1/2 bg-white/50 border border-secondary/30 rounded p-2 text-xs text-primary"
                    >
                      {AVAILABLE_MODELS.map(m => <option key={m} value={m}>Mod: {m}</option>)}
                    </select>
                    <select
                      value={synthesizerModel}
                      onChange={e => setSynthesizerModel(e.target.value)}
                      className="w-1/2 bg-white/50 border border-secondary/30 rounded p-2 text-xs text-primary"
                    >
                      {AVAILABLE_MODELS.map(m => <option key={m} value={m}>Syn: {m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={startDebate}
                disabled={isDebating}
                className={`w-full py-3 rounded-lg font-bold transition-all text-white ${isDebating
                  ? 'bg-secondary/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-secondary hover:scale-[1.02] active:scale-[0.98]'
                  }`}
              >
                {isDebating ? 'Debate in Progress...' : 'Start Debate'}
              </button>

              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Debate Arena */}
        <div className={`flex-1 transition-all duration-300 ${isConfigCollapsed ? 'w-full' : 'w-full md:w-2/3'}`}>
          <div className="min-h-[600px] flex flex-col gap-6">

            {/* Chat Area */}
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-secondary py-32 border border-white/20 rounded-2xl bg-white/20 backdrop-blur-sm">
                <svg className="w-16 h-16 text-secondary/70 mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <p className="text-lg font-light tracking-wide">Ready to start the debate...</p>
              </div>
            ) : (
              <div className="space-y-6 pb-20">
                {chatHistory.map((bubble, idx) => {
                  if (bubble.type === 'summary') {
                    // Determine if we need to show a "Show Details" button for *previous* collapsed messages
                    // Logic: scan backwards from this summary to find collapsed group
                    // This simple map might be tricky for grouping without processing first.
                    // But we can just render.
                    return (
                      <div key={bubble.id} className="mt-8 bg-white/60 border border-white/50 p-8 rounded-2xl shadow-xl animate-fade-in backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                          </div>
                          <h3 className="text-lg font-medium text-primary tracking-wide">Current Consensus</h3>
                        </div>

                        <div className="prose prose-blue max-w-none text-primary/80 leading-relaxed font-medium mb-6">
                          <ReactMarkdown>{bubble.content}</ReactMarkdown>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-6 text-sm border-t border-gray-800/50 pt-6">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit border ${bubble.convergenceCheck?.isConverged ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                            {bubble.convergenceCheck?.isConverged ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            )}
                            <span className="font-medium text-xs uppercase tracking-wider">
                              {bubble.convergenceCheck?.isConverged ? 'Converged' : 'Not Converged'}
                            </span>
                          </div>

                          {bubble.convergenceCheck && (
                            <div className="flex items-center gap-3 text-secondary">
                              <span className="text-xs uppercase tracking-wider font-medium">Confidence</span>
                              <div className="h-1.5 w-24 bg-white rounded-full overflow-hidden border border-secondary/20">
                                <div
                                  className="h-full bg-secondary rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${bubble.convergenceCheck.confidenceScore * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono">{(bubble.convergenceCheck.confidenceScore * 100).toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Handle Collapsed Messages
                  if (bubble.collapsed) {
                    // Check if previous message was also collapsed to avoid rendering multiple buttons
                    const prevCollapsed = idx > 0 && chatHistory[idx - 1].collapsed;
                    if (prevCollapsed) return null; // Already handled by the "group" leader

                    // Count how many are collapsed in this sequence
                    let count = 1;
                    let i = idx + 1;
                    while (i < chatHistory.length && chatHistory[i].collapsed) {
                      count++;
                      i++;
                    }

                    return (
                      <div key={bubble.id + '-collapsed'} className="flex justify-center my-6 animate-fade-in">
                        <button
                          onClick={() => toggleCollapse(idx, idx + count - 1)}
                          className="group bg-white/50 hover:bg-white text-secondary hover:text-primary text-xs py-2 px-4 rounded-full border border-secondary/20 transition-all flex items-center gap-2 shadow-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          <span>Show {count} hidden messages</span>
                        </button>
                      </div>
                    );
                  }

                  // Handle Expanded Messages (that were previously collapsed or part of a group we want to re-collapse)
                  // We want to show a "Collapse" button at the TOP of a contiguous block of AGENT messages if they are expanded 
                  // and belong to a completed round (usually implied if followed by summary or if we just want to allow collapsing old logs).
                  // For simplicity, let's say: if it's an AGENT message, and it's starting a block of agent messages, 
                  // AND it is NOT the very last active thinking group (determined by isDebating maybe? or just simply offer it always for agent blocks).

                  // Let's check if this is the start of a contiguous agent block
                  const isAgentBlockStart = bubble.type === 'agent' && (idx === 0 || chatHistory[idx - 1].type !== 'agent' || chatHistory[idx - 1].collapsed);

                  if (isAgentBlockStart && !bubble.collapsed) {
                    // Find end of this block
                    let count = 0;
                    let i = idx;
                    while (i < chatHistory.length && chatHistory[i].type === 'agent' && !chatHistory[i].collapsed) {
                      count++;
                      i++;
                    }
                    const endIdx = i - 1;

                    // Only show collapse button if we have a group (count > 0). 
                    // Also maybe we only want to show it if there is a summary LATER, or just generally allow collapsing.
                    // The user request "When collapsed messages are expanded, add an option to collapse them again" implies 
                    // we should probably stick this button *before* the first message of the expanded group.

                    return (
                      <>
                        <div className="flex justify-center my-3 animate-fade-in">
                          <button
                            onClick={() => toggleCollapse(idx, endIdx)}
                            className="group bg-white/40 hover:bg-white/60 text-secondary hover:text-primary text-[10px] py-1.5 px-3 rounded-full border border-secondary/20 transition-all flex items-center gap-1.5 backdrop-blur-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-secondary group-hover:text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                            <span>Collapse {count} messages</span>
                          </button>
                        </div>
                        <div key={bubble.id} className={`flex ${bubble.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                          {/* Avatar Placeholder for Agents (Fixed) */}
                          {bubble.type !== 'user' && (
                            <div className="w-8 h-8 rounded-full bg-accent/30 border border-white/40 flex items-center justify-center mr-3 mt-1 shrink-0">
                              <span className="text-[10px] font-bold text-primary max-w-full text-center">{bubble.author.substring(0, 2).toUpperCase()}</span>
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${bubble.type === 'user'
                            ? 'bg-primary text-white rounded-br-none'
                            : 'bg-white/70 text-primary border border-white/50 rounded-bl-none'
                            }`}>
                            <div className="flex justify-between items-center mb-2 gap-4">
                              <span className={`text-xs font-bold tracking-wide uppercase ${bubble.type === 'user' ? 'text-accent' : 'text-secondary'}`}>
                                {bubble.author}
                              </span>
                              <span className="text-[10px] opacity-40 font-mono">
                                {new Date(bubble.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className={`prose prose-sm max-w-none leading-relaxed font-medium ${bubble.type === 'user' ? 'prose-invert text-white/90' : 'text-primary/80'}`}>
                              <ReactMarkdown>{bubble.content}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  }


                  // Normal Message Render
                  return (
                    <div key={bubble.id} className={`flex ${bubble.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                      {/* Avatar Placeholder for Agents */}
                      {bubble.type !== 'user' && (
                        <div className="w-8 h-8 rounded-full bg-accent/30 border border-white/40 flex items-center justify-center mr-3 mt-1 shrink-0">
                          <span className="text-[10px] font-bold text-primary">{bubble.author.substring(0, 2).toUpperCase()}</span>
                        </div>
                      )}

                      <div className={`max-w-[85%] rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${bubble.type === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-white/70 text-primary border border-white/50 rounded-bl-sm'
                        }`}>
                        <div className="flex justify-between items-center mb-2 gap-4">
                          <span className={`text-xs font-bold tracking-wide uppercase ${bubble.type === 'user' ? 'text-accent' : 'text-secondary'}`}>
                            {bubble.author}
                          </span>
                          <span className="text-[10px] opacity-40 font-mono">
                            {new Date(bubble.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`prose prose-sm max-w-none leading-relaxed font-medium ${bubble.type === 'user' ? 'prose-invert text-white/90' : 'text-primary/80'}`}>
                          <ReactMarkdown>{bubble.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isDebating && !session?.finalAnswer && (
                  <div className="flex items-center gap-3 text-gray-500 text-sm pl-4 animate-pulse mt-4">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="font-light tracking-wide">Agents are deliberating...</span>
                  </div>
                )}

                {/* Continuation Input */}
                {!isDebating && chatHistory.length > 0 && ( /* Only show if not debating and has history */
                  <div className="mt-8 animate-slide-up bg-white/40 p-6 sticky bottom-0 backdrop-blur-lg border-t border-white/30 z-10 rounded-t-xl">
                    <div className="max-w-4xl mx-auto">
                      <p className="text-secondary mb-3 text-sm ml-1 font-medium">Continue the discussion:</p>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={continuationInput}
                          onChange={e => setContinuationInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && continueDebate()}
                          placeholder="E.g., 'But what about the security implications?'"
                          className="flex-1 bg-white/80 border border-secondary/20 rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-secondary/50 outline-none transition-all hover:bg-white text-sm text-primary placeholder-primary/40"
                        />
                        <button
                          onClick={continueDebate}
                          disabled={!continuationInput.trim()}
                          className="bg-primary hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg hover:shadow-secondary/20 active:scale-95"
                        >
                          <span>Continue</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

