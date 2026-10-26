@AGENTS.md

# Claude Code
- Siga todas as regras do AGENTS.md acima.
- Trabalhe em branch `claude/<tema>` e abra **Draft PR**. Nunca faça merge: o Grok Bot (coordenador) revisa CI/preview e mergeia.
- Use a skill `nextjs-seo` para mudanças de SEO e o Chrome DevTools MCP para medir performance no preview.
- Economia Vercel: teste local antes do push; junte correções em lote; só use a label `preview` ou `[preview]` no commit quando o PR estiver pronto para o teste final (ver AGENTS.md).
- **Egress de fotos:** nunca baixe fotos do site em produção nem do Storage do Supabase (SDK `download`/`remove`/`list` inclusive); use fixtures ou cópia local, como a fixture `public/branding/placeholder-car.png` (ver AGENTS.md, seção "Fotos e egress do Supabase").
