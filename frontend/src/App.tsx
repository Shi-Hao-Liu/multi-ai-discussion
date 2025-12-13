import { useState } from 'react'

interface AgentResponse {
  model: string;
  content: string;
  timestamp: string;
  error?: string;
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
  status: string;
  rounds: DebateRound[];
  finalAnswer?: string;
  convergenceAssessment?: ConvergenceAssessment;
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

  const startDebate = async () => {
    if (!apiKey) {
      setError('Please enter an API Key');
      return;
    }

    setIsDebating(true);
    setError(null);
    setSession(null);

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
      const sessionId = data.sessionId;

      // Start listening to SSE
      const eventSource = new EventSource(`/api/debate/${sessionId}/stream`);

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'init') {
          setSession(message.session);
        } else if (message.type === 'round') {
          setSession(prev => {
            if (!prev) return null;
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

    } catch (err: any) {
      setError(err.message || 'Failed to start debate');
      setIsDebating(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Multi-Agent Debate Arena
        </h1>
        <p className="text-gray-400 mt-2">Orchestrate debates between multiple AI models</p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Configuration Panel */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-fit">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            ⚙️ Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter AI Builder Token"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Topic</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Participating Models</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_MODELS.map(model => (
                  <button
                    key={model}
                    onClick={() => toggleModel(model)}
                    className={`p-2 text-xs rounded transition-colors ${selectedModels.includes(model)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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

            {/* Moderator & Synthesizer Selection */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Moderator</label>
                <select
                  value={moderatorModel}
                  onChange={e => setModeratorModel(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {AVAILABLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Synthesizer</label>
                <select
                  value={synthesizerModel}
                  onChange={e => setSynthesizerModel(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {AVAILABLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={startDebate}
              disabled={isDebating}
              className={`w-full py-3 rounded-lg font-bold transition-all ${isDebating
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-[1.02] active:scale-[0.98]'
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

        {/* Debate Arena */}
        <div className="lg:col-span-2 space-y-6">
          {!session ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 py-20 border-2 border-dashed border-gray-800 rounded-xl">
              <span className="text-6xl mb-4">🗣️</span>
              <p>Ready to start the debate...</p>
            </div>
          ) : (
            <>
              {/* Converged Status */}
              {session.finalAnswer && (
                <div className="bg-green-900/20 border border-green-700/50 p-6 rounded-xl animate-fade-in">
                  <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                    ✅ Final Consensus Reached
                  </h3>
                  <div className="prose prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{session.finalAnswer}</p>
                  </div>
                  {session.convergenceAssessment && (
                    <div className="mt-4 text-sm text-green-300/60 border-t border-green-800/50 pt-2">
                      Confidence Score: {(session.convergenceAssessment.confidenceScore * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}

              {/* Rounds */}
              <div className="space-y-8">
                {session.rounds.map((round, idx) => (
                  <div key={idx} className="relative pl-8 border-l-2 border-gray-700 pb-8 last:border-0 last:pb-0 animate-slide-up">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-gray-900" />

                    <h3 className="text-lg font-mono text-blue-400 mb-4">
                      Round {round.roundNumber}
                    </h3>

                    <div className="grid gap-4">
                      {round.responses.map((resp, rIdx) => (
                        <div key={rIdx} className="bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-700/50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm px-2 py-1 rounded bg-gray-700 text-purple-300">
                              {resp.model}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(resp.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {resp.content}
                          </p>
                        </div>
                      ))}
                    </div>

                    {round.convergenceCheck && (
                      <div className="mt-4 p-3 bg-gray-800/50 border border-gray-700 rounded text-sm text-gray-400 italic">
                        🤖 Moderator: {round.convergenceCheck.reasoning}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isDebating && !session.finalAnswer && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-pulse text-blue-400 font-mono">
                    Agents are deliberating...
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
