exports.up = function (knex) {
  return knex.schema
    .createTable("tkey", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
    })
    .createTable("webauthn", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
    });
};

exports.down = function (knex) {
  return knex.schema.dropTable("default").dropTable("tkey").dropTable("webauthn");
};
