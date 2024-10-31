let msgStore: Map<number | string, StoreMessage>;
let idx: number = 0;

export function reset() {
  msgStore = new Map();
  idx = 0;
}
reset();

export const deleteMsg = (id: number | string) => msgStore.delete(id);

export const getMessages = () => [...msgStore.values()];

/****************************************************
 Entities
****************************************************/
export type StoreMessage =
  | AIMessage
  | HumanMessage
  | SystemMessage
  | ToolResultMessage;

interface StoreRecord {
  id: number | string;
  idx: number;
}

// all completions returned from LLM are AIMessage
export interface AIMessage extends StoreRecord {
  content: string; // either text for speech or stringified json payload for tools
  role: "ai";
  type: "text" | "tool";
}

type AddAIMessage = Omit<AIMessage, "id" | "idx" | "role">;

export interface HumanMessage extends StoreRecord {
  content: string;
  role: "human";
}

type AddHumanMessage = Omit<HumanMessage, "id" | "idx" | "role">;

export interface SystemMessage extends StoreRecord {
  content: string;
  role: "system";
}

type AddSystemMessage = Omit<SystemMessage, "id" | "idx" | "role">;

// tool executions have two messages: AIMessage represents the tool initiation, ToolResultMessage represents the result
export interface ToolResultMessage extends StoreRecord {
  content: string; // stringified result
  parentId: number | string;
  role: "tool";
}

type AddToolResultMessage = Omit<ToolResultMessage, "id" | "idx" | "role">;

/****************************************************
 Record Creators
****************************************************/
export function addAIMessage(params: AddAIMessage) {
  const id = ++idx;
  let msg: AIMessage = { id, idx, ...params, role: "ai" };
  msgStore.set(msg.id, msg);

  return msg;
}

export function addHumanMessage(params: AddHumanMessage) {
  const id = ++idx;
  let msg: HumanMessage = { id, idx, ...params, role: "human" };
  msgStore.set(msg.id, msg);

  return msg;
}

export function addSystemMessage(params: AddSystemMessage) {
  const id = ++idx;
  let msg: SystemMessage = { id, idx, ...params, role: "system" };
  msgStore.set(msg.id, msg);

  return msg;
}

export function addToolResultMessage(params: AddToolResultMessage) {
  const id = ++idx;
  let msg: ToolResultMessage = { id, idx, ...params, role: "tool" };
  msgStore.set(msg.id, msg);

  return msg;
}
