function isErrorObj(err) {
  return err && err.stack && err.message;
}

exports.getError = (error) => {
  if (isErrorObj(error)) return { message: error.message };
  return error;
};

exports.constructKey = (pubKeyX, pubKeyY, namespace) => {
  let key = `${pubKeyX}\x1c${pubKeyY}`;
  if (namespace) key += `\x1c${namespace}`;
  return key;
};

exports.REDIS_TIMEOUT = 10; // seconds
