/* eslint-disable n/no-unpublished-import */
/* eslint-disable import/no-extraneous-dependencies */
// Mocha Setup
import atob from "atob";
import btoa from "btoa";
import dotenv from "dotenv";
import FormData from "form-data";
import fetch from "node-fetch";

global.btoa = btoa;
global.atob = atob;
global.fetch = fetch;
global.FormData = FormData;

// Comment in/out the following line to include/disclude comments in terminal
if (process.env.LOG_DEBUG === "no") {
  // eslint-disable-next-line no-console
  console.log = function () {};
}

dotenv.config();
