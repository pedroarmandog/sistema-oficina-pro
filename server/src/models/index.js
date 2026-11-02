import { DataTypes } from 'sequelize';
import db from '../config/database.js';

export const Company = db.define('Company', {
  name: { type: DataTypes.STRING(140), allowNull: false }, document: DataTypes.STRING(30), segment: { type: DataTypes.STRING(50), defaultValue: 'oficina_mecanica' },
  email: DataTypes.STRING(160), phone: DataTypes.STRING(30), logo: DataTypes.STRING(255), primaryColor: { type: DataTypes.STRING(20), defaultValue: '#2563eb' },
  secondaryColor: { type: DataTypes.STRING(20), defaultValue: '#0f172a' }, plan: { type: DataTypes.STRING(30), defaultValue: 'trial' }, active: { type: DataTypes.BOOLEAN, defaultValue: true }
});
export const User = db.define('User', { name: { type: DataTypes.STRING(120), allowNull: false }, email: { type: DataTypes.STRING(160), allowNull: false, unique: true }, password: { type: DataTypes.STRING(255), allowNull: false }, role: { type: DataTypes.ENUM('owner','manager','employee'), defaultValue: 'owner' }, tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, defaultValue: true } });
export const Customer = db.define('Customer', { name: { type: DataTypes.STRING(140), allowNull: false }, document: DataTypes.STRING(30), phone: DataTypes.STRING(30), email: DataTypes.STRING(160), address: DataTypes.STRING(255), notes: DataTypes.TEXT });
export const Supplier = db.define('Supplier', { name: { type: DataTypes.STRING(140), allowNull: false }, document: DataTypes.STRING(30), phone: DataTypes.STRING(30), email: DataTypes.STRING(160), contact: DataTypes.STRING(120) });
export const Product = db.define('Product', { name: { type: DataTypes.STRING(160), allowNull: false }, sku: DataTypes.STRING(60), barcode: DataTypes.STRING(80), category: DataTypes.STRING(80), unit: { type: DataTypes.STRING(12), defaultValue: 'un' }, costPrice: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, salePrice: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, stock: { type: DataTypes.DECIMAL(12,3), defaultValue: 0 }, minStock: { type: DataTypes.DECIMAL(12,3), defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, defaultValue: true } });
export const Vehicle = db.define('Vehicle', { plate: DataTypes.STRING(12), brand: DataTypes.STRING(60), model: DataTypes.STRING(80), year: DataTypes.STRING(10), color: DataTypes.STRING(40), type: DataTypes.STRING(30), mileage: DataTypes.INTEGER, notes: DataTypes.TEXT });
export const Service = db.define('Service', { name: { type: DataTypes.STRING(140), allowNull: false }, description: DataTypes.TEXT, price: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, estimatedMinutes: DataTypes.INTEGER, active: { type: DataTypes.BOOLEAN, defaultValue: true } });
export const WorkOrder = db.define('WorkOrder', { number: { type: DataTypes.STRING(30), allowNull: false }, status: { type: DataTypes.ENUM('orcamento','aprovada','em_andamento','aguardando_peca','concluida','entregue','cancelada'), defaultValue: 'orcamento' }, complaint: DataTypes.TEXT, diagnosis: DataTypes.TEXT, notes: DataTypes.TEXT, laborTotal: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, productsTotal: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, discount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, total: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, promisedAt: DataTypes.DATE, closedAt: DataTypes.DATE });
export const WorkOrderItem = db.define('WorkOrderItem', { kind: { type: DataTypes.ENUM('product','service'), allowNull: false }, description: { type: DataTypes.STRING(160), allowNull: false }, quantity: { type: DataTypes.DECIMAL(12,3), defaultValue: 1 }, unitPrice: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, total: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 } });
export const CashSession = db.define('CashSession', { openedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }, closedAt: DataTypes.DATE, openingAmount: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }, closingAmount: DataTypes.DECIMAL(12,2), expectedAmount: DataTypes.DECIMAL(12,2), status: { type: DataTypes.ENUM('open','closed'), defaultValue: 'open' }, notes: DataTypes.TEXT });
export const CashMovement = db.define('CashMovement', { type: { type: DataTypes.ENUM('entrada','saida','sangria','suprimento'), allowNull: false }, category: DataTypes.STRING(80), description: DataTypes.STRING(180), amount: { type: DataTypes.DECIMAL(12,2), allowNull: false }, paymentMethod: DataTypes.STRING(30), occurredAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } });
export const FinancialEntry = db.define('FinancialEntry', { type: { type: DataTypes.ENUM('receber','pagar'), allowNull: false }, description: { type: DataTypes.STRING(180), allowNull: false }, category: DataTypes.STRING(80), amount: { type: DataTypes.DECIMAL(12,2), allowNull: false }, dueDate: DataTypes.DATEONLY, paidAt: DataTypes.DATE, status: { type: DataTypes.ENUM('pendente','pago','cancelado'), defaultValue: 'pendente' }, paymentMethod: DataTypes.STRING(30), notes: DataTypes.TEXT });
export const Sale = db.define('Sale', { number: { type: DataTypes.STRING(30), allowNull: false }, subtotal: DataTypes.DECIMAL(12,2), discount: DataTypes.DECIMAL(12,2), total: { type: DataTypes.DECIMAL(12,2), allowNull: false }, paymentMethod: DataTypes.STRING(30), status: { type: DataTypes.STRING(20), defaultValue: 'concluida' }, soldAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } });
export const SaleItem = db.define('SaleItem', { description: DataTypes.STRING(160), quantity: DataTypes.DECIMAL(12,3), unitPrice: DataTypes.DECIMAL(12,2), total: DataTypes.DECIMAL(12,2) });
export const StockMovement = db.define('StockMovement', { type: { type: DataTypes.ENUM('entrada','saida','ajuste'), allowNull: false }, quantity: { type: DataTypes.DECIMAL(12,3), allowNull: false }, reason: DataTypes.STRING(160), unitCost: DataTypes.DECIMAL(12,2) });
export const PushSubscription = db.define('PushSubscription', { endpoint: { type: DataTypes.TEXT, allowNull: false }, keys: { type: DataTypes.JSON, allowNull: false } });

const tenantModels = [User, Customer, Supplier, Product, Vehicle, Service, WorkOrder, WorkOrderItem, CashSession, CashMovement, FinancialEntry, Sale, SaleItem, StockMovement, PushSubscription];
Company.hasMany(User); User.belongsTo(Company);
for (const Model of tenantModels.filter(m => m !== User)) { Company.hasMany(Model); Model.belongsTo(Company); }
Customer.hasMany(Vehicle); Vehicle.belongsTo(Customer);
Customer.hasMany(WorkOrder); WorkOrder.belongsTo(Customer);
Vehicle.hasMany(WorkOrder); WorkOrder.belongsTo(Vehicle);
WorkOrder.hasMany(WorkOrderItem, { as: 'items', onDelete: 'CASCADE' }); WorkOrderItem.belongsTo(WorkOrder);
Product.hasMany(WorkOrderItem); WorkOrderItem.belongsTo(Product);
Service.hasMany(WorkOrderItem); WorkOrderItem.belongsTo(Service);
CashSession.hasMany(CashMovement); CashMovement.belongsTo(CashSession);
Customer.hasMany(Sale); Sale.belongsTo(Customer); Sale.hasMany(SaleItem, { as: 'items' }); SaleItem.belongsTo(Sale); Product.hasMany(SaleItem); SaleItem.belongsTo(Product);
Product.hasMany(StockMovement); StockMovement.belongsTo(Product);
export { db };

// Módulos operacionais e SaaS adicionados na evolução do produto.
export const Purchase = db.define('Purchase', { number: { type: DataTypes.STRING(30), allowNull: false }, status: { type: DataTypes.ENUM('recebida','cancelada','devolvida_parcial','devolvida_total'), defaultValue: 'recebida' }, subtotal: DataTypes.DECIMAL(12,2), discount: DataTypes.DECIMAL(12,2), total: DataTypes.DECIMAL(12,2), purchasedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }, notes: DataTypes.TEXT });
export const PurchaseItem = db.define('PurchaseItem', { description: DataTypes.STRING(160), quantity: DataTypes.DECIMAL(12,3), returnedQuantity: { type: DataTypes.DECIMAL(12,3), defaultValue: 0 }, unitCost: DataTypes.DECIMAL(12,2), total: DataTypes.DECIMAL(12,2) });
export const PasswordReset = db.define('PasswordReset', { tokenHash: { type: DataTypes.STRING(128), allowNull: false }, expiresAt: { type: DataTypes.DATE, allowNull: false }, usedAt: DataTypes.DATE });
export const AuditLog = db.define('AuditLog', { action: { type: DataTypes.STRING(80), allowNull: false }, entity: DataTypes.STRING(80), entityId: DataTypes.STRING(40), metadata: DataTypes.JSON, ip: DataTypes.STRING(60) });
export const Subscription = db.define('Subscription', { provider: { type: DataTypes.STRING(40), defaultValue: 'manual' }, providerId: DataTypes.STRING(160), plan: { type: DataTypes.STRING(40), defaultValue: 'trial' }, status: { type: DataTypes.STRING(30), defaultValue: 'trialing' }, currentPeriodEnd: DataTypes.DATE });
export const FiscalDocument = db.define('FiscalDocument', { provider: DataTypes.STRING(60), externalId: DataTypes.STRING(160), type: DataTypes.STRING(20), status: { type: DataTypes.STRING(30), defaultValue: 'pending' }, accessKey: DataTypes.STRING(60), xmlUrl: DataTypes.STRING(500), pdfUrl: DataTypes.STRING(500), payload: DataTypes.JSON, error: DataTypes.TEXT });
export const NotificationJob = db.define('NotificationJob', { title: DataTypes.STRING(140), body: DataTypes.STRING(500), scheduledAt: DataTypes.DATE, sentAt: DataTypes.DATE, status: { type: DataTypes.STRING(20), defaultValue: 'pending' }, metadata: DataTypes.JSON });
for (const Model of [Purchase, PurchaseItem, PasswordReset, AuditLog, Subscription, FiscalDocument, NotificationJob]) { Company.hasMany(Model); Model.belongsTo(Company); }
Supplier.hasMany(Purchase); Purchase.belongsTo(Supplier);
Purchase.hasMany(PurchaseItem, { as: 'items', onDelete: 'CASCADE' }); PurchaseItem.belongsTo(Purchase);
Product.hasMany(PurchaseItem); PurchaseItem.belongsTo(Product);
User.hasMany(PasswordReset); PasswordReset.belongsTo(User); User.hasMany(AuditLog); AuditLog.belongsTo(User);
