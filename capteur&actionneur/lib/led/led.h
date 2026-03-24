#pragma once

// ============================================================
// led.h — Interface de la LED de statut
// Fournit des codes visuels distincts selon l'état du système.
// ============================================================

/**
 * @brief Initialise la LED (configure le GPIO en OUTPUT, éteint la LED).
 */
void led_init();

/**
 * @brief Allume ou éteint la LED.
 * @param allume true = allumée, false = éteinte.
 */
void led_set(bool allume);

/**
 * @brief Clignote la LED un nombre de fois donné.
 * @param fois    Nombre de clignotements.
 * @param duree_ms Durée d'un clignotement ON/OFF en ms.
 */
void led_blink(int fois, int duree_ms = 150);

/**
 * @brief Indique visuellement la connexion WiFi en cours (blink lent).
 */
void led_signal_wifi_connecting();

/**
 * @brief Indique visuellement la connexion MQTT en cours (blink rapide).
 */
void led_signal_mqtt_connecting();

/**
 * @brief Indique une mesure capteur réussie (1 flash court).
 */
void led_signal_ok();

/**
 * @brief Indique une erreur capteur (3 flashs rapides).
 */
void led_signal_erreur();

/**
 * @brief Indique un transfert OTA en cours (blink très rapide continu).
 * Doit être appelé pendant le transfert OTA à chaque appel de callback.
 */
void led_signal_ota();
