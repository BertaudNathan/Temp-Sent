// ============================================================
// device.cpp — Génération de l'ID unique depuis la MAC ESP32
// ============================================================

#include "device.h"
#include <esp_wifi.h>
#include <Arduino.h>

// Buffer statique pour l'identifiant — jamais réalloué
static char s_device_id   [16];  // "esp32-aabbcc\0" = 14 chars max
static char s_topic_telemetry[64];
static char s_topic_info     [64];
static char s_topic_errors   [64];
static char s_topic_command  [64];
static char s_topic_status   [64];

// -----------------------------------------------------------
// Construit tous les topics MQTT une fois l'ID connu
// -----------------------------------------------------------
static void _build_topics() {
    snprintf(s_topic_telemetry, sizeof(s_topic_telemetry),
             "iot/sensors/%s/telemetry",  s_device_id);
    snprintf(s_topic_info,      sizeof(s_topic_info),
             "iot/sensors/%s/info",       s_device_id);
    snprintf(s_topic_errors,    sizeof(s_topic_errors),
             "iot/sensors/%s/errors",     s_device_id);
    snprintf(s_topic_command,   sizeof(s_topic_command),
             "iot/actuators/%s/command",  s_device_id);
    snprintf(s_topic_status,    sizeof(s_topic_status),
             "iot/actuators/%s/status",   s_device_id);
}

// -----------------------------------------------------------
// Initialise l'ID depuis les 3 derniers octets de la MAC WiFi
// Format : "esp32-aabbcc" — unique par chip, sans configuration
// -----------------------------------------------------------
void device_init() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA); // lecture directe registre chip

    snprintf(s_device_id, sizeof(s_device_id),
             "esp32-%02x%02x%02x", mac[3], mac[4], mac[5]);

    _build_topics();

    Serial.printf("[Device] ID : %s\n", s_device_id);
}

// -----------------------------------------------------------
// Accesseurs — retournent des pointeurs vers les buffers statiques
// -----------------------------------------------------------
const char* device_id_get()          { return s_device_id; }
const char* device_topic_telemetry() { return s_topic_telemetry; }
const char* device_topic_info()      { return s_topic_info; }
const char* device_topic_errors()    { return s_topic_errors; }
const char* device_topic_command()   { return s_topic_command; }
const char* device_topic_status()    { return s_topic_status; }
