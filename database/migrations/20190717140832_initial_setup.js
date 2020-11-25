exports.up = function (knex) {
  return knex.schema.createTable("data", (table) => {
    table.increments("id");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.string("key", 255).notNullable();
    table.text("value", "mediumtext").notNullable().defaultTo("");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("data");
};

/*

-- CREATE TABLE metadata.data_backup2 AS
--    SELECT *
--    FROM metadata.data;
-- drop table metadata.data;


CREATE TABLE `data` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `key` varchar(255) NOT NULL,
  `value` mediumtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`),
) ENGINE=InnoDB AUTO_INCREMENT=8439 DEFAULT CHARSET=utf8mb4
*/
