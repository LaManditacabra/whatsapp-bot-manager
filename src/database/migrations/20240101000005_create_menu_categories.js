export function up(knex) {
  return knex.schema.createTable('menu_categories', (table) => {
    table.increments('id');
    table.string('name', 255).notNullable();
    table.string('emoji', 32).defaultTo('📋');
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('menu_categories');
}
