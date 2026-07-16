export function up(knex) {
  return knex.schema.createTable('menu_items', (table) => {
    table.increments('id');
    table.integer('category_id').notNullable().references('id').inTable('menu_categories').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.decimal('price', 10, 2);
    table.string('emoji', 32).defaultTo('🔹');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.index('category_id');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('menu_items');
}
