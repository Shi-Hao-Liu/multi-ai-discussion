/**
 * AI Builder API Client
 * Handles communication with the AI Builder API at https://space.ai-builders.com/backend
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  id: string;
  choices: { message: Message; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class AIBuilderClient {
  private readonly baseUrl = 'https://space.ai-builders.com/backend';
  private readonly authToken: string;

  constructor(authToken: string) {
    if (!authToken) {
      throw new Error('Authentication token is required');
    }
    this.authToken = authToken;
  }

  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data as ChatResponse;
  }
}