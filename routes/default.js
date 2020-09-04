/**
 * Express Router for Homepage and health-check
 * @author Chaitanya
 * @module Defaults
 */

/**
 * express module
 * @const
 * @ignore
 */

const express = require("express");

/**
 * Express router to mount user related functions on.
 * @type {object}
 * @const
 */
const router = express.Router();

/**
 * Returns a welcome string
 * @name / GET
 * @function
 * @param {string} path relative express path
 * @param {callback} middleware express middleware
 * @returns {String} welcome strign
 * @example
 * // Set auth headers
 * fetch("/")
 * -> "Welcome to torus backend"
 */
router.get("/", (req, res) => {
  res.send("Welcome to Torus Metadata");
});

/**
 * Server health check
 * @name /health GET
 * @function
 * @param {string} path relative express path
 * @param {callback} middleware express middleware
 * @returns {Status} 200
 *
 * @example
 * // Set auth headers
 * fetch("/health")
 * -> "Ok!"
 */
router.get("/health", (req, res) => {
  res.status(200).send("Ok!");
});

module.exports = router;
