/**
 * Unit tests for AIBuilderClient error handling
 */

import { AIBuilderClient, ChatRequest } from '../../src/debate/client';

describe('AIBuilderClient Error Handling', () => {
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Constructor validation', () => {
    test('should throw error when auth token is empty', () => {
      expect(() => new AIBuilderClient('')).toThrow('Authentication token is required');
    });

    test('should throw error when auth token is undefined', () => {
      expect(() => new AIBuilderClient(undefined as any)).toThrow('Authentication token is required');
    });
  });

  describe('Authentication error handling', () => {
    test('should handle 401 authentication errors', async () => {
      const client = new AIBuilderClient('invalid-token');
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid authentication token'
      });

      const request: ChatRequest = {
        model: 'deepseek',
        messages: [{ role: 'user', content: 'test' }]
      };

      await expect(client.chatCompletion(request)).rejects.toThrow(
        'API request failed: 401 Unauthorized - Invalid authentication token'
      );
    });
  });

  describe('Retry logic on failures', () => {
    test('should handle network errors', async () => {
      const client = new AIBuilderClient('valid-token');
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const request: ChatRequest = {
        model: 'deepseek',
        messages: [{ role: 'user', content: 'test' }]
      };

      await expect(client.chatCompletion(request)).rejects.toThrow('Network error');
    });

    test('should handle 500 server errors', async () => {
      const client = new AIBuilderClient('valid-token');
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server temporarily unavailable'
      });

      const request: ChatRequest = {
        model: 'deepseek',
        messages: [{ role: 'user', content: 'test' }]
      };

      await expect(client.chatCompletion(request)).rejects.toThrow(
        'API request failed: 500 Internal Server Error - Server temporarily unavailable'
      );
    });

    test('should handle 429 rate limiting errors', async () => {
      const client = new AIBuilderClient('valid-token');
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded'
      });

      const request: ChatRequest = {
        model: 'deepseek',
        messages: [{ role: 'user', content: 'test' }]
      };

      await expect(client.chatCompletion(request)).rejects.toThrow(
        'API request failed: 429 Too Many Requests - Rate limit exceeded'
      );
    });
  });

  describe('Successful requests', () => {
    test('should successfully parse valid response', async () => {
      const client = new AIBuilderClient('valid-token');
      
      const mockResponse = {
        id: 'test-id',
        choices: [{
          message: { role: 'assistant', content: 'Test response' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const request: ChatRequest = {
        model: 'deepseek',
        messages: [{ role: 'user', content: 'test' }]
      };

      const response = await client.chatCompletion(request);
      
      expect(response).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://space.ai-builders.com/backend/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid-token',
          },
          body: JSON.stringify(request),
        }
      );
    });
  });
});