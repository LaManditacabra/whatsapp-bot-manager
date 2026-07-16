export async function seed(knex) {
  await knex('menu_items').del();
  await knex('menu_categories').del();

  const [cat] = await knex('menu_categories')
    .insert([
      { name: 'Pizzas', emoji: '🍕', sort_order: 1 },
    ])
    .returning('id');

  await knex('menu_items').insert([
    { category_id: cat.id, name: 'Prepizza', description: 'Masa lista para armar', emoji: '🍕' },
    { category_id: cat.id, name: 'Pizzetas x6', description: 'Pack de 6 pizzetas', emoji: '🥟' },
    { category_id: cat.id, name: 'Pizzetas x12', description: 'Pack de 12 pizzetas', emoji: '🥟' },
  ]);
}
