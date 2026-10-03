export function customerSearchWhere(query: string) {
  const term = query.trim();
  if (!term) return {};
  const digits = term.replace(/\D/g, "");
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { email: { contains: term, mode: "insensitive" as const } },
      ...(digits
        ? [
            { phone: { contains: digits, mode: "insensitive" as const } },
            { cpf: { contains: digits, mode: "insensitive" as const } },
          ]
        : []),
    ],
  };
}
