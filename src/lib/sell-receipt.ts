/** Frase da confirmação. Fotos só entram quando o envio levou alguma. */
export function sellReceivedLine(photoCount: number): string {
  if (photoCount > 0) {
    return "Marca, modelo, ano, placa, km e as fotos que você mandou.";
  }
  return "Marca, modelo, ano, placa e km.";
}
