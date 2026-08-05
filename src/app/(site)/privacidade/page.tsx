import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { PHONES, WHATSAPP_MESSAGES, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Política de privacidade | ${site.name}`,
  description: `Como a ${site.name} coleta, usa e protege os dados pessoais dos clientes, conforme a LGPD.`,
  alternates: { canonical: "/privacidade" },
};

const UPDATED_AT = "agosto de 2026";

export default function PrivacidadePage() {
  return (
    <div className="py-12 lg:py-16">
      <Container size="text">
        <PageHeader
          eyebrow="Privacidade e LGPD"
          title="Política de privacidade"
          description={`Última atualização: ${UPDATED_AT}. Esta política explica quais dados pessoais a ${site.name} coleta neste site, para que eles são usados e quais são os seus direitos como titular, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).`}
        />

        <div className="mt-12 space-y-6">
          <Block title="1. Quem é o controlador dos dados">
            <p>
              {site.legalName}, inscrita no CNPJ {site.cnpj}, é a responsável
              pelo tratamento dos dados coletados neste site. Contato:{" "}
              {PHONES.map((phone) => phone.label).join(" ou ")}.
            </p>
          </Block>

          <Block title="2. Quais dados coletamos">
            <ul className="space-y-2">
              <Item>
                <strong className="text-cream">Dados que você envia:</strong>{" "}
                nome, telefone e informações do veículo (marca, modelo, ano,
                quilometragem e observações) quando você preenche o formulário de
                avaliação da página Vender/Trocar.
              </Item>
              <Item>
                <strong className="text-cream">Dados de navegação:</strong>{" "}
                informações técnicas necessárias para o site funcionar e para
                medir audiência de forma agregada, como páginas visitadas e tipo
                de dispositivo.
              </Item>
              <Item>
                <strong className="text-cream">Dados no seu aparelho:</strong> a
                lista de favoritos fica salva apenas no armazenamento local do seu
                navegador. Ela não é enviada para nossos servidores e é apagada se
                você limpar os dados do navegador.
              </Item>
            </ul>
            <p>
              Não coletamos dados sensíveis e não pedimos senha, CPF ou dados
              bancários por meio deste site.
            </p>
          </Block>

          <Block title="3. Para que usamos os dados">
            <ul className="space-y-2">
              <Item>Responder ao seu contato e avaliar seu veículo.</Item>
              <Item>
                Apresentar propostas de compra, venda, troca e opções de
                financiamento.
              </Item>
              <Item>
                Cumprir obrigações legais e fiscais relacionadas à
                comercialização de veículos.
              </Item>
              <Item>Melhorar o site e a experiência de navegação.</Item>
            </ul>
            <p>
              As bases legais utilizadas são o consentimento, a execução de
              contrato ou de tratativas preliminares, o cumprimento de obrigação
              legal e o legítimo interesse.
            </p>
          </Block>

          <Block title="4. Compartilhamento">
            <p>
              Seus dados podem ser compartilhados com instituições financeiras
              parceiras (apenas quando você solicita simulação ou financiamento),
              com prestadores de serviço de tecnologia que hospedam o site e o
              banco de dados, e com autoridades públicas quando houver exigência
              legal. Não vendemos dados pessoais.
            </p>
          </Block>

          <Block title="5. Por quanto tempo guardamos">
            <p>
              Mantemos os dados de contato pelo tempo necessário ao atendimento e,
              quando houver negócio fechado, pelos prazos exigidos pela legislação
              fiscal e civil. Depois disso, os dados são eliminados ou
              anonimizados.
            </p>
          </Block>

          <Block title="6. Segurança">
            <p>
              Adotamos medidas técnicas e administrativas para proteger os dados,
              incluindo acesso restrito ao painel administrativo, conexão
              criptografada (HTTPS) e autenticação dos usuários internos.
            </p>
          </Block>

          <Block title="7. Seus direitos">
            <p>
              Você pode solicitar, a qualquer momento: confirmação de que tratamos
              seus dados, acesso aos dados, correção de informações incompletas ou
              desatualizadas, anonimização ou eliminação de dados desnecessários,
              portabilidade, informação sobre compartilhamentos e revogação do
              consentimento.
            </p>
            <p>
              Para exercer qualquer um desses direitos, fale com a gente pelo
              WhatsApp ou pelos telefones informados nesta página. Respondemos no
              prazo previsto na LGPD.
            </p>
          </Block>

          <Block title="8. Cookies e armazenamento local">
            <p>
              Usamos armazenamento local do navegador para guardar seus favoritos
              e a preferência de exibir (ou não) o convite para instalar o app.
              Também podem ser usados cookies estritamente necessários ao
              funcionamento do site e à medição de audiência de forma agregada.
              Você pode limpar esses dados nas configurações do seu navegador.
            </p>
          </Block>

          <Block title="9. Alterações desta política">
            <p>
              Esta política pode ser atualizada para refletir mudanças no site ou
              na legislação. A data da última atualização fica sempre no topo
              desta página.
            </p>
          </Block>
        </div>

        <div className="mt-10 border border-brand/40 bg-ink p-6 text-center">
          <p className="font-display text-base font-semibold text-cream">
            Dúvidas sobre seus dados?
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Fale direto com a gente. Também vale conferir as{" "}
            <Link href="/faq" className="text-brand underline-offset-4 hover:underline">
              dúvidas frequentes
            </Link>
            .
          </p>
          <WhatsAppButton
            className="mt-5"
            message={`${WHATSAPP_MESSAGES.general} Tenho uma dúvida sobre privacidade de dados.`}
          >
            Falar sobre privacidade
          </WhatsAppButton>
        </div>
      </Container>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-white/10 bg-ink p-6">
      <h2 className="font-display text-lg font-semibold text-cream">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2 h-1 w-1 shrink-0 bg-brand" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
