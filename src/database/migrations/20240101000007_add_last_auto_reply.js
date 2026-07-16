export function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.timestamp('last_auto_reply').defaultTo(null);
  });
}

export function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_auto_reply');
  });
}
