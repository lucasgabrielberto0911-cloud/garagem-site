/** Texto visível para regressões de conteúdo; a bateria40 verifica os links crus. */
export function textoVisivelChat(text: string) {
  return text.replace(/\*\*\[([^\]]+)\]\(\/estoque\/[^)]+\)\*\*/g, "$1")
    .replace(/\[\*\*([^\]]+)\*\*\]\(\/estoque\/[^)]+\)/g, "$1");
}
