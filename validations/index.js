const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "object" && Object.keys(value).length === 0) ||
  (typeof value === "string" && value.trim().length === 0);

exports.isEmpty = isEmpty;

exports.validateInput = (data, fieldNames) => {
  const errors = {};
  for (let index = 0; index < fieldNames.length; index += 1) {
    const fieldName = fieldNames[index];
    data[fieldName] = !isEmpty(data[fieldName]) ? data[fieldName] : "";

    if (isEmpty(data[fieldName])) {
      errors[fieldName] = `${fieldName} field is required`;
    }
  }

  return {
    errors,
    isValid: isEmpty(errors),
  };
};
