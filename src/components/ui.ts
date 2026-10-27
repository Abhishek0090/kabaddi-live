// Shared Tailwind class strings. Buttons are at least 56px tall for touch.

export const input =
  "min-h-14 w-full rounded-xl border-2 border-zinc-300 bg-white px-4 text-lg text-zinc-950 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export const label = "flex flex-col gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300";

const btnBase =
  "inline-flex min-h-14 select-none items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold transition active:scale-[0.97] disabled:opacity-40";

export const btn = {
  primary: `${btnBase} bg-orange-600 text-white hover:bg-orange-500`,
  secondary: `${btnBase} border-2 border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800`,
  danger: `${btnBase} bg-red-700 text-white hover:bg-red-600`,
  dark: `${btnBase} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white`,
};

export const card = "rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

/** Team colours: A is orange, B is sky blue. */
export const teamText = { A: "text-orange-600 dark:text-orange-400", B: "text-sky-600 dark:text-sky-400" } as const;
export const teamBg = { A: "bg-orange-600", B: "bg-sky-600" } as const;
