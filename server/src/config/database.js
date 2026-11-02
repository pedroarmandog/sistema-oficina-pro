
import dotenv from 'dotenv';
import path from 'node:path';
import { Sequelize } from 'sequelize';

dotenv.config({
  
  path: path.resolve(process.cwd(), 'server/.env')
});



const sslEnabled = process.env.DB_SSL === 'true';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'oficinapro',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',

    logging: false,

    define: {
      underscored: true,
      timestamps: true
    },

    dialectOptions: {
      ...(sslEnabled && {
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true
        }
      })
    },

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export default sequelize;
