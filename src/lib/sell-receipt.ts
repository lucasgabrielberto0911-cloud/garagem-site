/** Frase da confirmação. Fotos só entram quando o envio levou alguma. */
export function sellReceivedLine(photoCount: number): string {
  if (photoCount > 0) {
    return "Contato e dados informados do veículo, com as fotos que você mandou.";
  }
  return "Contato e dados informados do veículo. Placa e outros detalhes podem ser combinados no atendimento.";
}
