export interface ShortcutGroup {
  group: string;
  items: { keys: string[]; label: string }[];
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    group: "General",
    items: [
      { keys: ["Ctrl", "K"], label: "Command palette" },
      { keys: ["/"], label: "Palette in search mode" },
      { keys: ["[", "or", "Ctrl", "B"], label: "Toggle sidebar" },
      { keys: ["C"], label: "New topic" },
      { keys: ["Ctrl", "Shift", "L"], label: "Cycle theme" },
      { keys: ["?"], label: "Shortcuts sheet" },
      { keys: ["Esc"], label: "Close menu, panel or focus mode" },
    ],
  },
  {
    group: "Go to",
    items: [
      { keys: ["G", "then", "D"], label: "Dashboard" },
      { keys: ["G", "then", "R"], label: "Review (flashcards)" },
      { keys: ["G", "then", "T"], label: "Tutor" },
      { keys: ["G", "then", "A"], label: "All topics" },
      { keys: ["G", "then", "S"], label: "Account settings" },
    ],
  },
  {
    group: "Lessons and rows",
    items: [
      { keys: ["J", "K"], label: "Move through lesson rows" },
      { keys: ["Enter"], label: "Open selected" },
      { keys: ["Space"], label: "Peek selected lesson" },
      { keys: ["P"], label: "Pin or unpin selected" },
      { keys: ["."], label: "Open selected row's 3 dot menu" },
      { keys: ["F"], label: "Focus mode on a lesson" },
    ],
  },
  {
    group: "Flashcard review",
    items: [
      { keys: ["Space"], label: "Show answer" },
      { keys: ["1"], label: "Again" },
      { keys: ["2"], label: "Hard" },
      { keys: ["3"], label: "Good" },
      { keys: ["4"], label: "Easy" },
    ],
  },
];
