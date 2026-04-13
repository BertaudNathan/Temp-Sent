export function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} introuvable`);
  return node;
}

export function setText(id, text) {
  el(id).textContent = text;
}

export function setError(id, err) {
  const msg = err ? (err?.message || String(err)) : "";
  el(id).textContent = msg;
}

export function renderList(containerId, items, formatter) {
  const container = el(containerId);
  container.innerHTML = "";

  for (const item of items) {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = formatter(item);
    container.appendChild(div);
  }
}

export function formatTelemetry(item) {
  const ts = item.timestamp_server ?? item.timestamp ?? item.timestamp_device ?? "";
  const id = item.device_id ?? "?";
  const t = item.temperature ?? "";
  const h = item.humidity ?? "";
  return `${id} | T=${t} H=${h} | ts=${ts}`;
}

export function formatHardware(item) {
  const ts = item.timestamp_server ?? item.timestamp ?? item.timestamp_device ?? "";
  const id = item.device_id ?? "?";
  const k = item.kpi_type ?? "";
  const topic = item.topic ?? "";
  return `${id} | ${k} | ${topic} | ts=${ts}`;
}
