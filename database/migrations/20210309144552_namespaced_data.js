exports.up = function (knex) {
  return knex.schema
    .createTable("tkey", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
      table.index(["key"], "idx_key");
    })
    .createTable("webauthn", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
      table.index(["key"], "idx_key");
    })
    .createTable("test", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
      table.index(["key"], "idx_key");
    });
};

exports.down = function (knex) {
  return knex.schema.dropTable("test").dropTable("tkey").dropTable("webauthn");
};
