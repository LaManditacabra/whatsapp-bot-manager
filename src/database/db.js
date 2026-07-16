import knexLib from 'knex';
import config from './knex.js';

const db = knexLib(config);

export default db;
