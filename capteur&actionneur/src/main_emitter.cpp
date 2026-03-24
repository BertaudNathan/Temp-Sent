// ============================================================
// main_emitter.cpp — Firmware ESP32 Emetteur
// Lit DHT22, publie température + humidité via MQTT.
// Reconnexion WiFi/MQTT automatique + OTA.
// Flash : pio run -e emitter --target upload
// ============================================================

#include <Arduino.h>
#include "config.h"
#include "led.h"
#include "sensor.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "ota_manager.h"
#include "telemetry.h"
#include "device.h"

// Horodatage de la dernière lecture capteur
static uint32_t s_derniere_lecture = 0;

// -----------------------------------------------------------
// Publie la mesure ou une erreur selon la validité des données
// -----------------------------------------------------------
static void _publier_mesure(const SensorData& data) {
    char buf[JSON_BUFFER_SIZE];

    if (data.valid) {
        if (telemetry_serialiser_mesure(data, buf, sizeof(buf))) {
            mqtt_publier(device_topic_telemetry(), buf);
            led_signal_ok();
        }
    } else {
        // Lecture invalide → publication d'une erreur
        if (telemetry_serialiser_erreur(1, "Lecture DHT22 echouee", buf, sizeof(buf))) {
            mqtt_publier(device_topic_errors(), buf);
            led_signal_erreur();
        }
    }
}

// -----------------------------------------------------------
// setup() — Initialisation séquentielle de tous les modules
// -----------------------------------------------------------
void setup() {
    Serial.begin(115200);
    device_init(); // ID dérivé de la MAC — doit être premier
    Serial.printf("\n[Boot] Emetteur v%s — device: %s\n",
                  FIRMWARE_VERSION, device_id_get());

    led_init();
    sensor_init();
    wifi_connecter();
    ota_init();
    mqtt_init(nullptr);   // Emetteur : pas de callback de réception
    mqtt_connecter();
}

// -----------------------------------------------------------
// loop() — Maintien des connexions, lecture et publication
// -----------------------------------------------------------
void loop() {
    // 1. Maintien WiFi (non bloquant, back-off exponentiel)
    wifi_maintenir();

    // 2. Gestion OTA (prioritaire — non bloquant)
    ota_handle();

    // 3. Maintien MQTT (reconnexion + loop PubSubClient)
    mqtt_maintenir();

    // 4. Lecture et publication à l'intervalle configuré
    uint32_t maintenant = millis();
    if (maintenant - s_derniere_lecture >= SENSOR_INTERVAL_MS) {
        s_derniere_lecture = maintenant;

        if (wifi_est_connecte() && mqtt_est_connecte()) {
            SensorData data = sensor_lire();
            _publier_mesure(data);
        }
    }
}
