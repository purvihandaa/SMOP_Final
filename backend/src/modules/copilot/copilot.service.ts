// =============================================================================
// SMOP Copilot — LLM Orchestration Service (NVIDIA NIM / DeepSeek V4 Pro)
//
// Uses the OpenAI-compatible API provided by NVIDIA NIM.
// Manages conversation flow, multi-turn function calling, and RBAC context.
// =============================================================================

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';
import { config } from '../../config';
import { toolDeclarations, executeToolCall } from './copilot.tools';
import { ChatMessage } from './copilot.validator';
import { AppError } from '../../utils/errors';

// Maximum function-calling rounds to prevent infinite loops
const MAX_TOOL_ROUNDS = 6;

// ---------------------------------------------------------------------------
// System prompt — establishes identity, capabilities, and response style
// ---------------------------------------------------------------------------

function buildSystemPrompt(userRole: string, username: string): string {
  return `You are **SMOP Copilot** — the AI operations assistant for the Speedage Manufacturing Operations Platform (SMOP).

## Your Identity
- You are an intelligent, concise, professional assistant embedded within a manufacturing ERP.
- You help users query live system data about inventory, procurement, manufacturing, sales, and reporting.
- You are **read-only**: you observe and report data but never create, modify, or delete records.

## Current User
- **Username**: ${username}
- **Role**: ${userRole}

## Available Capabilities
You can call backend tools to fetch real-time data from the system:
- **Dashboard KPIs**: active POs, pending inspections, inventory counts, open orders
- **Inventory**: stock levels, material details, storage locations, low stock items
- **Manufacturing**: BOMs, production feasibility checks, worker instructions, scenario planning
- **Procurement**: purchase orders, supplier enquiries, supplier quotations
- **Sales**: customer orders, customer enquiries, customer quotations
- **Reports**: monthly/annual summaries with financial data
- **Material Receipts**: receipt records, inspection results, batch information

## Response Guidelines
1. **Always call tools** to retrieve fresh data before answering questions about the system. Never guess or fabricate data.
2. When asked about quantities, statuses, or financials — always include the exact numbers from the tool response.
3. Use markdown formatting for readability: tables for lists, bold for emphasis, bullet points for summaries.
4. Be concise but thorough. If data is empty, say so clearly.
5. When showing monetary values, format them in INR (₹).
6. If a user asks something outside your capabilities, clearly explain what you can and cannot do.
7. If a tool call fails, explain the error gracefully and suggest alternatives.
8. For feasibility questions, always call the feasibility tool — never estimate from raw inventory numbers alone.
9. When listing items, show the most relevant fields and limit to 10-15 items unless the user asks for more.
10. Add brief operational insights when relevant (e.g., "3 POs are still awaiting approval" or "Steel Sheets stock is below minimum threshold").`;
}

// ---------------------------------------------------------------------------
// Copilot Service
// ---------------------------------------------------------------------------

export class CopilotService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.nim.apiKey) {
        throw new AppError(
          'NVIDIA NIM API key is not configured. Set NVIDIA_API_KEY in the backend .env file.',
          503,
        );
      }
      this.client = new OpenAI({
        apiKey: config.nim.apiKey,
        baseURL: config.nim.baseUrl,
      });
    }
    return this.client;
  }

  async chat(
    messages: ChatMessage[],
    userId: string,
    userRole: string,
    username: string,
  ): Promise<string> {
    const client = this.getClient();

    // Build the message array for the OpenAI-compatible API
    const chatMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(userRole, username) },
      ...messages.map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    ];

    // Multi-turn function-calling loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: config.nim.model,
        messages: chatMessages,
        tools: toolDeclarations,
        tool_choice: 'auto',
      });

      const choice = response.choices[0];
      if (!choice) {
        return "I couldn't generate a response. Please try again.";
      }

      const assistantMessage = choice.message;

      // Add the assistant's message to history
      chatMessages.push(assistantMessage as ChatCompletionMessageParam);

      // If no tool calls, we have the final answer
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return assistantMessage.content || "I processed your request but couldn't generate a meaningful response. Could you rephrase your question?";
      }

      // Execute each tool call and append results
      for (const toolCall of assistantMessage.tool_calls) {
        // Only handle standard function tool calls
        if (!('function' in toolCall)) continue;

        const tc = toolCall as { id: string; function: { name: string; arguments: string } };
        const toolName = tc.function.name;
        let toolArgs: Record<string, unknown> = {};

        try {
          toolArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          toolArgs = {};
        }

        let toolResultContent: string;
        try {
          const toolResult = await executeToolCall(toolName, toolArgs, userId);
          toolResultContent = JSON.stringify({ success: true, data: toolResult });
        } catch (err: any) {
          toolResultContent = JSON.stringify({
            success: false,
            error: err.message || 'Tool execution failed',
          });
        }

        const toolMessage: ChatCompletionToolMessageParam = {
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResultContent,
        };

        chatMessages.push(toolMessage);
      }

      // Continue to next round — the model will see tool results and decide what to do
    }

    // If we exhausted all rounds, get a final answer without tools
    const finalResponse = await client.chat.completions.create({
      model: config.nim.model,
      messages: chatMessages,
    });

    return (
      finalResponse.choices[0]?.message?.content ||
      "I've gathered the data but ran into complexity limits. Could you try a more specific question?"
    );
  }
}

export const copilotService = new CopilotService();
