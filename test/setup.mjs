// Mocha Setup
import dotenv from "dotenv";

// Comment in/out the following line to include/disclude comments in terminal
if (process.env.LOG_DEBUG === "no") {
  // eslint-disable-next-line no-console
  console.log = function () {};
}

dotenv.config();
