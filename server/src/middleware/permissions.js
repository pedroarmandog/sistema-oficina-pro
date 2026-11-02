const permissions = {
  owner: ['*'],
  manager: ['dashboard','customers','suppliers','products','vehicles','services','workorders','financial','cash','sales','purchases','reports','push','assistant','employees','company'],
  employee: ['dashboard','customers','vehicles','services','workorders','products','sales','cash:read','push','assistant']
};
export function allow(area) {
  return (req,res,next) => {
    const role = req.user?.role || 'employee';
    const allowed = permissions[role] || [];
    if (allowed.includes('*') || (allowed.includes(area) && (role !== 'employee' || req.method === 'GET' || ['workorders','sales'].includes(area))) || (area === 'cash' && allowed.includes('cash:read') && req.method === 'GET')) return next();
    return res.status(403).json({ message: 'Seu usuário não tem permissão para esta operação.' });
  };
}
