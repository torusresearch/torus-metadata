// Mocha Setup
global.btoa = require("btoa");
global.atob = require("atob");
global.fetch = require("node-fetch");
global.FormData = require("form-data");

// Comment in/out the following line to include/disclude comments in terminal
if (process.env.LOG_DEBUG === "no") {
  console.log = function () {};
}

require("dotenv").config();
