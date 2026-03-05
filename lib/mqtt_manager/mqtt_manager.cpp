// ============================================================
// mqtt_manager.cpp — Gestion connexion MQTT avec back-off
// ============================================================

#include "mqtt_manager.h"
#include "config.h"
#include "device.h"
#include "led.h"
#include "telemetry.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <Arduino.h>

// Client WiFi sous-jacent et client MQTT
static WiFiClient   s_wifi_client;
static PubSubClient s_mqtt_client(s_wifi_client);

// Back-off exponentiel pour la reconnexion MQTT
static uint32_t s_delai_reconnexion = RECONNECT_BASE_DELAY_MS;
static uint32_t s_dernier_essai     = 0;

// Mémorisation des abonnements pour rejeu après reconnexion
static const uint8_t MAX_TOPICS = 8;
static char s_topics[MAX_TOPICS][64];
static uint8_t s_nb_topics = 0;

// -----------------------------------------------------------
// Rejoue tous les abonnements mémorisés après une reconnexion
// -----------------------------------------------------------
static void _reabonner() {
    for (uint8_t i = 0; i < s_nb_topics; i++) {
        s_mqtt_client.subscribe(s_topics[i]);
        Serial.printf("[MQTT] Re-abonné à %s\n", s_topics[i]);
    }
}

// -----------------------------------------------------------
// Publie les métadonnées matérielles au démarrage/reconnexion
// -----------------------------------------------------------
static void _publier_info() {
    char buf[JSON_BUFFER_SIZE];
    if (telemetry_serialiser_info(buf, sizeof(buf))) {
        s_mqtt_client.publish(device_topic_info(), buf, true); // retain=true
    }
}

// -----------------------------------------------------------
// Logique de connexion commune (utilisée par connecter + maintenir)
// -----------------------------------------------------------
static bool _tenter_connexion() {
    bool ok = (strlen(MQTT_USER) > 0)
        ? s_mqtt_client.connect(device_id_get(), MQTT_USER, MQTT_PASS)
        : s_mqtt_client.connect(device_id_get());

    if (ok) {
        s_delai_reconnexion = RECONNECT_BASE_DELAY_MS;
        _publier_info();
        _reabonner();
    }
    return ok;
}

// -----------------------------------------------------------
// Initialise le client MQTT avec le serveur et le callback
// -----------------------------------------------------------
void mqtt_init(MqttCallback callback) {
    s_mqtt_client.setServer(MQTT_HOST, MQTT_PORT);
    s_mqtt_client.setKeepAlive(MQTT_KEEPALIVE_S);
    if (callback != nullptr) {
        s_mqtt_client.setCallback(callback);
    }
}

// -----------------------------------------------------------
// Connexion MQTT initiale bloquante (boucle jusqu'au succès)
// -----------------------------------------------------------
void mqtt_connecter() {
    while (!s_mqtt_client.connected()) {
        Serial.printf("[MQTT] Connexion à %s:%d\n", MQTT_HOST, MQTT_PORT);
        led_signal_mqtt_connecting();

        if (!_tenter_connexion()) {
            Serial.printf("[MQTT] Echec (rc=%d) — nouvel essai…\n",
                          s_mqtt_client.state());
            delay(2000);
        } else {
            Serial.println(F("[MQTT] Connecté"));
        }
    }
}

// -----------------------------------------------------------
// Publie un payload sur un topic MQTT
// -----------------------------------------------------------
bool mqtt_publier(const char* topic, const char* payload) {
    if (!s_mqtt_client.connected()) return false;
    bool ok = s_mqtt_client.publish(topic, payload);
    Serial.printf("[MQTT] %s → %s (%s)\n",
                  topic, payload, ok ? "OK" : "ERREUR");
    return ok;
}

// -----------------------------------------------------------
// Indique si le client MQTT est connecté
// -----------------------------------------------------------
bool mqtt_est_connecte() {
    return s_mqtt_client.connected();
}

// -----------------------------------------------------------
// Mémorise un abonnement et s'abonne immédiatement si connecté
// -----------------------------------------------------------
void mqtt_abonner(const char* topic) {
    if (s_nb_topics < MAX_TOPICS) {
        strncpy(s_topics[s_nb_topics], topic, sizeof(s_topics[0]) - 1);
        s_topics[s_nb_topics][sizeof(s_topics[0]) - 1] = '\0';
        s_nb_topics++;
    }
    if (s_mqtt_client.connected()) {
        s_mqtt_client.subscribe(topic);
        Serial.printf("[MQTT] Abonné à %s\n", topic);
    }
}

// -----------------------------------------------------------
// Maintien non-bloquant : reconnexion + loop PubSubClient
// Back-off exponentiel plafonné à RECONNECT_MAX_DELAY_MS.
// -----------------------------------------------------------
void mqtt_maintenir() {
    if (s_mqtt_client.connected()) {
        s_mqtt_client.loop();
        return;
    }

    uint32_t maintenant = millis();
    if (maintenant - s_dernier_essai < s_delai_reconnexion) {
        return;
    }
    s_dernier_essai = maintenant;
    led_signal_mqtt_connecting();

    if (_tenter_connexion()) {
        Serial.println(F("[MQTT] Reconnecté"));
    } else {
        s_delai_reconnexion = min(s_delai_reconnexion * 2,
                                  (uint32_t)RECONNECT_MAX_DELAY_MS);
    }
}
