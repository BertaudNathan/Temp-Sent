// ============================================================
// actuator.cpp — Pilotage moteur DC 2 fils via analogWrite()
// ============================================================

#include "actuator.h"
#include "config.h"
#include <Arduino.h>

// État interne de l'actionneur (local au module)
static ActuatorState s_etat = { 0, false, 0 };

// -----------------------------------------------------------
// Convertit un pourcentage (0–100) en duty 8-bit (0–255)
// pour un analogWrite() "classique".
// -----------------------------------------------------------
static uint8_t _pct_to_duty8(uint8_t pct) {
    pct = min(pct, (uint8_t)100);
    return (uint8_t)((uint32_t)pct * 255u / 100u);
}

// -----------------------------------------------------------
// Initialise la sortie PWM (pin PWM)
// -----------------------------------------------------------
void actuator_init() {
    // Sécurise la broche avant activation du PWM (évite un état flottant au boot).
    pinMode(PIN_MOTOR_PWM, OUTPUT);
    digitalWrite(PIN_MOTOR_PWM, LOW);

    // PWM à 0 au démarrage
    analogWrite(PIN_MOTOR_PWM, 0);
    s_etat = { 0, false, millis() };
    Serial.printf("[Actuator] PWM initialisé (analogWrite) — pin %d\n", PIN_MOTOR_PWM);
}

// -----------------------------------------------------------
// Règle la vitesse du moteur (clamping + garde urgence)
// -----------------------------------------------------------
void actuator_set_vitesse(uint8_t vitesse_pct) {
    if (s_etat.emergency_stop) {
        Serial.println(F("[Actuator] Arrêt d'urgence actif — commande ignorée"));
        return;
    }

    // Clamp entre 0 et 100 (et conversion en duty 0–255)
    vitesse_pct = min(vitesse_pct, (uint8_t)100);
    analogWrite(PIN_MOTOR_PWM, _pct_to_duty8(vitesse_pct));
    s_etat.motor_speed_pct = vitesse_pct;
    s_etat.last_updated  = millis();

    Serial.printf("[Actuator] Vitesse moteur : %d%%\n", vitesse_pct);
}

// -----------------------------------------------------------
// Arrêt d'urgence immédiat — moteur à 0, flag actif
// -----------------------------------------------------------
void actuator_emergency_stop() {
    analogWrite(PIN_MOTOR_PWM, 0);
    s_etat.motor_speed_pct = 0;
    s_etat.emergency_stop = true;
    s_etat.last_updated   = millis();
    Serial.println(F("[Actuator] ARRÊT D'URGENCE déclenché"));
}

// -----------------------------------------------------------
// Réinitialise le mode arrêt d'urgence (vitesse remise à 0)
// -----------------------------------------------------------
void actuator_reset() {
    s_etat.emergency_stop = false;
    s_etat.motor_speed_pct  = 0;
    s_etat.last_updated   = millis();
    analogWrite(PIN_MOTOR_PWM, 0);
    Serial.println(F("[Actuator] Reset — mode normal rétabli"));
}

// -----------------------------------------------------------
// Retourne une copie de l'état courant de l'actionneur
// -----------------------------------------------------------
ActuatorState actuator_get_etat() {
    return s_etat;
}
