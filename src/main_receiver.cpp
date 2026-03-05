// ============================================================
// main_receiver.cpp — Firmware ESP32 Récepteur
// Reçoit commandes MQTT, pilote moteur DC 2 fils en PWM.
// Gère arrêt d'urgence et reset. Reconnexion auto + OTA.
// Flash : pio run -e receiver --target upload
// ============================================================

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "led.h"
#include "actuator.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "ota_manager.h"
#include "telemetry.h"
#include "device.h"

// -----------------------------------------------------------
// État de la régulation autonome par seuil
// -----------------------------------------------------------
static bool s_moteur_actif = false;  // true = moteur enclenché par dépassement de seuil

// -----------------------------------------------------------
// Traite la commande "set_motor" — règle vitesse + publie statut
// -----------------------------------------------------------
static void _traiter_set_motor(uint8_t valeur) {
    // Avertissement si hors plage (avant le clamping interne)
    if (valeur > 100) {
        Serial.printf("[Receiver] Valeur hors plage : %d — clampé à 100\n", valeur);
        char buf[JSON_BUFFER_SIZE];
        telemetry_serialiser_erreur(2, "Valeur moteur hors plage [0-100]", buf, sizeof(buf));
        mqtt_publier(device_topic_status(), buf);
    }

    actuator_set_vitesse(valeur);

    ActuatorState etat = actuator_get_etat();
    char buf[JSON_BUFFER_SIZE];
    if (telemetry_serialiser_statut(etat.motor_speed_pct, "OK", buf, sizeof(buf))) {
        mqtt_publier(device_topic_status(), buf);
    }
}

// -----------------------------------------------------------
// Régulation autonome : évalue les seuils et pilote le moteur
// Logique hysteresis : ON si temp >= seuil OU humi >= seuil
//                     OFF si temp ET humi < seuil × (1 - hysteresis)
// -----------------------------------------------------------
static void _evaluer_seuils(float temp, float humi) {
    const float temp_on  = TEMP_THRESHOLD_C;
    const float temp_off = TEMP_THRESHOLD_C * (1.0f - ALERT_HYSTERESIS_PCT / 100.0f);
    const float humi_on  = HUMIDITY_THRESHOLD_PCT;
    const float humi_off = HUMIDITY_THRESHOLD_PCT * (1.0f - ALERT_HYSTERESIS_PCT / 100.0f);

    bool doit_allumer  = (temp >= temp_on) || (humi >= humi_on);
    bool doit_eteindre = (temp  < temp_off) && (humi  < humi_off);
    Serial.printf("[Receiver] Doit allumer ? %s (temp=%.1f°C seuil=%.1f°C, humi=%.1f%% seuil=%.1f%%)\n",
                  doit_allumer ? "OUI" : "NON", temp, temp_on, humi, humi_on);
    if (doit_allumer && !s_moteur_actif) {
        s_moteur_actif = true;
        _traiter_set_motor(MOTOR_SPEED_ALERT_PCT);
        Serial.printf("[Seuil] ALERTE — temp=%.1f°C humi=%.1f%% → moteur %d%%\n",
                      temp, humi, MOTOR_SPEED_ALERT_PCT);

    } else if (doit_eteindre && s_moteur_actif) {
        s_moteur_actif = false;
        _traiter_set_motor(0);
        Serial.printf("[Seuil] NORMAL — temp=%.1f°C humi=%.1f%% → moteur arrêté\n",
                      temp, humi);
    }
}

// -----------------------------------------------------------
// Callback MQTT — traite les messages reçus sur le topic command
// {"action":"set_motor","value":75}
// {"action":"emergency_stop"}
// {"action":"reset"}
// Traite aussi les télémétries capteurs pour la régulation
// -----------------------------------------------------------
static void _mqtt_callback(char* topic, byte* payload, unsigned int length) {
    // Copie sécurisée du payload dans un buffer null-terminé
    char msg[256];
    size_t len = min((size_t)length, sizeof(msg) - 1);
    memcpy(msg, payload, len);
    msg[len] = '\0';

    Serial.printf("[Receiver] Message reçu [%s] : %s\n", topic, msg);

    JsonDocument doc;
    if (deserializeJson(doc, msg) != DeserializationError::Ok) {
        Serial.println(F("[Receiver] JSON invalide — message ignoré"));
        return;
    }

    // --- Télémétrie capteur → régulation autonome par seuil ---
    if (strstr(topic, "iot/sensors/") != nullptr && strstr(topic, "/telemetry") != nullptr) {
        float temp = doc["temperature"] | -999.0f;
        float humi = doc["humidity"]    | -999.0f;
        if (temp > -999.0f && humi > -999.0f) {
            _evaluer_seuils(temp, humi);
        }
        return;
    }

    const char* action = doc["action"] | "";
    char buf[JSON_BUFFER_SIZE];

    if (strcmp(action, "set_motor") == 0) {
        _traiter_set_motor((uint8_t)(doc["value"] | 0));

    } else if (strcmp(action, "emergency_stop") == 0) {
        s_moteur_actif = false;  // la régulation ne forcera pas une remise en route
        actuator_emergency_stop();
        telemetry_serialiser_statut(0, "EMERGENCY_STOP", buf, sizeof(buf));
        mqtt_publier(device_topic_status(), buf);

    } else if (strcmp(action, "reset") == 0) {
        actuator_reset();
        telemetry_serialiser_statut(0, "RESET", buf, sizeof(buf));
        mqtt_publier(device_topic_status(), buf);

    } else {
        Serial.printf("[Receiver] Action inconnue : %s\n", action);
    }

    led_signal_ok();
}

// -----------------------------------------------------------
// setup() — Initialisation séquentielle de tous les modules
// -----------------------------------------------------------
void setup() {
    Serial.begin(115200);
    device_init(); // ID dérivé de la MAC — doit être premier
    Serial.printf("\n[Boot] Récepteur v%s — device: %s\n",
                  FIRMWARE_VERSION, device_id_get());

    led_init();
    actuator_init();
    wifi_connecter();
    ota_init();
    mqtt_init(_mqtt_callback);
    mqtt_connecter();
    mqtt_abonner(device_topic_command());    // commandes manuelles
    mqtt_abonner(TOPIC_SENSOR_WILDCARD);    // télémétries pour régulation autonome
}

// -----------------------------------------------------------
// loop() — Maintien des connexions et traitement OTA
// -----------------------------------------------------------
void loop() {
    // 1. Maintien WiFi (non bloquant)
    wifi_maintenir();

    // 2. OTA (prioritaire)
    ota_handle();

    // 3. Maintien MQTT + réception messages (non bloquant)
    mqtt_maintenir();

    // Le récepteur est entièrement événementiel (callback MQTT).
    // Pas de polling périodique nécessaire côté actionneur.
}
