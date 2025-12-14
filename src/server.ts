
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { AIBuilderClient } from './debate/client';
import { DebateOrchestrator } from './debate/orchestrator';
import { createDefaultConfig } from './debate/config';
import { AVAILABLE_MODELS } from './debate';
import { DebateSession } from './debate/session';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Store active sessions in memory (for simplicity)
// In a real app, this should be in a database or Redis
const sessions: Map<string, {
    session: DebateSession,
    orchestrator: DebateOrchestrator,
    clients: express.Response[]
}> = new Map();

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API: Get available models
app.get('/api/models', (req, res) => {
    res.json(AVAILABLE_MODELS);
});

// API: Start a debate
app.post('/api/debate', async (req, res) => {
    try {
        const {
            topic,
            models,
            maxRounds,
            convergenceThreshold,
            moderatorModel,
            synthesizerModel
        } = req.body;

        // Use AI_BUILDER_TOKEN from environment instead of requiring from client
        const apiKey = process.env.AI_BUILDER_TOKEN;
        if (!apiKey) {
            return res.status(500).json({ error: 'AI_BUILDER_TOKEN environment variable is not configured' });
        }

        const client = new AIBuilderClient(apiKey);
        const orchestrator = new DebateOrchestrator(client);

        const config = createDefaultConfig(topic, models);
        if (maxRounds) config.maxRounds = maxRounds;
        if (convergenceThreshold) config.convergenceThreshold = convergenceThreshold;
        if (moderatorModel) config.moderatorModel = moderatorModel;
        if (synthesizerModel) config.synthesizerModel = synthesizerModel;

        const session = orchestrator.createSession(config);

        // Store session and prepare for streaming
        sessions.set(session.id, {
            session,
            orchestrator,
            clients: []
        });

        // Start processing in background (don't await here)
        runDebateInBackground(session.id);

        res.json({ sessionId: session.id });
    } catch (error: any) {
        console.error('Error starting debate:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Continue a debate
app.post('/api/debate/:id/continue', async (req, res) => {
    try {
        const { id } = req.params;
        const { instructions } = req.body;

        const sessionData = sessions.get(id);
        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Logic to clear "completed" state if needed and start running again
        // We'll run in background similar to start
        runDebateInBackground(id, true, instructions);

        res.json({ success: true, message: 'Debate continuing' });
    } catch (error: any) {
        console.error('Error continuing debate:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: SSE Stream for a debate session
app.get('/api/debate/:id/stream', (req, res) => {
    const { id } = req.params;
    const sessionData = sessions.get(id);

    if (!sessionData) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Add client to active clients list
    sessionData.clients.push(res);

    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'init', session: sessionData.session })}\n\n`);

    // Remove client on disconnect
    req.on('close', () => {
        const index = sessionData.clients.indexOf(res);
        if (index !== -1) {
            sessionData.clients.splice(index, 1);
        }
    });
});

async function runDebateInBackground(sessionId: string, isContinuation: boolean = false, instructions?: string) {
    const sessionData = sessions.get(sessionId);
    if (!sessionData) return;

    const { orchestrator, session } = sessionData;

    try {
        const onRoundComplete = (round: any) => {
            // Broadcast round update
            broadcast(sessionId, { type: 'round', round });
        };

        const onAgentResponse = (response: any) => {
            broadcast(sessionId, { type: 'agent_response', response });
        };

        let result;
        if (isContinuation && instructions) {
            // We need to inject the instructions into the context somehow.
            // For now, let's append it to the topic so it persists, or handle it via a new mechanism
            // Ideally we'd have a 'turns' array, but sticking to the current 'rounds' model:
            // We can treat it as a Topic Update or just rely on the fact that Orchestrator.continueDebate
            // will handle it (if we implemented it fully).
            // NOTE: In the orchestrator change above, I didn't fully implement "inject instructions into context".
            // Let's do a quick fix: Append to topic or assume `continueDebate` does the right thing.
            // Since `continueDebate` just calls `runDebate`, we might need to update the topic locally here.
            session.config.topic += `\n\n[User Intervention]: ${instructions}`;

            result = await orchestrator.continueDebate(session, instructions, onRoundComplete, onAgentResponse);
        } else {
            result = await orchestrator.runDebate(session, onRoundComplete, onAgentResponse);
        }

        // Broadcast completion
        broadcast(sessionId, {
            type: 'complete',
            finalAnswer: result.finalAnswer,
            convergenceAssessment: session.convergenceAssessment
        });

    } catch (error: any) {
        broadcast(sessionId, { type: 'error', error: error.message });
    }
}

function broadcast(sessionId: string, data: any) {
    const sessionData = sessions.get(sessionId);
    if (!sessionData) return;

    sessionData.clients.forEach(client => {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
}

// Fallback to index.html for SPA routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
