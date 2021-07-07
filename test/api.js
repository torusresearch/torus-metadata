/* eslint-disable no-console */
/* eslint-disable node/no-unpublished-require */
/**
 * @fileOverview Unit test file for API-calls
 * @module
 * @author Shubham Rathi
 * @requires NPM:chai
 * @requires NPM:chai-http
 */

// During the test the env variable is set to test
// Require the dev-dependencies
const chai = require("chai");
const chaiHttp = require("chai-http");
require("dotenv").config();

const port = 5051;
const host = process.env.HOST || "localhost";
const server = `http://${host}:${port}`;
chai.use(chaiHttp);
const { assert, request } = chai;

// Comment in/out the following line to include/disclude comments in terminal
if (process.env.LOG_DEBUG === "no") {
  console.log = function () {};
}

/**
 * Testing API calls.
 */
describe("API-calls", function () {
  /**
   * DO NOT USE THIS PAIR ELSE WHERE. THIS IS STRICTLY FOR TESTING PURPOSES.
   */
  const publicAddress = "0xd682b1Db49c010BF03BafC4Cf7CC366D9b8A4a03";
  const privateKey = "9bc166bda58a5e189bf24f4faa1296c5fcf9b818ed23492d5a7239ce102e9301";

  /**
   * before() block is called before all the other tests are conducted
   * we are using this to generate a authentication token
   */
  before("One time execution for all tests", async function () {});

  /*
   * Test the /GET route
   */
  describe("/Homepage", function () {
    it("it should return a welcome message", async function () {
      const res = await request(server).get("/");
      console.log("res.text is", res.text);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.text, "Welcome to Torus Metadata");
    });

    it("it should return ok message", async function () {
      const res = await request(server).get("/health");
      console.log("res.text is", res.text);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.text, "Ok!");
    });
  });

  after(function () {
    console.log("After block called after conducting all the unit tests");
    // done();
  });

  /*
   * Test the /POST route
   */
});
