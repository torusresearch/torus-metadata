function isErrorObj(err) {
  return err && err.stack && err.message;
}

export const getError = (error) => {
  if (isErrorObj(error)) return { message: error.message };
  return error;
};

export const constructKey = (pubKeyX: string, pubKeyY: string, namespace: string) => {
  let key = `${pubKeyX}\x1c${pubKeyY}`;
  if (namespace) key += `\x1c${namespace}`;
  return key;
};

export const randomID = () => `${Math.random().toString(36).substring(2, 9)}`;

export const REDIS_TIMEOUT = 10; // seconds
export const REDIS_LOCK_TIMEOUT = 60;
export const MAX_BATCH_SIZE = 60 * 1024 * 1024; // 60MB

export const REDIS_NAME_SPACE = "EMAIL_AUTH_DATA";
