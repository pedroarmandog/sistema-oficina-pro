import 'dotenv/config';
import { Sequelize } from 'sequelize';

const useSSL = process.env.DB_SSL === 'true' || /tidbcloud\.com$/i.test(process.env.DB_HOST || '');

const sequelize = new Sequelize(process.env.DB_NAME || 'oficinapro', process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', {
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), dialect: 'mysql',
  ...(useSSL ? { dialectOptions: { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } } : {}),
  logging: process.env.NODE_ENV === 'development' ? false : false,
  define: { underscored: true, timestamps: true },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
});
export default sequelize;
