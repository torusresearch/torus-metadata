exports.up = function (knex) {
  return knex.schema.createTable("data", (table) => {
    table.increments("id");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.string("key", 255).notNullable().unique();
    table.text("value", "mediumtext").notNullable().defaultTo("");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("data");
};
