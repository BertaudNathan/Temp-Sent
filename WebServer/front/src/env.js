function required(name) {
  const value = import.meta.env[name];
  if (value == null || String(value).trim() === "") {
    throw new Error(`${name} manquant dans .env`);
  }
  return String(value);
}

export const env = {
  apiBaseUrl: required("VITE_API_BASE_URL").replace(/\/+$/, ""),
};
