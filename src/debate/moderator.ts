/**
 * Moderator class for evaluating debate convergence
 * Analyzes debate rounds to determine if agents have reached consensus
 */

import { AIBuilderClient, Message } from './client';
import { DebateRound, ConvergenceAssessment } from './session';

export class Moderator {
  private client: AIBuilderClient;
  private model: string;

  constructor(client: AIBuilderClient, model: string) {
    this.client = client;
    this.model = model;
  }

  /**
   * Evaluates convergence of debate rounds
   * Requirements: 4.1, 4.4, 4.5
   * 
   * @param topic - The debate topic
   * @param rounds - All debate rounds so far
   * @param threshold - Convergence threshold (0-1)
   * @returns Promise<ConvergenceAssessment>
   */
  async evaluateConvergence(
    topic: string,
    rounds: DebateRound[],
    threshold: number
  ): Promise<ConvergenceAssessment> {
    if (rounds.length === 0) {
      return {
        isConverged: false,
        confidenceScore: 0,
        reasoning: 'No rounds to evaluate'
      };
    }

    const prompt = this.buildConvergencePrompt(topic, rounds, threshold);
    
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a debate moderator. Analyze the provided debate rounds and determine if the participants have reached convergence. Respond with a JSON object containing: {"isConverged": boolean, "confidenceScore": number, "reasoning": string}. The confidenceScore must be between 0 and 1.'
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
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from moderator');
      }

      return this.parseConvergenceResponse(content, threshold);
    } catch (error) {
      // Fallback assessment if moderator fails
      return {
        isConverged: false,
        confidenceScore: 0,
        reasoning: `Moderator evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Builds the prompt for convergence analysis
   */
  private buildConvergencePrompt(topic: string, rounds: DebateRound[], threshold: number): string {
    let prompt = `Topic: "${topic}"\n\n`;
    prompt += `Convergence Threshold: ${threshold}\n\n`;
    prompt += `Please analyze the following debate rounds to determine convergence:\n\n`;

    rounds.forEach((round, index) => {
      prompt += `=== Round ${round.roundNumber} ===\n`;
      round.responses.forEach(response => {
        if (!response.error) {
          prompt += `${response.model}: ${response.content}\n\n`;
        }
      });
    });

    prompt += `\nEvaluation Criteria:\n`;
    prompt += `1. Are the agents' positions semantically aligned?\n`;
    prompt += `2. Have new substantive arguments stopped emerging?\n`;
    prompt += `3. Have agents acknowledged or incorporated others' points?\n\n`;
    prompt += `Provide your assessment as JSON: {"isConverged": boolean, "confidenceScore": number, "reasoning": string}\n`;
    prompt += `The confidenceScore should reflect how certain you are about the convergence assessment (0 = not certain, 1 = completely certain).`;

    return prompt;
  }

  /**
   * Parses the moderator's response and ensures confidence score is bounded
   */
  private parseConvergenceResponse(content: string, threshold: number): ConvergenceAssessment {
    try {
      // Extract JSON from response (handle cases where there might be extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (typeof parsed.isConverged !== 'boolean') {
        throw new Error('isConverged must be a boolean');
      }
      
      if (typeof parsed.confidenceScore !== 'number') {
        throw new Error('confidenceScore must be a number');
      }
      
      if (typeof parsed.reasoning !== 'string') {
        throw new Error('reasoning must be a string');
      }

      // Ensure confidenceScore is clamped to [0, 1] (Requirement 4.4)
      const clampedScore = Math.max(0, Math.min(1, parsed.confidenceScore));
      
      // Determine convergence based on threshold
      const isConverged = parsed.isConverged && clampedScore >= threshold;

      return {
        isConverged,
        confidenceScore: clampedScore,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      // Fallback parsing if JSON parsing fails
      const lowerContent = content.toLowerCase();
      const seemsConverged = lowerContent.includes('converged') || lowerContent.includes('consensus');
      
      return {
        isConverged: false, // Conservative fallback
        confidenceScore: 0,
        reasoning: `Failed to parse moderator response: ${error instanceof Error ? error.message : 'Unknown error'}. Raw content: ${content.substring(0, 200)}...`
      };
    }
  }
}