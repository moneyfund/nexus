import { entity } from "@/domain/seed";
import type {
  AIMessage,
  ProjectStatus,
} from "@/domain/models";
import { firebaseClient } from "@/lib/firebase";
import type { AIProvider, NexusContext } from "@/services/providers";

export type NexusAIAction =
  | {
      type: "complete_task";
      projectId: string | null;
      taskId: string | null;
      title: string | null;
      milestone: string | null;
      amount: number | null;
      value: number | null;
      status: ProjectStatus | null;
      reason: string;
    }
  | {
      type: "create_task";
      projectId: string | null;
      taskId: string | null;
      title: string | null;
      milestone: string | null;
      amount: number | null;
      value: number | null;
      status: ProjectStatus | null;
      reason: string;
    }
  | {
      type: "record_income" | "record_expense";
      projectId: string | null;
      taskId: string | null;
      title: string | null;
      milestone: string | null;
      amount: number | null;
      value: number | null;
      status: ProjectStatus | null;
      reason: string;
    }
  | {
      type: "update_project_status";
      projectId: string | null;
      taskId: string | null;
      title: string | null;
      milestone: string | null;
      amount: number | null;
      value: number | null;
      status: ProjectStatus | null;
      reason: string;
    }
  | {
      type: "update_project_value";
      projectId: string | null;
      taskId: string | null;
      title: string | null;
      milestone: string | null;
      amount: number | null;
      value: number | null;
      status: ProjectStatus | null;
      reason: string;
    };

export interface NexusAIResponse {
  message: AIMessage;
  actions: NexusAIAction[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

interface APIResponse {
  result?: {
    answer?: string;
    actions?: Array<NexusAIAction | { type: "none"; reason: string }>;
  };
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  error?: string;
  code?: string;
}

export class NexusOpenAIClient implements AIProvider {
  async status() {
    const response = await fetch("/api/ai", { cache: "no-store" });
    if (!response.ok)
      return { configured: false, model: "", error: "NEXUS AI no responde." };
    return (await response.json()) as {
      configured: boolean;
      model: string;
      error?: string;
    };
  }

  async respondDetailed(
    prompt: string,
    context: NexusContext,
    signal?: AbortSignal,
  ): Promise<NexusAIResponse> {
    const idToken = await firebaseClient.getIdToken();
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + idToken,
      },
      body: JSON.stringify({ prompt, context }),
      signal,
    });

    const body = (await response.json()) as APIResponse;
    if (!response.ok)
      throw new Error(body.error || "NEXUS AI no pudo responder.");

    const answer = body.result?.answer?.trim();
    if (!answer) throw new Error("NEXUS AI devolvió una respuesta vacía.");

    const contextIds = [
      ...context.projects.map((project) => project.id),
      ...context.events.map((event) => event.id),
      ...context.knowledge.map((item) => item.id),
      ...context.memories.map((memory) => memory.id),
    ];

    return {
      message: {
        ...entity(crypto.randomUUID(), "user", context.userId),
        conversationId: "local-conversation",
        role: "assistant",
        content: answer,
        contextIds,
        simulated: false,
      },
      actions: (body.result?.actions ?? []).filter(
        (action): action is NexusAIAction => action.type !== "none",
      ),
      model: body.model ?? "OpenAI",
      usage: {
        inputTokens: body.usage?.inputTokens ?? 0,
        outputTokens: body.usage?.outputTokens ?? 0,
      },
    };
  }

  async respond(
    prompt: string,
    context: NexusContext,
    signal?: AbortSignal,
  ): Promise<AIMessage> {
    return (await this.respondDetailed(prompt, context, signal)).message;
  }
}
