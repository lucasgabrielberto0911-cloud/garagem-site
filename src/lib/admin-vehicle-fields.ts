export function vehicleFieldErrors(
  input: {
    year: number;
    yearModel: number;
    km: number;
    status: string;
    doors: number | null;
  },
  currentYear = new Date().getFullYear(),
) {
  const errors: Record<string, string> = {};
  if (
    !Number.isInteger(input.year) ||
    input.year < 1950 ||
    input.year > currentYear + 1
  )
    errors.year = "Ano inválido.";
  if (
    !Number.isInteger(input.yearModel) ||
    input.yearModel < 1950 ||
    input.yearModel > currentYear + 2
  )
    errors.yearModel = "Ano modelo inválido.";
  if (!Number.isInteger(input.km) || input.km < 0 || input.km > 999999)
    errors.km = "Informe KM inteiro entre 0 e 999.999.";
  if (!["disponivel", "reservado", "vendido"].includes(input.status))
    errors.status = "Status inválido.";
  if (
    input.doors != null &&
    (!Number.isInteger(input.doors) || input.doors < 0 || input.doors > 6)
  )
    errors.doors = "Portas inválidas.";
  return errors;
}
