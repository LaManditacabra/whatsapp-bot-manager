export function up(knex) {
  return knex.schema.createTable('conversations', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 64).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('message').notNullable();
    table.text('response');
    table.string('type', 32).defaultTo('text');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('user_id');
    table.index('created_at');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('conversations');
}
