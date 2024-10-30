export function cleanObj(obj: { [key: string]: any }) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

/****************************************************
 mutateDeepmergeAppend performs a deepmerge, appends any string properties, and treats arrays 
 indexes as properties. It's used to build message records from the llm completion
 stream chunks.

 For example...
    const obj1 = { a: "a", arr: [{ a: "a" }] };
    const obj2 = { a: "a", b: "b", arr: [{ a: "a", b: "b" }] };
    mutateDeepmergeAppend(obj1, obj2);
    // obj1 == { a: "aa", b: "b", arr: [{ a: "aa", b: "b" }] };
****************************************************/

export function mutateDeepmergeAppend<
  T extends Record<string, any>,
  U extends Record<string, any>
>(obj1: T, obj2: U): T & U {
  for (const key in obj2) {
    if (typeof obj2[key] === "string" && typeof obj1[key] === "string") {
      // Append if both values are strings
      (obj1[key] as string) += obj2[key];
    } else if (Array.isArray(obj2[key]) && Array.isArray(obj1[key])) {
      // Handle arrays by merging objects within based on index
      obj1[key] = obj2[key].map((item: any, index: number) => {
        if (
          typeof item === "object" &&
          !Array.isArray(item) &&
          obj1[key][index]
        ) {
          // Recursively merge objects at the same index
          return mutateDeepmergeAppend(obj1[key][index], item);
        } else if (Array.isArray(item) && Array.isArray(obj1[key][index])) {
          // Handle nested arrays by merging items recursively
          return item.map((nestedItem: any, nestedIndex: number) => {
            if (
              typeof nestedItem === "object" &&
              !Array.isArray(nestedItem) &&
              obj1[key][index][nestedIndex]
            ) {
              return mutateDeepmergeAppend(
                obj1[key][index][nestedIndex],
                nestedItem
              );
            }
            return nestedItem;
          });
        }
        return item;
      }) as any;
    } else if (typeof obj2[key] === "object" && typeof obj1[key] === "object") {
      // If both are objects, merge them recursively
      mutateDeepmergeAppend(obj1[key], obj2[key]);
    } else {
      // Otherwise, directly assign the value from obj2 to obj1, with assertion
      (obj1 as any)[key] = obj2[key];
    }
  }

  return obj1 as T & U;
}
