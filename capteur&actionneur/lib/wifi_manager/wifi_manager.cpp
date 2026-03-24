// ============================================================
// wifi_manager.cpp — Gestion connexion WiFi avec back-off
// ============================================================

#include "wifi_manager.h"
#include "config.h"
#include "led.h"
#include <WiFi.h>
#include <Arduino.h>

// Délai courant de reconnexion (back-off exponentiel)
static uint32_t s_delai_reconnexion = RECONNECT_BASE_DELAY_MS;
// Timestamp du dernier essai de reconnexion
static uint32_t s_dernier_essai = 0;

// -----------------------------------------------------------
// Connexion WiFi initiale — bloquante avec timeout
// Redémarre l'ESP32 si le timeout est dépassé.
// -----------------------------------------------------------
void wifi_connecter() {
    Serial.printf("[WiFi] Connexion à %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    uint32_t debut = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - debut > WIFI_CONNECT_TIMEOUT_MS) {
            Serial.println(F("[WiFi] Timeout — redémarrage"));
            ESP.restart();
        }
        led_signal_wifi_connecting();
        delay(100);
    }

    s_delai_reconnexion = RECONNECT_BASE_DELAY_MS;
    Serial.printf("[WiFi] Connecté — IP : %s\n",
                  WiFi.localIP().toString().c_str());
}

// -----------------------------------------------------------
// Vérifie si le WiFi est actuellement connecté
// -----------------------------------------------------------
bool wifi_est_connecte() {
    return WiFi.status() == WL_CONNECTED;
}

// -----------------------------------------------------------
// Maintien non-bloquant de la connexion WiFi dans le loop.
// Back-off exponentiel plafonné à RECONNECT_MAX_DELAY_MS.
// -----------------------------------------------------------
void wifi_maintenir() {
    if (wifi_est_connecte()) {
        s_delai_reconnexion = RECONNECT_BASE_DELAY_MS; // réinitialise le back-off
        return;
    }

    uint32_t maintenant = millis();
    if (maintenant - s_dernier_essai < s_delai_reconnexion) {
        return; // pas encore le moment de réessayer
    }

    s_dernier_essai = maintenant;
    Serial.printf("[WiFi] Reconnexion dans %lums…\n", s_delai_reconnexion);
    led_signal_wifi_connecting();

    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    // Double le délai pour le prochain essai (back-off exponentiel)
    s_delai_reconnexion = min(s_delai_reconnexion * 2,
                              (uint32_t)RECONNECT_MAX_DELAY_MS);
}
