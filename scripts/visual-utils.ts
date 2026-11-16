export function addBackdrop(xml: string): string {
  const open = xml.match(/<manialink\b[^>]*>/);
  if (!open || open.index === undefined) throw new Error("Rendered example has no manialink root");
  const backdrop = '<quad pos="-160 90" size="320 180" z-index="-100" bgcolor="111" />';
  const at = open.index + open[0].length;
  return xml.slice(0, at) + backdrop + xml.slice(at);
}

export function treeDiff(before: unknown, after: unknown): string[] {
  const lines: string[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (Object.is(a, b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`);
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys)
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        );
      return;
    }
    lines.push(`${path || "(root)"}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  };
  walk(before, after, "");
  return lines;
}

// The game reports junk for the root frame and the backdrop is ours; snapshot only the page content
export function layoutSnapshot(tree: unknown): unknown {
  const children = (tree as { children?: unknown[] } | null)?.children;
  return Array.isArray(children) ? children.slice(1) : tree;
}
