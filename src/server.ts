
import express from 'express';
import cors from 'cors';
import path from 'path';
import { AIBuilderClient } from './debate/client';
import { DebateOrchestrator } from './debate/orchestrator';
import { createDefaultConfig } from './debate/config';
import { AVAILABLE_MODELS } from './debate';
import { DebateSession } from './debate/session';

const app = express();
const PORT = process.env.PORT || 3000;

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
            synthesizerModel,
            apiKey
        } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key is required' });
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

async function runDebateInBackground(sessionId: string) {
    const sessionData = sessions.get(sessionId);
    if (!sessionData) return;

    const { orchestrator, session } = sessionData;

    try {
        const result = await orchestrator.runDebate(session, (round) => {
            // Broadcast round update
            broadcast(sessionId, { type: 'round', round });
        });

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
