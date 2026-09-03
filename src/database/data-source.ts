import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

const host =
  process.env.MIGRATION_DB_HOST ||
  (process.env.DATABASE_HOST === 'postgres'
    ? 'localhost'
    : process.env.DATABASE_HOST);

const port =
  Number(process.env.MIGRATION_DB_PORT) ||
  (process.env.DATABASE_HOST === 'postgres'
    ? 5433
    : Number(process.env.DATABASE_PORT));

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host,
  port,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + '/../**/*.entity.{js,ts}'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
