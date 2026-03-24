// ============================================================
// actuator.cpp — Pilotage moteur DC 2 fils via LEDC ESP32
// ============================================================

#include "actuator.h"
#include "config.h"
#include <Arduino.h>

// État interne de l'actionneur (local au module)
static ActuatorState s_etat = { 0, false, 0 };

// -----------------------------------------------------------
// Convertit un pourcentage (0–100) en valeur PWM brute
// selon la résolution configurée dans config.h
// -----------------------------------------------------------
static uint32_t _pct_to_duty(uint8_t pct) {
    uint32_t max_duty = (1 << PWM_RESOLUTION_BITS) - 1;
    return (uint32_t)pct * max_duty / 100;
}

// -----------------------------------------------------------
// Initialise le canal LEDC PWM (fréquence, résolution, pin)
// -----------------------------------------------------------
void actuator_init() {
    ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
    ledcAttachPin(PIN_MOTOR_PWM, PWM_CHANNEL);
    ledcWrite(PWM_CHANNEL, 0); // moteur arrêté au démarrage
    s_etat = { 0, false, millis() };
    Serial.printf("[Actuator] PWM initialisé — canal %d, freq %dHz, pin %d\n",
                  PWM_CHANNEL, PWM_FREQ_HZ, PIN_MOTOR_PWM);
}

// -----------------------------------------------------------
// Règle la vitesse du moteur (clamping + garde urgence)
// -----------------------------------------------------------
void actuator_set_vitesse(uint8_t vitesse_pct) {
    if (s_etat.emergency_stop) {
        Serial.println(F("[Actuator] Arrêt d'urgence actif — commande ignorée"));
        return;
    }

    // Clamp entre 0 et 100
    vitesse_pct = min(vitesse_pct, (uint8_t)100);

    ledcWrite(PWM_CHANNEL, _pct_to_duty(vitesse_pct));
    s_etat.motor_speed_pct = vitesse_pct;
    s_etat.last_updated  = millis();

    Serial.printf("[Actuator] Vitesse moteur : %d%%\n", vitesse_pct);
}

// -----------------------------------------------------------
// Arrêt d'urgence immédiat — moteur à 0, flag actif
// -----------------------------------------------------------
void actuator_emergency_stop() {
    ledcWrite(PWM_CHANNEL, 0);
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
    ledcWrite(PWM_CHANNEL, 0);
    Serial.println(F("[Actuator] Reset — mode normal rétabli"));
}

// -----------------------------------------------------------
// Retourne une copie de l'état courant de l'actionneur
// -----------------------------------------------------------
ActuatorState actuator_get_etat() {
    return s_etat;
}
