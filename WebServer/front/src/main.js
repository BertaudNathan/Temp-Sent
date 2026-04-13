import { env } from "./env.js";
import { getJson, postJson } from "./apiClient.js";
import { el, setText, setError, renderList, formatTelemetry, formatHardware } from "./ui.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const HOT_POLL_INTERVAL_MS = 2000;

async function refreshCold({ source, limit }) {
  const telemetry = await getJson(`/api/v1/telemetry?source=${encodeURIComponent(source)}&limit=${limit}`);
  const hardware = await getJson(`/api/v1/hardware?source=${encodeURIComponent(source)}&limit=${limit}`);
  return {
    telemetry: telemetry.data || [],
    hardware: hardware.data || [],
  };
}

async function refreshHotTelemetry(limit) {
  const telemetry = await getJson(`/api/v1/telemetry?source=hot&limit=${limit}`);
  return telemetry.data || [];
}

async function refreshHotHardware(limit) {
  const hardware = await getJson(`/api/v1/hardware?source=hot&limit=${limit}`);
  return hardware.data || [];
}

async function main() {
  setText("apiBaseUrl", env.apiBaseUrl);
  setText("rtdbPath", "API uniquement (hot/cold/both)");

  let telemetryTimer = null;
  let hardwareTimer = null;

  async function doRefreshHotTelemetry() {
    setError("telemetryRealtimeError", null);
    try {
      const limit = clamp(Number(el("telemetryLimit").value), 1, 100);
      const items = await refreshHotTelemetry(limit);
      renderList("telemetryRealtime", items, formatTelemetry);
    } catch (err) {
      setError("telemetryRealtimeError", err);
    }
  }

  async function doRefreshHotHardware() {
    setError("hardwareRealtimeError", null);
    try {
      const limit = clamp(Number(el("hardwareLimit").value), 1, 100);
      const items = await refreshHotHardware(limit);
      renderList("hardwareRealtime", items, formatHardware);
    } catch (err) {
      setError("hardwareRealtimeError", err);
    }
  }

  function startTelemetryPolling() {
    if (telemetryTimer) clearInterval(telemetryTimer);
    void doRefreshHotTelemetry();
    telemetryTimer = setInterval(() => void doRefreshHotTelemetry(), HOT_POLL_INTERVAL_MS);
  }

  function startHardwarePolling() {
    if (hardwareTimer) clearInterval(hardwareTimer);
    void doRefreshHotHardware();
    hardwareTimer = setInterval(() => void doRefreshHotHardware(), HOT_POLL_INTERVAL_MS);
  }

  async function doRefreshCold() {
    setError("coldError", null);
    try {
      const source = el("coldSource").value;
      const limit = clamp(Number(el("coldLimit").value), 1, 1000);
      const data = await refreshCold({ source, limit });
      renderList("telemetryCold", data.telemetry, formatTelemetry);
      renderList("hardwareCold", data.hardware, formatHardware);
    } catch (err) {
      setError("coldError", err);
    }
  }

  async function doSendCommand() {
    setError("actionError", null);
    el("actionResult").textContent = "";

    try {
      const id = String(el("actuatorId").value || "").trim();
      if (!id) throw new Error("Actuator ID requis");
      const command = el("actuatorCommand").value;

      const result = await postJson(`/api/v1/actuators/${encodeURIComponent(id)}/command`, { command });
      el("actionResult").textContent = JSON.stringify(result);
    } catch (err) {
      setError("actionError", err);
    }
  }

  el("telemetryReconnect").addEventListener("click", startTelemetryPolling);
  el("hardwareReconnect").addEventListener("click", startHardwarePolling);
  el("refreshCold").addEventListener("click", doRefreshCold);
  el("sendCommand").addEventListener("click", doSendCommand);

  startTelemetryPolling();
  startHardwarePolling();
  await doRefreshCold();
}

main().catch((err) => {
  setError("globalError", err);
});
