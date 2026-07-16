import config from '../config/index.js';

const knexConfig = {
  development: {
    client: 'pg',
    connection: {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    },
    migrations: {
      directory: './src/database/migrations',
      extension: 'js',
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'js',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,

    },
    migrations: {
      directory: './src/database/migrations',
      extension: 'js',
    },
    pool: { min: 2, max: 10 },
  },
};

const environment = process.env.NODE_ENV || 'development';

export default knexConfig[environment];

export { knexConfig };
