/**
 * RoundManager - Executes debate rounds
 * Handles building context, sending concurrent requests, and collecting responses
 * Requirements: 3.1, 3.2, 3.3
 */

import { AIBuilderClient, type Message } from './client';
import { type DebateSession, type DebateRound, type AgentResponse } from './session';

export class RoundManager {
  private client: AIBuilderClient;

  constructor(client: AIBuilderClient) {
    this.client = client;
  }

  /**
   * Executes a single debate round
   * @param session - The current debate session
   * @returns Promise resolving to the completed round
   */
  async executeRound(session: DebateSession): Promise<DebateRound> {
    const roundNumber = session.rounds.length + 1;
    const contextMessages = this.buildContextMessages(session.config.topic, session.rounds);
    
    // Send requests to all participating agents concurrently
    const responsePromises = session.config.models.map(model => 
      this.getAgentResponse(model, contextMessages)
    );

    // Collect all responses
    const responses = await Promise.all(responsePromises);

    return {
      roundNumber,
      responses: responses.filter(response => response !== null) as AgentResponse[]
    };
  }

  /**
   * Builds context messages with topic and all previous responses
   * Requirements: 3.1, 3.2, 3.3
   */
  private buildContextMessages(topic: string, previousRounds: DebateRound[]): Message[] {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are participating in a multi-agent debate. Provide thoughtful responses that consider other agents\' perspectives while maintaining your own reasoning.'
      },
      {
        role: 'user',
        content: `Topic for debate: ${topic}`
      }
    ];

    // Add all previous responses with clear agent attribution
    for (const round of previousRounds) {
      for (const response of round.responses) {
        messages.push({
          role: 'assistant',
          content: `[Agent ${response.model}]: ${response.content}`
        });
      }
    }

    if (previousRounds.length > 0) {
      messages.push({
        role: 'user',
        content: 'Please provide your response considering the above perspectives.'
      });
    }

    return messages;
  }

  /**
   * Gets response from a single agent with retry logic
   * Requirements: 3.4 - retry up to 3 times before marking agent as unavailable
   */
  private async getAgentResponse(model: string, messages: Message[]): Promise<AgentResponse | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chatCompletion({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        });

        if (response.choices && response.choices.length > 0) {
          return {
            model,
            content: response.choices[0].message.content,
            timestamp: new Date()
          };
        } else {
          throw new Error('No response choices returned from API');
        }
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication errors
        if (error instanceof Error && error.message.includes('401')) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Return error response if all retries failed
    return {
      model,
      content: '',
      timestamp: new Date(),
      error: `Failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    };
  }
}