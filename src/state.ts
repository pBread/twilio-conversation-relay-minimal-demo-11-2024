let msgMap: Map<number | string, StoreMessage>;
let idx: number = 0;

export function reset() {
  msgMap = new Map();
  idx = 0;
}
reset();

export const deleteMsg = (id: number | string) => msgMap.delete(id);

export const getMessages = () => [...msgMap.values()];

/****************************************************
 Entities
****************************************************/
export type StoreMessage = {};

interface StoreRecord {
  id: number | string;
  idx: number;
}

// all completions returned from LLM are AIMessage
export interface AIMessage extends StoreRecord {
  content: string;
  role: "ai";
  type: "content" | "tool";
}

export interface HumanMessage extends StoreRecord {
  role: "human";
}

export interface SystemMessage extends StoreRecord {
  role: "system";
}

// tool executions have two messages: AIMessage represents the tool initiation, ToolResultMessage represents the result
export interface ToolResultMessage extends StoreRecord {
  role: "tool";
}
