module.exports = function(object, stringify) {
  const keys = Object.keys(object);
  return {
    keys,
    values: keys.map(function(key) {
      let value = object[key];
      if (stringify && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    })
  };
};
