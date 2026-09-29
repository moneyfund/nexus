import { entity } from "@/domain/seed";
import type {
  AIMessage,
  ProjectStatus,
} from "@/domain/models";
import { firebaseApp } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { AIProvider, NexusContext } from "@/services/providers";

export interface NexusAIAction {
  type:
    | "complete_task"
    | "create_project"
    | "create_task"
    | "update_task"
    | "delete_task"
    | "record_income"
    | "record_expense"
    | "update_transaction"
    | "delete_transaction"
    | "update_project_status"
    | "update_project_value"
    | "update_project"
    | "log_project_activity"
    | "create_event"
    | "update_event"
    | "delete_event"
    | "create_idea"
    | "update_idea"
    | "delete_idea"
    | "add_memory"
    | "update_memory"
    | "delete_memory";
  targetId: string | null;
  projectId: string | null;
  taskId: string | null;
  transactionKind: "income" | "expense" | null;
  title: string | null;
  milestone: string | null;
  amount: number | null;
  value: number | null;
  status: ProjectStatus | null;
  priority: "critical" | "high" | "medium" | "low" | null;
  estimatedMinutes: number | null;
  date: string | null;
  dueDate: string | null;
  start: string | null;
  end: string | null;
  category:
    | "focus"
    | "meeting"
    | "admin"
    | "client"
    | "university"
    | "personal"
    | "deadline"
    | null;
  itemCategory: string | null;
  description: string | null;
  content: string | null;
  notes: string | null;
  area: string | null;
  client: string | null;
  reason: string;
}

export interface NexusAIResponse {
  message: AIMessage;
  actions: NexusAIAction[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  costUSD: number;
}

interface APIResponse {
  result?: {
    answer?: string;
    actions?: Array<NexusAIAction | { type: "none"; reason: string }>;
  };
  model?: string;
  provider?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  costUSD?: number;
}

const functions = getFunctions(firebaseApp, "us-east4");
const callAI = httpsCallable<
  { prompt: string; context: NexusContext; model?: string },
  APIResponse
>(functions, "nexusAI");
export interface NexusAIQuota {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthCostUSD: number;
}

const callAIStatus = httpsCallable<
  Record<string, never>,
  {
    configured: boolean;
    model: string;
    provider: string;
    mode: string;
    quota: NexusAIQuota;
  }
>(functions, "nexusAIStatus");

export class NexusOpenAIClient implements AIProvider {
  async status() {
    try {
      const response = await callAIStatus({});
      return {
        configured: response.data.configured,
        model: response.data.model,
        quota: response.data.quota,
      };
    } catch (error) {
      return {
        configured: false,
        model: "",
        error:
          error instanceof Error
            ? error.message
            : "NEXUS AI todavía no está disponible.",
      };
    }
  }

  async respondDetailed(
    prompt: string,
    context: NexusContext,
    signal?: AbortSignal,
  ): Promise<NexusAIResponse> {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");

    const response = await callAI({ prompt, context });
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");

    const body = response.data;
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
      costUSD: body.costUSD ?? 0,
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
