# Avaliação das respostas de escolha

`npm test` executa os casos de avaliação junto aos testes do assistente. As unidades destes testes são sintéticas e locais; não representam preço, potência ou disponibilidade publicados.

Casos principais: automático mais forte; comparar Civic e Duster e continuar com “desses”, “deles” ou “entre os dois”; economia com fonte indisponível; escolha para estrada; troca de automático para manual; teto de 60 mil; valores como 59,9 mil e R$ 54.900,00; pesquisa de outra versão/ano; fontes ausentes ou divergentes.

A avaliação passa pelo mesmo `runChatTurn` da API, mantendo filtros e contexto. O provedor de texto e a pesquisa têm respostas controladas para reproduzir falhas e impedir uma confirmação de câmbio de substituir a intenção de compra. Isto protege as regras, mas não mede a variabilidade do Gemini ao vivo. A conferência manual com o provedor continua necessária para perguntas livres.

Uma pergunta sobre estrada começa pelos fatos cadastrados e pergunta o que pesa para o cliente. Comparação de consumo exige combustível, percurso, versão e ano; tamanho do motor não prova economia. Ranking de potência usa fontes identificadas e não declara vencedor quando as fontes divergem ou faltam candidatos. Pesquisa técnica não muda preço, km, estado, garantia ou disponibilidade do estoque.

Não houve mudança de modelo, plano, credenciais ou custo configurado. Os controles existentes de timeout, cancelamento e fallback continuam em uso.

## Perguntas técnicas diretas

“Quantos cv tem a Duster?”, “qual a potência?” e “quanto torque tem?” respondem ao tema pedido antes do card. Perguntas com preço ou km mantêm também os fatos do anúncio. Havendo mais de uma versão e nenhuma unidade identificada, o assistente pergunta qual delas; não escolhe arbitrariamente o primeiro anúncio.

Ano, versão e motor informados pelo visitante prevalecem sobre uma ficha aberta de outra unidade. “Ano 2014”, “de 2014” e o par fabricação/modelo “2013/2014” identificam a unidade nas perguntas diretas; intervalos de busca continuam sendo filtros. Se o ano ou o motor não corresponde a nenhum anúncio, o assistente pede a identidade completa e não reutiliza a potência de outro motor. Números de CV ou de aceleração não são tratados como cilindrada de moto.

A avaliação inclui citações que cobrem a frase técnica enquanto a identidade está no cabeçalho imediatamente anterior. Só um cabeçalho curto com modelo, versão e ano exatos pode completar a identidade; outro ano, versão, modelo ou parágrafo não serve. Os números continuam vindo de trechos citados, com fontes permitidas.

Foi conferida uma referência específica para a Renault Duster Tech Road II 2.0 automática 2014: 142 cv/20,9 kgfm com etanol e 138 cv/19,7 kgfm com gasolina. A fonte primária é o [catálogo brasileiro da Renault de abril/2014, referência 7702265160, em cópia arquivada](https://ptdocz.com/doc/169501/d-cat%C3%A1logo-duster---renault-do-brasil), cruzado com a [ficha da versão no AutoPapo](https://autopapo.com.br/renault/duster-20-16v-tech-road-ii-aut-flex-2014/). A referência só vale para as identidades explicitamente revisadas no código; não cobre outros motores, anos ou consumo, nem altera o cadastro do veículo. Uma pergunta direta coberta por ela dispensa nova chamada ao provedor.

As demais identidades continuam usando a pesquisa externa. Fonte ausente mantém uma resposta honesta, sem inventar números. O código diferencia nos logs a ausência de correspondência citada de um erro HTTP do provedor, sem registrar perguntas, chaves ou dados pessoais. A causa operacional de falhas do provedor precisa ser conferida nos logs do ambiente; os testes locais não comprovam a disponibilidade dessa API em produção.
