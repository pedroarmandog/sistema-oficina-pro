// O identificador do tenant sempre vem da sessão autenticada, nunca do corpo/query do cliente.
export function tenantScope(companyId, filters = {}) {
  if (!companyId) throw new Error('CompanyId autenticado é obrigatório.');
  return { ...filters, CompanyId: companyId };
}
