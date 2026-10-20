const transferSource = { label: "Detran/ES: transferência de propriedade", url: "https://detran.es.gov.br/transferencia-de-propriedade-ou-domicilio" };
export const BUYING_GUIDES = [
  {
    slug: "documentos-comprar-seminovo-es", title: "Documentos para comprar seminovo no ES",
    description: "Veja quais documentos preparar e confirme as exigências antes de fechar a compra.",
    sections: [
      ["Separe seus documentos", "Tenha identificação, CPF e comprovante de endereço. Confira no Detran/ES a lista aplicável ao seu caso; compra por empresa ou representante pode exigir documentos adicionais."],
      ["Confira os documentos do carro", "Compare os dados do CRLV-e com o veículo e com a negociação. Peça à loja a documentação de venda aplicável e guarde proposta, recibos e comprovantes."],
      ["Combine a transferência", "Confirme quem fará cada etapa, quais custos estão incluídos e quais documentos faltam. Consulte o procedimento oficial antes de assinar."],
    ], sources: [transferSource],
  },
  {
    slug: "como-conferir-laudo-cautelar", title: "Como conferir um laudo cautelar",
    description: "Leia o laudo completo e tire dúvidas sobre qualquer apontamento antes de decidir.",
    sections: [
      ["Peça o laudo completo", "Confira identificação do veículo, data, empresa responsável e forma de validar o documento com o emissor. Uma foto da capa não mostra o resultado completo."],
      ["Leia os apontamentos", "Peça explicação dos itens inspecionados, ressalvas e limites do serviço contratado. Não presuma que a palavra aprovado garante ausência de problemas."],
      ["Separe as verificações", "Consulte a documentação e combine uma avaliação mecânica independente. Antes da transferência, verifique também o procedimento de vistoria exigido pelo Detran/ES."],
    ], sources: [transferSource],
  },
  {
    slug: "transferencia-veiculo-es", title: "Transferência de veículo no Espírito Santo",
    description: "Organize a transferência com o roteiro oficial do Detran/ES.",
    sections: [
      ["Verifique o procedimento", "Consulte o serviço de transferência de propriedade no Detran/ES e confira os documentos e as formas de assinatura exigidos para a situação do veículo e da venda."],
      ["Planeje as etapas", "Confira no serviço oficial quais documentos e assinaturas são necessários e se há vistoria ou pagamentos a fazer. Converse com a equipe da Garagem para alinhar as responsabilidades e saber como acompanhar o processo."],
      ["Acompanhe a conclusão", "Só a assinatura da autorização de venda não encerra o processo. Confirme no Detran/ES a conclusão da transferência e quais documentos do veículo precisam estar atualizados."],
    ], sources: [transferSource],
  },
  {
    slug: "consultar-recall-seminovo", title: "Como consultar recall de um seminovo",
    description: "Consulte a base oficial e esclareça campanhas pendentes com a fabricante.",
    sections: [
      ["Use a consulta oficial", "A Senatran oferece consulta de recall online. Siga o acesso pelo gov.br e informe os dados solicitados no serviço oficial."],
      ["Confirme com a fabricante", "Se aparecer campanha pendente, fale com a rede autorizada sobre atendimento e registro da execução. Guarde o comprovante do serviço realizado."],
      ["Avalie o conjunto", "A consulta de recall não substitui análise de documentação, avaliação mecânica e leitura do histórico disponível. Tire as dúvidas antes de combinar a compra."],
    ], sources: [{ label: "Senatran: consulta de recall", url: "https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos" }],
  },
  {
    slug: "checklist-visita-seminovo", title: "Checklist para visitar um seminovo",
    description: "Prepare perguntas e confira o carro com calma, sem depender só das fotos.",
    sections: [
      ["Antes da visita", "Leia a ficha, anote dúvidas e peça vídeo dos pontos importantes. Confirme disponibilidade e combine o atendimento com a Garagem pelo WhatsApp."],
      ["Durante a avaliação", "Observe pneus, iluminação, comandos, acabamento e sinais visíveis de desgaste. Combine teste de condução quando possível e considere avaliação de um mecânico de confiança."],
      ["Antes de fechar", "Revise documentos, laudo disponível, manutenção informada e condições escritas da negociação. Consulte também recalls no canal oficial."],
    ], sources: [{ label: "Senatran: consulta de recall", url: "https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos" }],
  },
] as const;
