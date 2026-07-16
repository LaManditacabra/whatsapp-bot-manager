export function up(knex) {
  return knex.schema.createTable('keywords', (table) => {
    table.increments('id');
    table.string('keyword', 255).notNullable();
    table.text('response').notNullable();
    table.string('media_url', 512);
    table.string('media_type', 32);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.unique('keyword');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('keywords');
}
