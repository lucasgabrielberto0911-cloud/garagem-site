import type { TestContext } from "node:test";

const originals = new WeakMap<TestContext, Map<object, Set<string>>>();

/** Prisma expõe métodos via Proxy, sem descritor compatível com mock.method. */
export function mockPrismaMethod(
  t: TestContext,
  target: object,
  name: string,
  implementation: (...args: any[]) => Promise<unknown>, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const methods = target as Record<string, unknown>;
  let targets = originals.get(t);
  if (!targets) originals.set(t, targets = new Map());
  let names = targets.get(target);
  if (!names) targets.set(target, names = new Set());
  if (!names.has(name)) {
    names.add(name);
    const original = methods[name];
    t.after(() => { methods[name] = original; });
  }
  const replacement = t.mock.fn(implementation);
  methods[name] = replacement;
  return replacement;
}
