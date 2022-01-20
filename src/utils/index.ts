function isErrorObj(err) {
  return err && err.stack && err.message;
}

export const getError = (error) => {
  if (isErrorObj(error)) return { message: error.message };
  return error;
};
