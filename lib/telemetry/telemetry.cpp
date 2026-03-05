// ============================================================
// telemetry.cpp — Sérialisation JSON des messages MQTT
// ============================================================

#include "telemetry.h"
#include "config.h"
#include "device.h"
#include <ArduinoJson.h>
#include <WiFi.h>
#include <Arduino.h>

// -----------------------------------------------------------
// Sérialise une mesure capteur (température + humidité)
// {"device_id":"…","temperature":…,"humidity":…,"timestamp":…}
// -----------------------------------------------------------
bool telemetry_serialiser_mesure(const SensorData& data, char* out, size_t len) {
    JsonDocument doc;
    doc["device_id"]   = device_id_get();
    doc["temperature"] = roundf(data.temperature * 10.0f) / 10.0f;
    doc["humidity"]    = roundf(data.humidity    * 10.0f) / 10.0f;
    doc["timestamp"]   = data.timestamp;
    return serializeJson(doc, out, len) > 0;
}

// -----------------------------------------------------------
// Sérialise les métadonnées matérielles (info board réseau)
// {"device_id":"…","firmware_version":"…","mac":"…","ip":"…","board":"esp32dev"}
// -----------------------------------------------------------
bool telemetry_serialiser_info(char* out, size_t len) {
    JsonDocument doc;
    doc["device_id"]        = device_id_get();
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["mac"]              = WiFi.macAddress();
    doc["ip"]               = WiFi.localIP().toString();
    doc["board"]            = "esp32dev";
    return serializeJson(doc, out, len) > 0;
}

// -----------------------------------------------------------
// Sérialise une erreur capteur
// {"device_id":"…","error_code":…,"message":"…","timestamp":…}
// -----------------------------------------------------------
bool telemetry_serialiser_erreur(int code, const char* message,
                                  char* out, size_t len) {
    JsonDocument doc;
    doc["device_id"]  = device_id_get();
    doc["error_code"] = code;
    doc["message"]    = message;
    doc["timestamp"]  = millis();
    return serializeJson(doc, out, len) > 0;
}

// -----------------------------------------------------------
// Sérialise le statut de l'actionneur
// {"device_id":"…","motor_speed_pct":…,"state":"…","timestamp":…}
// -----------------------------------------------------------
bool telemetry_serialiser_statut(uint8_t vitesse_pct, const char* etat,
                                  char* out, size_t len) {
    JsonDocument doc;
    doc["device_id"]      = device_id_get();
    doc["motor_speed_pct"] = vitesse_pct;
    doc["state"]         = etat;
    doc["timestamp"]     = millis();
    return serializeJson(doc, out, len) > 0;
}
