import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { db, Company, User, Product, Customer, Vehicle, WorkOrder, WorkOrderItem, CashSession, CashMovement, Sale, SaleItem, StockMovement, FinancialEntry, Supplier, Purchase, PurchaseItem, PasswordReset, AuditLog, Subscription, NotificationJob, PushSubscription, FiscalDocument } from '../models/index.js';
import { auth } from '../middleware/auth.js';
import { allow } from '../middleware/permissions.js';
const r=Router(); r.use(auth);
const audit=(req,action,entity,entityId,metadata={})=>AuditLog.create({CompanyId:req.companyId,UserId:req.user.id,action,entity,entityId:String(entityId||''),metadata,ip:req.ip});
const money=n=>Number(Number(n||0).toFixed(2));
const openCash=async(companyId,transaction)=>CashSession.findOne({where:{CompanyId:companyId,status:'open'},transaction,lock:transaction?.LOCK?.UPDATE});

// Consulta de movimentações de estoque, sempre limitada à empresa autenticada.
r.get('/stock/movements',allow('products'),async(req,res)=>{
  const rows=await StockMovement.findAll({where:{CompanyId:req.companyId},include:[{model:Product,attributes:['id','name','sku']}],order:[['createdAt','DESC']],limit:300});
  res.json(rows);
});

// Histórico de vendas da empresa autenticada. Nunca retorna registros de outro tenant.
r.get('/sales',allow('sales'),async(req,res)=>{
  const rows=await Sale.findAll({where:{CompanyId:req.companyId},include:[{model:SaleItem,as:'items'},{model:Customer,required:false}],order:[['soldAt','DESC']],limit:300});
  res.json(rows);
});

// PDV: produto + estoque + movimento de caixa + contas a receber em uma transação.
r.post('/pos/checkout',allow('sales'),async(req,res)=>{const {items=[],customerId,paymentMethod='dinheiro',discount=0,paid=true}=req.body;if(!items.length)return res.status(400).json({message:'Inclua ao menos um produto.'});const t=await db.transaction();try{const cash=await openCash(req.companyId,t);if(paid&&!cash)throw new Error('Abra o caixa antes de concluir uma venda recebida.');if(customerId&&!await Customer.findOne({where:{id:customerId,CompanyId:req.companyId},transaction:t}))throw new Error('Cliente inválido.');let subtotal=0;const lines=[];for(const line of items){const p=await Product.findOne({where:{id:line.productId,CompanyId:req.companyId,active:true},transaction:t,lock:t.LOCK.UPDATE});const qty=Number(line.quantity);if(!p||!Number.isFinite(qty)||qty<=0)throw new Error('Produto ou quantidade inválida.');if(Number(p.stock)<qty)throw new Error(`Estoque insuficiente para ${p.name}.`);const total=money(Number(p.salePrice)*qty);subtotal+=total;lines.push({p,qty,total});}const disc=Number(discount);if(!Number.isFinite(disc)||disc<0||disc>subtotal)throw new Error('Desconto inválido.');const total=money(subtotal-disc);const sale=await Sale.create({CompanyId:req.companyId,CustomerId:customerId||null,number:`PDV-${Date.now()}`,subtotal,discount:disc,total,paymentMethod,status:paid?'concluida':'pendente'},{transaction:t});for(const x of lines){await SaleItem.create({CompanyId:req.companyId,SaleId:sale.id,ProductId:x.p.id,description:x.p.name,quantity:x.qty,unitPrice:x.p.salePrice,total:x.total},{transaction:t});await x.p.decrement('stock',{by:x.qty,transaction:t});await StockMovement.create({CompanyId:req.companyId,ProductId:x.p.id,type:'saida',quantity:x.qty,reason:`PDV ${sale.number}`},{transaction:t});}if(paid)await CashMovement.create({CompanyId:req.companyId,CashSessionId:cash.id,type:'entrada',category:'Venda PDV',description:`Venda ${sale.number}`,amount:total,paymentMethod},{transaction:t});else await FinancialEntry.create({CompanyId:req.companyId,type:'receber',description:`Venda ${sale.number}`,category:'Venda PDV',amount:total,dueDate:new Date(),status:'pendente',notes:`Forma prevista: ${paymentMethod}`},{transaction:t});await t.commit();await audit(req,'pos.checkout','Sale',sale.id,{total});res.status(201).json(sale);}catch(e){await t.rollback();res.status(400).json({message:e.message});}});
r.post('/sales/:id/cancel',allow('sales'),async(req,res)=>{const t=await db.transaction();try{const sale=await Sale.findOne({where:{id:req.params.id,CompanyId:req.companyId},include:[{model:SaleItem,as:'items'}],transaction:t,lock:t.LOCK.UPDATE});if(!sale||!['concluida','pendente'].includes(sale.status)||sale.number.startsWith('OS-'))throw new Error('Venda não encontrada, não cancelável por este fluxo ou já cancelada.');for(const item of sale.items){if(item.ProductId){const p=await Product.findOne({where:{id:item.ProductId,CompanyId:req.companyId},transaction:t,lock:t.LOCK.UPDATE});if(p){await p.increment('stock',{by:Number(item.quantity),transaction:t});await StockMovement.create({CompanyId:req.companyId,ProductId:p.id,type:'entrada',quantity:item.quantity,reason:`Estorno ${sale.number}`},{transaction:t});}}}const receivable=await FinancialEntry.findOne({where:{CompanyId:req.companyId,type:'receber',description:`Venda ${sale.number}`,status:'pendente'},transaction:t});if(receivable)await receivable.update({status:'cancelado'},{transaction:t});if(sale.status==='concluida'){const cash=await openCash(req.companyId,t);if(cash)await CashMovement.create({CompanyId:req.companyId,CashSessionId:cash.id,type:'saida',category:'Estorno de venda',description:`Estorno ${sale.number}`,amount:sale.total,paymentMethod:sale.paymentMethod},{transaction:t});else await FinancialEntry.create({CompanyId:req.companyId,type:'pagar',description:`Reembolso de venda ${sale.number}`,category:'Estorno de venda',amount:sale.total,dueDate:new Date(),status:'pendente'},{transaction:t});}sale.status='cancelada';await sale.save({transaction:t});await t.commit();await audit(req,'sale.cancel','Sale',sale.id);res.json({message:'Venda cancelada e estoque estornado.',sale});}catch(e){await t.rollback();res.status(400).json({message:e.message});}});

// Compras e devoluções: entrada de estoque só ocorre após validar e gravar todos os itens.
r.post('/purchases',allow('purchases'),async(req,res)=>{const {supplierId,items=[],discount=0,notes,paidNow=false,dueDate}=req.body;if(!items.length)return res.status(400).json({message:'Inclua itens na compra.'});const t=await db.transaction();try{if(supplierId&&!await Supplier.findOne({where:{id:supplierId,CompanyId:req.companyId},transaction:t}))throw new Error('Fornecedor inválido.');let subtotal=0;const parsed=[];for(const x of items){const p=await Product.findOne({where:{id:x.productId,CompanyId:req.companyId},transaction:t,lock:t.LOCK.UPDATE});const q=Number(x.quantity),cost=Number(x.unitCost);if(!p||q<=0||cost<0||!Number.isFinite(q+cost))throw new Error('Item, quantidade ou custo inválido.');subtotal+=q*cost;parsed.push({p,q,cost});}const total=money(subtotal-Number(discount));if(total<0)throw new Error('Desconto maior que a compra.');const purchase=await Purchase.create({CompanyId:req.companyId,SupplierId:supplierId||null,number:`CMP-${Date.now()}`,subtotal,discount,total,notes},{transaction:t});for(const x of parsed){await PurchaseItem.create({CompanyId:req.companyId,PurchaseId:purchase.id,ProductId:x.p.id,description:x.p.name,quantity:x.q,unitCost:x.cost,total:money(x.q*x.cost)},{transaction:t});await x.p.increment('stock',{by:x.q,transaction:t});await x.p.update({costPrice:x.cost},{transaction:t});await StockMovement.create({CompanyId:req.companyId,ProductId:x.p.id,type:'entrada',quantity:x.q,unitCost:x.cost,reason:`Compra ${purchase.number}`},{transaction:t});}if(paidNow){const cash=await openCash(req.companyId,t);if(!cash)throw new Error('Abra o caixa para registrar uma compra paga à vista.');await CashMovement.create({CompanyId:req.companyId,CashSessionId:cash.id,type:'saida',category:'Compra de mercadoria',description:`Compra ${purchase.number}`,amount:total,paymentMethod:req.body.paymentMethod||'dinheiro'},{transaction:t});}await FinancialEntry.create({CompanyId:req.companyId,type:'pagar',description:`Compra ${purchase.number}`,category:'Compra de mercadoria',amount:total,dueDate:dueDate||new Date(),status:paidNow?'pago':'pendente',paidAt:paidNow?new Date():null,paymentMethod:req.body.paymentMethod||null},{transaction:t});await t.commit();await audit(req,'purchase.receive','Purchase',purchase.id,{total});res.status(201).json(purchase);}catch(e){await t.rollback();res.status(400).json({message:e.message});}});
r.get('/purchases',allow('purchases'),async(req,res)=>res.json(await Purchase.findAll({where:{CompanyId:req.companyId},include:[{model:PurchaseItem,as:'items'}],order:[['createdAt','DESC']],limit:200})));
r.post('/purchases/:id/return',allow('purchases'),async(req,res)=>{const {items=[]}=req.body;const t=await db.transaction();try{const purchase=await Purchase.findOne({where:{id:req.params.id,CompanyId:req.companyId},include:[{model:PurchaseItem,as:'items'}],transaction:t,lock:t.LOCK.UPDATE});if(!purchase||purchase.status==='cancelada')throw new Error('Compra inválida.');let refundTotal=0;for(const ret of items){const line=purchase.items.find(i=>i.id===Number(ret.itemId));const q=Number(ret.quantity);if(!line||q<=0||Number(line.returnedQuantity)+q>Number(line.quantity))throw new Error('Quantidade de devolução inválida.');const p=await Product.findOne({where:{id:line.ProductId,CompanyId:req.companyId},transaction:t,lock:t.LOCK.UPDATE});if(!p||Number(p.stock)<q)throw new Error(`Estoque insuficiente para devolver ${line.description}.`);await p.decrement('stock',{by:q,transaction:t});refundTotal+=money(q*Number(line.unitCost));line.returnedQuantity=Number(line.returnedQuantity)+q;await line.save({transaction:t});await StockMovement.create({CompanyId:req.companyId,ProductId:p.id,type:'saida',quantity:q,reason:`Devolução compra ${purchase.number}`},{transaction:t});}const payable=await FinancialEntry.findOne({where:{CompanyId:req.companyId,type:'pagar',description:`Compra ${purchase.number}`},transaction:t,lock:t.LOCK.UPDATE});if(payable?.status==='pendente'){const remaining=money(Number(payable.amount)-refundTotal);await payable.update({amount:Math.max(0,remaining),status:remaining<=0?'cancelado':'pendente'},{transaction:t});}else if(refundTotal>0){await FinancialEntry.create({CompanyId:req.companyId,type:'receber',description:`Crédito de devolução ${purchase.number}`,category:'Devolução de compra',amount:refundTotal,dueDate:new Date(),status:'pendente'},{transaction:t});}const fully=purchase.items.every(i=>Number(i.returnedQuantity)>=Number(i.quantity));purchase.status=fully?'devolvida_total':'devolvida_parcial';await purchase.save({transaction:t});await t.commit();await audit(req,'purchase.return','Purchase',purchase.id,{items});res.json(purchase);}catch(e){await t.rollback();res.status(400).json({message:e.message});}});

// Ordem de serviço: valida cliente/veículo, itens e consumo de peças ao marcar como concluída.
r.patch('/workorders/:id/status',allow('workorders'),async(req,res)=>{const order=await WorkOrder.findOne({where:{id:req.params.id,CompanyId:req.companyId}});if(!order)return res.status(404).json({message:'OS não encontrada.'});const transitions={orcamento:['aprovada','cancelada'],aprovada:['em_andamento','aguardando_peca','cancelada'],em_andamento:['aguardando_peca','cancelada'],aguardando_peca:['em_andamento','cancelada']};const next=req.body.status;if(!transitions[order.status]?.includes(next))return res.status(409).json({message:`Transição inválida: ${order.status} → ${next}.`});await order.update({status:next});res.json(order);});
r.get('/workorders/:id',allow('workorders'),async(req,res)=>{const order=await WorkOrder.findOne({where:{id:req.params.id,CompanyId:req.companyId},include:[{model:WorkOrderItem,as:'items'}]});if(!order)return res.status(404).json({message:'OS não encontrada.'});res.json(order);});
r.post('/financial/:id/settle',allow('financial'),async(req,res)=>{const t=await db.transaction();try{const entry=await FinancialEntry.findOne({where:{id:req.params.id,CompanyId:req.companyId},transaction:t,lock:t.LOCK.UPDATE});if(!entry||entry.status!=='pendente')throw new Error('Conta não encontrada ou já processada.');const cash=await openCash(req.companyId,t);if(!cash)throw new Error('Abra o caixa antes de registrar o recebimento/pagamento.');const method=req.body.paymentMethod||'dinheiro';await CashMovement.create({CompanyId:req.companyId,CashSessionId:cash.id,type:entry.type==='receber'?'entrada':'saida',category:entry.type==='receber'?'Recebimento de conta':'Pagamento de conta',description:entry.description,amount:entry.amount,paymentMethod:method},{transaction:t});await entry.update({status:'pago',paidAt:new Date(),paymentMethod:method},{transaction:t});await t.commit();await audit(req,'financial.settle','FinancialEntry',entry.id,{amount:entry.amount,type:entry.type});res.json(entry);}catch(e){await t.rollback();res.status(400).json({message:e.message});}});
r.post('/workorders/:id/complete',allow('workorders'),async(req,res)=>{const t=await db.transaction();try{const order=await WorkOrder.findOne({where:{id:req.params.id,CompanyId:req.companyId},include:[{model:WorkOrderItem,as:'items'}],transaction:t,lock:t.LOCK.UPDATE});if(!order||!['em_andamento','aguardando_peca'].includes(order.status))throw new Error('A OS precisa estar em andamento ou aguardando peça para ser concluída.');if(order.status==='concluida')throw new Error('OS já foi concluída.');for(const item of order.items.filter(i=>i.kind==='product'&&i.ProductId)){const p=await Product.findOne({where:{id:item.ProductId,CompanyId:req.companyId},transaction:t,lock:t.LOCK.UPDATE});if(!p||Number(p.stock)<Number(item.quantity))throw new Error(`Estoque insuficiente para ${item.description}.`);await p.decrement('stock',{by:Number(item.quantity),transaction:t});await StockMovement.create({CompanyId:req.companyId,ProductId:p.id,type:'saida',quantity:item.quantity,reason:`Consumo OS ${order.number}`},{transaction:t});}order.status='concluida';order.closedAt=new Date();await order.save({transaction:t});await t.commit();await audit(req,'workorder.complete','WorkOrder',order.id);res.json(order);}catch(e){await t.rollback();res.status(400).json({message:e.message});}});
r.post('/workorders/:id/checkout',allow('workorders'),async(req,res)=>{const t=await db.transaction();try{const order=await WorkOrder.findOne({where:{id:req.params.id,CompanyId:req.companyId},transaction:t,lock:t.LOCK.UPDATE});if(!order||order.status!=='concluida')throw new Error('Conclua a OS antes de cobrar.');const cash=await openCash(req.companyId,t);if(!cash)throw new Error('Abra o caixa antes de receber.');const method=req.body.paymentMethod||'dinheiro';const sale=await Sale.create({CompanyId:req.companyId,CustomerId:order.CustomerId,number:`OS-${order.number}`,subtotal:order.total,discount:0,total:order.total,paymentMethod:method,status:'concluida'},{transaction:t});await SaleItem.create({CompanyId:req.companyId,SaleId:sale.id,description:`Serviços e peças da ${order.number}`,quantity:1,unitPrice:order.total,total:order.total},{transaction:t});await CashMovement.create({CompanyId:req.companyId,CashSessionId:cash.id,type:'entrada',category:'Ordem de serviço',description:`OS ${order.number}`,amount:order.total,paymentMethod:method},{transaction:t});order.status='entregue';await order.save({transaction:t});await t.commit();await audit(req,'workorder.checkout','WorkOrder',order.id,{total:order.total});res.json(order);}catch(e){await t.rollback();res.status(400).json({message:e.message});}});

// Funcionários e permissões: somente proprietário administra contas e papéis.
r.get('/employees',allow('employees'),async(req,res)=>res.json(await User.findAll({where:{CompanyId:req.companyId},attributes:['id','name','email','role','active','createdAt']})));
r.post('/employees',allow('employees'),async(req,res)=>{const {name,email,password,role='employee'}=req.body;if(!name||!email||!password||password.length<10||!['manager','employee'].includes(role))return res.status(400).json({message:'Informe nome, e-mail, senha (mínimo 10 caracteres) e papel válido.'});if(await User.findOne({where:{email}}))return res.status(409).json({message:'E-mail já utilizado.'});const u=await User.create({CompanyId:req.companyId,name,email,password:await bcrypt.hash(password,12),role});await audit(req,'employee.create','User',u.id,{role});res.status(201).json({id:u.id,name,email,role});});
r.patch('/employees/:id',allow('employees'),async(req,res)=>{const u=await User.findOne({where:{id:req.params.id,CompanyId:req.companyId}});if(!u)return res.status(404).json({message:'Funcionário não encontrado.'});if(u.id===req.user.id&&req.body.active===false)return res.status(400).json({message:'Não é possível desativar seu próprio usuário.'});const fields={};if(['manager','employee'].includes(req.body.role))fields.role=req.body.role;if(typeof req.body.active==='boolean')fields.active=req.body.active;if(req.body.password&&req.body.password.length>=10){fields.password=await bcrypt.hash(req.body.password,12);fields.tokenVersion=Number(u.tokenVersion||0)+1;}await u.update(fields);await audit(req,'employee.update','User',u.id,fields);res.json({id:u.id,name:u.name,email:u.email,role:u.role,active:u.active});});

// SaaS: registro local do plano. Gateway real requer credenciais/contrato do provedor escolhido.
r.get('/subscription',allow('company'),async(req,res)=>res.json(await Subscription.findOne({where:{CompanyId:req.companyId},order:[['createdAt','DESC']]})));
r.post('/subscription/checkout',allow('company'),async(req,res)=>{const plan=['essencial','profissional','premium'].includes(req.body.plan)?req.body.plan:null;if(!plan)return res.status(400).json({message:'Plano inválido.'});const sub=await Subscription.create({CompanyId:req.companyId,plan,status:'pending',provider:process.env.BILLING_PROVIDER||'manual'});res.status(202).json({subscription:sub,message:'Assinatura registrada como pendente. Configure um gateway e webhook para cobrança real.'});});

// Fiscal: adaptador seguro por contrato; não simula autorização de SEFAZ.
r.post('/fiscal/documents',allow('financial'),async(req,res)=>{if(!process.env.FISCAL_PROVIDER_URL||!process.env.FISCAL_PROVIDER_TOKEN)return res.status(503).json({message:'Integração fiscal não configurada. Contrate e configure um provedor fiscal compatível com sua UF/município e certificado.'});const doc=await FiscalDocument.create({CompanyId:req.companyId,type:req.body.type||'NFC-e',status:'pending',provider:process.env.FISCAL_PROVIDER_NAME||'external',payload:req.body});res.status(202).json({document:doc,message:'Solicitação registrada. Falta implementar o adaptador específico e homologar com o provedor.'});});

// Notificações agendadas e envio para dispositivos da própria empresa.
r.post('/notifications/schedule',allow('push'),async(req,res)=>{const {title,body,scheduledAt}=req.body;const date=new Date(scheduledAt);if(!title||!body||!Number.isFinite(date.getTime())||date<=new Date())return res.status(400).json({message:'Informe título, mensagem e data futura válida.'});const job=await NotificationJob.create({CompanyId:req.companyId,title,body,scheduledAt:date});res.status(201).json(job);});
r.get('/notifications',allow('push'),async(req,res)=>res.json(await NotificationJob.findAll({where:{CompanyId:req.companyId},order:[['scheduledAt','DESC']],limit:100})));
r.get('/push/config',allow('push'),(req,res)=>res.json({publicKey:process.env.VAPID_PUBLIC_KEY||null,configured:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)}));
r.post('/push/subscribe',allow('push'),async(req,res,next)=>{try{const {subscription}=req.body;if(!subscription?.endpoint||!subscription?.keys)return res.status(400).json({message:'Assinatura inválida.'});await PushSubscription.findOrCreate({where:{CompanyId:req.companyId,endpoint:subscription.endpoint},defaults:{CompanyId:req.companyId,endpoint:subscription.endpoint,keys:subscription.keys}});res.status(201).json({message:'Dispositivo inscrito.'});}catch(e){next(e);}});

// Assistente com contexto limitado: envia apenas indicadores agregados da empresa autenticada.
r.post('/assistant/ask', allow('assistant'), async (req, res) => {
  try {
    const question = String(req.body.message || '').trim().slice(0, 1000);
    if (!question) return res.status(400).json({ message: 'Digite uma pergunta.' });

    const companyId = req.companyId;
    const [revenue, openOrders, lowStock, payables, receivables, productsCount] = await Promise.all([
      Sale.sum('total', { where: { CompanyId: companyId, status: 'concluida' } }),
      WorkOrder.count({ where: { CompanyId: companyId, status: { [Op.in]: ['orcamento', 'aprovada', 'em_andamento', 'aguardando_peca'] } } }),
      Product.count({ where: { CompanyId: companyId, active: true, stock: { [Op.lte]: db.col('min_stock') } } }),
      FinancialEntry.sum('amount', { where: { CompanyId: companyId, type: 'pagar', status: 'pendente' } }),
      FinancialEntry.sum('amount', { where: { CompanyId: companyId, type: 'receber', status: 'pendente' } }),
      Product.count({ where: { CompanyId: companyId, active: true } })
    ]);

    const context = {
      faturamentoAcumuladoRegistrado: Number(revenue || 0),
      ordensEmAberto: openOrders,
      produtosAbaixoDoMinimo: lowStock,
      contasAPagarPendente: Number(payables || 0),
      contasAReceberPendente: Number(receivables || 0),
      produtosAtivos: productsCount
    };

    const key = String(process.env.OPENAI_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
    if (!key) {
      return res.json({
        answer: `A integração com a OpenAI ainda não está configurada no servidor. Enquanto isso, segue o resumo: faturamento registrado ${context.faturamentoAcumuladoRegistrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}; ${openOrders} OS em aberto; ${lowStock} produtos abaixo do mínimo; contas a pagar ${Number(payables || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}; contas a receber ${Number(receivables || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Confira se a chave está em oficinapro/server/.env (OPENAI_API_KEY=...) e reinicie o backend.`,
        context
      });
    }

    const model = String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
    const endpoint = String(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions').trim();
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Você é o assistente do OficinaPro. Responda em português, usando somente os indicadores fornecidos no contexto da empresa autenticada. Os valores são agregados e autorizados. Não invente dados, não identifique clientes, não execute lançamentos e nunca solicite senhas ou dados completos de cartão. Avise quando um indicador não estiver disponível.'
            },
            { role: 'user', content: `Indicadores atuais (BRL): ${JSON.stringify(context)}\nPergunta: ${question}` }
          ],
          temperature: 0.2
        })
      });
    } catch (error) {
      console.error('[OpenAI] Falha de conexão:', error?.name || 'erro');
      return res.status(502).json({ message: error?.name === 'TimeoutError'
        ? 'A OpenAI demorou demais para responder. Tente novamente.'
        : 'Não foi possível conectar à OpenAI. Verifique a internet do servidor e tente novamente.' });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiCode = data?.error?.code || data?.error?.type || '';
      const apiMessage = String(data?.error?.message || 'Erro não detalhado pela OpenAI');
      // Log útil para diagnóstico, sem registrar a chave nem a pergunta do usuário.
      console.error(`[OpenAI] HTTP ${response.status}; code=${apiCode}; message=${apiMessage.slice(0, 300)}`);

      if (response.status === 401) {
        return res.status(502).json({ message: 'A OpenAI rejeitou a API Key (401). Confira se copiou a chave completa, sem espaços, se ela não foi revogada e se pertence à organização/projeto correto.' });
      }
      if (response.status === 403) {
        return res.status(502).json({ message: 'A OpenAI recusou o acesso (403). Verifique as permissões da chave, o projeto/organização selecionado e o acesso ao modelo configurado.' });
      }
      if (response.status === 429) {
        const billingIssue = /insufficient_quota|billing|quota|credit_balance_exhausted/i.test(`${apiCode} ${apiMessage}`);
        return res.status(502).json({ message: billingIssue
          ? 'A API da OpenAI está sem cota/créditos disponíveis. Acesse o faturamento da Plataforma API, confira o saldo e os limites de uso. A assinatura do ChatGPT não inclui automaticamente créditos de API.'
          : 'A OpenAI limitou temporariamente as requisições (429). Aguarde um pouco ou confira os limites de taxa e de uso da sua organização.' });
      }
      if (response.status === 404) {
        return res.status(502).json({ message: `O modelo “${model}” ou o endpoint configurado não foi encontrado (404). Confira OPENAI_MODEL no arquivo server/.env.` });
      }
      return res.status(502).json({ message: `A OpenAI retornou erro HTTP ${response.status}. Confira o terminal do backend para o código do erro; não compartilhe sua API Key.` });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({ message: 'A OpenAI respondeu, mas não retornou texto. Confira se o modelo configurado aceita Chat Completions.' });
    return res.json({ answer, context });
  } catch (error) {
    console.error('[Assistente OficinaPro] Erro interno:', error?.message || 'erro desconhecido');
    return res.status(500).json({ message: 'Não foi possível preparar os dados do assistente. Confira o terminal do backend.' });
  }
});
r.get('/audit',allow('company'),async(req,res)=>res.json(await AuditLog.findAll({where:{CompanyId:req.companyId},order:[['createdAt','DESC']],limit:200})));
export default r;
