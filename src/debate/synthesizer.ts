/**
 * Synthesizer class for generating final consolidated answers
 * Takes complete debate history and generates a comprehensive final answer
 */

import { AIBuilderClient, Message } from './client';
import { DebateRound } from './session';

export class Synthesizer {
  private client: AIBuilderClient;
  private model: string;

  constructor(client: AIBuilderClient, model: string) {
    this.client = client;
    this.model = model;
  }

  /**
   * Synthesizes a final answer from complete debate history
   * Requirements: 5.1, 5.2
   * 
   * @param topic - The original debate topic
   * @param rounds - All debate rounds with agent responses
   * @returns Promise<string> - The consolidated final answer
   */
  async synthesize(topic: string, rounds: DebateRound[]): Promise<string> {
    if (rounds.length === 0) {
      return `No debate rounds available for topic: "${topic}". Unable to provide a synthesized answer.`;
    }

    const prompt = this.buildSynthesisPrompt(topic, rounds);
    
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a synthesis expert. Your task is to analyze a complete debate between multiple AI agents and create a comprehensive, well-reasoned final answer that incorporates the best insights from all participants. Focus on synthesizing different perspectives rather than simply summarizing them.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.client.chatCompletion({
        model: this.model,
        messages,
        temperature: 0.7, // Moderate temperature for creative synthesis
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from synthesizer');
      }

      return content.trim();
    } catch (error) {
      // Fallback synthesis if synthesizer fails
      return this.createFallbackSynthesis(topic, rounds, error);
    }
  }

  /**
   * Builds the prompt for synthesis with complete debate history
   */
  private buildSynthesisPrompt(topic: string, rounds: DebateRound[]): string {
    let prompt = `Topic: "${topic}"\n\n`;
    prompt += `Please synthesize a comprehensive final answer based on the following debate between multiple AI agents.\n\n`;
    prompt += `=== DEBATE HISTORY ===\n\n`;

    // Include all rounds with agent responses
    rounds.forEach(round => {
      prompt += `--- Round ${round.roundNumber} ---\n`;
      round.responses.forEach(response => {
        if (!response.error) {
          prompt += `${response.model}:\n${response.content}\n\n`;
        } else {
          prompt += `${response.model}: [Error: ${response.error}]\n\n`;
        }
      });
      
      // Include convergence assessment if available
      if (round.convergenceCheck) {
        prompt += `Moderator Assessment: ${round.convergenceCheck.reasoning}\n`;
        prompt += `Convergence Score: ${round.convergenceCheck.confidenceScore}\n\n`;
      }
    });

    prompt += `=== SYNTHESIS INSTRUCTIONS ===\n\n`;
    prompt += `Your task is to create a final answer that:\n`;
    prompt += `1. Incorporates key points and insights from ALL participating agents\n`;
    prompt += `2. Identifies areas of agreement and synthesizes them into coherent conclusions\n`;
    prompt += `3. Addresses any remaining disagreements by weighing the evidence and arguments\n`;
    prompt += `4. Provides a well-reasoned, comprehensive response to the original topic\n`;
    prompt += `5. Acknowledges the perspectives that contributed to the final answer\n\n`;
    prompt += `Please provide your synthesized final answer:`;

    return prompt;
  }

  /**
   * Creates a fallback synthesis when the main synthesis fails
   */
  private createFallbackSynthesis(topic: string, rounds: DebateRound[], error: unknown): string {
    let fallback = `Final Answer for: "${topic}"\n\n`;
    fallback += `[Note: Automated synthesis failed, providing structured summary]\n\n`;
    
    // Extract key points from each agent
    const agentContributions = new Map<string, string[]>();
    
    rounds.forEach(round => {
      round.responses.forEach(response => {
        if (!response.error && response.content.trim()) {
          if (!agentContributions.has(response.model)) {
            agentContributions.set(response.model, []);
          }
          // Take first 200 characters as key point
          const keyPoint = response.content.trim().substring(0, 200) + (response.content.length > 200 ? '...' : '');
          agentContributions.get(response.model)!.push(keyPoint);
        }
      });
    });

    fallback += `Key Perspectives:\n\n`;
    agentContributions.forEach((contributions, model) => {
      fallback += `${model}:\n`;
      contributions.forEach((contribution, index) => {
        fallback += `- ${contribution}\n`;
        if (index === 0) return; // Only show first contribution per agent in fallback
      });
      fallback += `\n`;
    });

    fallback += `\nSynthesis Error: ${error instanceof Error ? error.message : 'Unknown error occurred during synthesis'}`;
    
    return fallback;
  }
}