export function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.string('id', 64).primary();
    table.string('name', 255).notNullable();
    table.string('phone', 32).notNullable();
    table.boolean('is_bot').defaultTo(false);
    table.string('role', 32).defaultTo('user');
    table.timestamp('last_interaction').defaultTo(knex.fn.now());
    table.timestamps(true, true);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('users');
}
