# Avaliação das respostas de escolha

`npm test` executa os casos de avaliação junto aos testes do assistente. As unidades destes testes são sintéticas e locais; não representam preço, potência ou disponibilidade publicados.

Casos principais: automático mais forte; comparar Civic e Duster e continuar com “desses”, “deles” ou “entre os dois”; economia com fonte indisponível; escolha para estrada; troca de automático para manual; teto de 60 mil; valores como 59,9 mil e R$ 54.900,00; pesquisa de outra versão/ano; fontes ausentes ou divergentes.

A avaliação passa pelo mesmo `runChatTurn` da API, mantendo filtros e contexto. O provedor de texto e a pesquisa têm respostas controladas para reproduzir falhas e impedir uma confirmação de câmbio de substituir a intenção de compra. Isto protege as regras, mas não mede a variabilidade do Gemini ao vivo. A conferência manual com o provedor continua necessária para perguntas livres.

Uma pergunta sobre estrada começa pelos fatos cadastrados e pergunta o que pesa para o cliente. Comparação de consumo exige combustível, percurso, versão e ano; tamanho do motor não prova economia. Ranking de potência usa fontes identificadas e não declara vencedor quando as fontes divergem ou faltam candidatos. Pesquisa técnica não muda preço, km, estado, garantia ou disponibilidade do estoque.

Não houve mudança de modelo, plano, credenciais ou custo configurado. Os controles existentes de timeout, cancelamento e fallback continuam em uso.
