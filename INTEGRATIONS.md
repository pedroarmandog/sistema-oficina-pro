# Integrações externas — OficinaPro

## E-mail / recuperação de senha
Configure SMTP no `server/.env`. O endpoint `POST /api/auth/forgot-password` responde de forma genérica para evitar enumeração de contas. Em desenvolvimento, sem SMTP, o token é escrito no terminal do servidor. Em produção, configure SMTP e remova logs de desenvolvimento.

## Web Push
Gere chaves VAPID com `npm run vapid --workspace server`. A chave pública vai em `client/.env` (`VITE_VAPID_PUBLIC_KEY`) e as duas chaves no `server/.env`. Publique em HTTPS. O agendador envia notificações pendentes a cada 30 segundos e remove assinaturas expiradas (HTTP 410).

## IA
A rota `POST /api/assistant/ask` consulta apenas indicadores agregados filtrados pela empresa do usuário autenticado. Se `OPENAI_API_KEY` estiver definida, esses agregados e a pergunta são enviados ao endpoint configurado. Não envie dados pessoais de clientes, segredos ou dados de cartão. Configure política de retenção e consentimento antes de ativar para clientes.

## Cobrança SaaS
`POST /api/subscription/checkout` registra uma assinatura pendente e `POST /api/webhooks/billing/:provider` valida `x-webhook-secret`. Ainda é necessário desenvolver o adaptador do gateway escolhido (ex.: criação de checkout, assinatura, cancelamento, reembolso, conciliação e validação de assinatura do webhook conforme documentação oficial). Não trate status enviado por um cliente como confirmação de pagamento.

## Fiscal
`POST /api/fiscal/documents` apenas registra a solicitação e retorna 503 se as configurações do provedor estiverem ausentes. O conector efetivo depende do fornecedor fiscal, tipo de documento, UF/município, regime tributário, certificado digital, ambiente de homologação e regras fiscais. Não emite documento autorizado nesta entrega.

## Backups
O script `server/scripts/backup-mysql.ps1` gera dump local. Configure agendamento no Windows Task Scheduler, retenção, cópia criptografada off-site e testes de restauração. Nunca salve backup público ou no mesmo servidor sem proteção.
