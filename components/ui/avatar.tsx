import { cn, initials } from "@/lib/utils";

const TONES = [
  "bg-[#dbeafe] text-[#1d4ed8]",
  "bg-[#dcfce7] text-[#15803d]",
  "bg-[#fce7f3] text-[#be185d]",
  "bg-[#ffedd5] text-[#c2410c]",
  "bg-[#ede9fe] text-[#6d28d9]",
  "bg-[#e0f2fe] text-[#0369a1]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, id, size = 24, className }: { name: string; id?: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium", TONES[hash(id ?? name) % TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
    >
      {initials(name)}
    </span>
  );
}
