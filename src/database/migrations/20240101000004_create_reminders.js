export function up(knex) {
  return knex.schema.createTable('reminders', (table) => {
    table.increments('id');
    table.string('user_id', 64).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('message').notNullable();
    table.timestamp('scheduled_at').notNullable();
    table.boolean('sent').defaultTo(false);
    table.timestamp('sent_at');
    table.timestamps(true, true);
    table.index('scheduled_at');
    table.index('sent');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('reminders');
}
