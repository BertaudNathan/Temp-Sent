// ============================================================
// ota_manager.cpp — OTA (Over-The-Air) via ArduinoOTA
// Protégé par mot de passe, feedback LED pendant le flash.
// ============================================================

#include "ota_manager.h"
#include "config.h"
#include "device.h"
#include "led.h"
#include <ArduinoOTA.h>
#include <Arduino.h>

// -----------------------------------------------------------
// Initialise ArduinoOTA avec hostname, mot de passe et callbacks
// -----------------------------------------------------------
void ota_init() {
    ArduinoOTA.setHostname(device_id_get());
    ArduinoOTA.setPassword(OTA_PASSWORD);

    // Callback : début du flash OTA
    ArduinoOTA.onStart([]() {
        String type = (ArduinoOTA.getCommand() == U_FLASH) ? "firmware" : "SPIFFS";
        Serial.println("[OTA] Début : " + type);
        led_set(true); // LED fixe pendant la phase de démarrage
    });

    // Callback : fin du flash OTA
    ArduinoOTA.onEnd([]() {
        Serial.println(F("\n[OTA] Terminé — redémarrage"));
        led_set(false);
    });

    // Callback : progression (0–100 %)
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("[OTA] Progression : %u%%\r", progress * 100 / total);
        led_signal_ota(); // blink rapide à chaque chunk
    });

    // Callback : erreur OTA
    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("[OTA] Erreur[%u]: ", error);
        switch (error) {
            case OTA_AUTH_ERROR:    Serial.println(F("Authentification")); break;
            case OTA_BEGIN_ERROR:   Serial.println(F("Début")); break;
            case OTA_CONNECT_ERROR: Serial.println(F("Connexion")); break;
            case OTA_RECEIVE_ERROR: Serial.println(F("Réception")); break;
            case OTA_END_ERROR:     Serial.println(F("Fin")); break;
        }
        led_signal_erreur();
    });

    ArduinoOTA.begin();
    Serial.printf("[OTA] Prêt — hostname: %s\n", device_id_get());
}

// -----------------------------------------------------------
// Traite les requêtes OTA en attente (non bloquant)
// -----------------------------------------------------------
void ota_handle() {
    ArduinoOTA.handle();
}
