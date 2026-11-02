# Checklist de segurança antes de produção

- [ ] Use HTTPS, `NODE_ENV=production`, JWT_SECRET aleatório com 32+ caracteres e segredos fora do repositório.
- [ ] Use usuário MySQL dedicado com privilégios mínimos; não use root em produção.
- [ ] Substitua `sequelize.sync()` por migrations revisadas e versionadas.
- [ ] Faça revisão de autorização por papel e testes de isolamento entre duas empresas reais de teste.
- [ ] Adicione MFA para proprietário, rotação/revogação de tokens e sessões curtas conforme risco.
- [ ] Rate limit específico em login, recuperação de senha, IA, push e endpoints financeiros.
- [ ] Validação de esquema (ex.: Zod/Joi), proteção CSRF se usar cookies e política CORS por domínio.
- [ ] Auditoria imutável para ações financeiras, estoque, OS, permissões e alterações de cadastro.
- [ ] Faça backup criptografado off-site e teste restauração; monitore falhas e disponibilidade.
- [ ] Defina retenção, consentimento, atendimento a titulares e política LGPD.
- [ ] Homologue gateway de pagamento e provedor fiscal em ambiente de testes antes de cobrar/emissão real.
- [ ] Teste PWA em Android e iOS reais; valide notificações, HTTPS, permissões e comportamento após atualização.
- [ ] Execute testes de concorrência: dois caixas, duas vendas simultâneas, estoque insuficiente e devoluções repetidas.

A aplicação contém proteções de base, mas este checklist não está automaticamente concluído pelo fato de o código existir.
