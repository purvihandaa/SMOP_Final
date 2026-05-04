import { z } from 'zod';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content is required'),
});

export const chatSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, 'At least one message is required')
    .max(50, 'Conversation too long — start a new one'),
});

export type ChatMessage = z.infer<typeof messageSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
