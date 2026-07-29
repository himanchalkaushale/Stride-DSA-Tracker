export const TOPICS = [
  "Arrays",
  "Strings",
  "Hashing",
  "Two Pointers",
  "Sliding Window",
  "Linked Lists",
  "Stacks & Queues",
  "Binary Search",
  "Trees",
  "Heaps",
  "Graphs",
  "Backtracking",
  "Greedy",
  "Dynamic Programming",
] as const;

export const LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "Go",
] as const;

const topicAliases: Record<string, (typeof TOPICS)[number]> = {
  array: "Arrays", arrays: "Arrays",
  string: "Strings", strings: "Strings",
  hash: "Hashing", hashmap: "Hashing", hashmaps: "Hashing", hashing: "Hashing",
  twopointer: "Two Pointers", twopointers: "Two Pointers",
  slidingwindow: "Sliding Window",
  linkedlist: "Linked Lists", linkedlists: "Linked Lists",
  stack: "Stacks & Queues", stacks: "Stacks & Queues", queue: "Stacks & Queues",
  queues: "Stacks & Queues", stacksandqueues: "Stacks & Queues",
  binarysearch: "Binary Search",
  tree: "Trees", trees: "Trees",
  heap: "Heaps", heaps: "Heaps",
  graph: "Graphs", graphs: "Graphs",
  backtrack: "Backtracking", backtracking: "Backtracking",
  greedy: "Greedy",
  dp: "Dynamic Programming", dynamicprogramming: "Dynamic Programming",
};

export function normalizeTopic(topic: string): string {
  const trimmed = topic.trim().replace(/\s+/g, " ");
  const key = trimmed.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  return topicAliases[key] ?? trimmed;
}

export function normalizeTopics(topics: string[]): string[] {
  return [...new Set(topics.map(normalizeTopic).filter(Boolean))];
}

export function normalizeProblemTopics(problem: {
  title: string;
  description: string | null;
  topics: string[];
  patterns: string[];
}): string[] {
  const topics = normalizeTopics(problem.topics);
  const text = [problem.title, problem.description ?? "", ...problem.topics, ...problem.patterns].join(" ").toLowerCase();
  const linkedListSubtopics = new Set([
    "advanced deletion", "advanced linked list design", "advanced reversal", "deletion basics",
    "doubly linked list", "hashing and node mapping", "hashing with lists", "insertion and math",
    "length and partitioning", "linked list and stack", "linked list design", "linked list fundamentals",
    "linked list sorting", "list reordering", "local reversal", "merging lists", "multiway merge",
    "partial reversal", "pointer manipulation", "reverse and compare", "reverse and monotonic logic",
    "splicing lists",
  ]);
  const isLinkedList = /\blinked[\s-]?lists?\b|\bsingly\b|\bdoubly\b/.test(text)
    || problem.topics.some((topic) => linkedListSubtopics.has(topic.trim().toLowerCase()))
    || (/\bnodes?\b/.test(problem.title.toLowerCase()) && /\b(revers|merge|swap|pointer|list)\b/.test(text));
  return isLinkedList ? normalizeTopics(["Linked Lists", ...topics]) : topics;
}
