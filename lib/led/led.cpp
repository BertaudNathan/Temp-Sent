// ============================================================
// led.cpp — Implémentation de la LED de statut
// ============================================================

#include "led.h"
#include "config.h"
#include <Arduino.h>

// -----------------------------------------------------------
// Initialise la LED (GPIO en OUTPUT, éteinte au démarrage)
// -----------------------------------------------------------
void led_init() {
    pinMode(PIN_LED, OUTPUT);
    led_set(false);
}

// -----------------------------------------------------------
// Allume ou éteint la LED selon le paramètre allume
// -----------------------------------------------------------
void led_set(bool allume) {
    digitalWrite(PIN_LED, allume ? HIGH : LOW);
}

// -----------------------------------------------------------
// Clignote la LED un nombre de fois avec une durée configurable
// -----------------------------------------------------------
void led_blink(int fois, int duree_ms) {
    for (int i = 0; i < fois; i++) {
        led_set(true);
        delay(duree_ms);
        led_set(false);
        delay(duree_ms);
    }
}

// -----------------------------------------------------------
// Blink lent (200 ms) : WiFi en cours de connexion
// -----------------------------------------------------------
void led_signal_wifi_connecting() {
    led_blink(1, 200);
}

// -----------------------------------------------------------
// Blink rapide (80 ms) : MQTT en cours de connexion
// -----------------------------------------------------------
void led_signal_mqtt_connecting() {
    led_blink(1, 80);
}

// -----------------------------------------------------------
// 1 flash court (50 ms) : mesure capteur réussie
// -----------------------------------------------------------
void led_signal_ok() {
    led_blink(1, 50);
}

// -----------------------------------------------------------
// 3 flashs rapides (60 ms) : erreur capteur
// -----------------------------------------------------------
void led_signal_erreur() {
    led_blink(3, 60);
}

// -----------------------------------------------------------
// Flash très rapide (30 ms) : transfert OTA en cours
// -----------------------------------------------------------
void led_signal_ota() {
    led_blink(1, 30);
}
