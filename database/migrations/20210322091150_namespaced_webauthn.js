exports.up = function (knex) {
  return knex.schema
    .createTable("oauth_credid_cache", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
    })
    .createTable("oauth_userinfo", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
    })
    .createTable("webauthn_torus_share", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
    })
    .createTable("webauthn_device_share", (table) => {
      table.increments("id");
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.string("key", 255).notNullable();
      table.text("value", "mediumtext").notNullable().defaultTo("");
    });
};

exports.down = function (knex) {
  return knex.schema.dropTable("webauthn_device_share").dropTable("webauthn_torus_share").dropTable("oauth_userinfo").dropTable("oauth_credid_cache");
};
