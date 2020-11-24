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

exports.randomID = () => {
  return `${Math.random().toString(36).substr(2, 9)}`;
};

exports.REDIS_TIMEOUT = 10; // seconds
