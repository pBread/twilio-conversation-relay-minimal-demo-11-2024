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

export interface AIMessage extends StoreRecord {
  content: string;
  role: "ai";
  type: "content" | "tool";
}
