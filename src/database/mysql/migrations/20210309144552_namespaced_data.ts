import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
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
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("test").dropTable("tkey").dropTable("webauthn");
}
