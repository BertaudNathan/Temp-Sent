# Système IoT — Capteurs de température/humidité + Ventilation connectée

Projet embarqué sur ESP32 (Arduino/PlatformIO).  
Deux firmwares distincts dans le même dépôt :

| Firmware | Rôle |
|---|---|
| **Emetteur** (`emitter`) | Lit la température et l'humidité (DHT22), publie via MQTT |
| **Récepteur** (`receiver`) | Reçoit des commandes MQTT, pilote un ventilateur en PWM |

La communication passe par un **broker MQTT Mosquitto** hébergé sur un Raspberry Pi.  
Les deux ESP32 se reconnectent automatiquement en cas de perte WiFi ou MQTT.  
La mise à jour firmware est possible **sans câble USB** (OTA via WiFi).

---

## Matériel nécessaire

### Commun (par ESP32)
| Composant | Quantité |
|---|---|
| ESP32 DevKit v1 (ou compatible) | 1 |
| Câble USB-A vers Micro-USB (flash initial uniquement) | 1 |
| LED 5 mm (n'importe quelle couleur) | 1 |
| Résistance 220 Ω | 1 |
| Breadboard + fils Dupont | — |

### Emetteur uniquement
| Composant | Quantité |
|---|---|
| Capteur DHT22 (AM2302) — version 3 broches | 1 |
| Résistance pull-up 10 kΩ | 1 |

### Récepteur uniquement
| Composant | Quantité |
|---|---|
| Ventilateur PWM 12 V (4 broches, type PC) | 1 |
| Transistor NPN (ex. 2N2222 ou BC337) ou MOSFET N (ex. IRLZ44N) | 1 |
| Résistance 1 kΩ (base/gate) | 1 |
| Alimentation 12 V pour le ventilateur | 1 |

---

## Schémas de câblage

### Emetteur — ESP32 + DHT22 (3 broches) + LED

```
DHT22 (3 broches)
┌──────────┐
│ VCC ─────┼──── 3.3V (ESP32)
│ DATA ────┼──── GPIO 4 (ESP32)  ←── résistance 10kΩ vers 3.3V
│ GND ─────┼──── GND (ESP32)
└──────────┘

LED de statut
GPIO 2 (ESP32) ──── résistance 220Ω ──── LED+ ────  LED- ──── GND

Note : GPIO 2 = LED bleue embarquée sur la plupart des DevKit ESP32.
       Si la LED embarquée est utilisée, aucun câblage supplémentaire requis.
```

### Récepteur — ESP32 + Transistor NPN + Moteur DC 2 fils

```
         Alimentation moteur (+)
                |
             Moteur
             fil 1 (+)
                |
            Diode 1N4007
          (cathode vers +, anode vers collecteur — protection)
                |
   GPIO 18 ── 1kΩ ── Base [Transistor NPN]
                      Collecteur ──── Moteur fil 2 (−)
                      Émetteur   ──── GND

Vue simplifiée :
  Alimentation (+) ──── Moteur fil 1
  Moteur fil 2 ──── Collecteur
  Base ──── 1kΩ ──── GPIO 18 (ESP32)
  Émetteur ──── GND
  GND alimentation ──── GND ESP32 (masse commune obligatoire)
```

> Pour un MOSFET IRLZ44N : Gate → GPIO 18 via 1 kΩ, Drain → moteur fil 2, Source → GND.
> La diode 1N4007 se branche en antiparallèle sur le moteur (protège le transistor des pics de tension à l'arrêt).

---

## Prérequis logiciels

### Poste de développement

1. **Visual Studio Code** — [télécharger](https://code.visualstudio.com/)
2. **Extension PlatformIO** dans VS Code :
   - Ouvrir VS Code → Extensions (`Ctrl+Shift+X`) → rechercher `PlatformIO IDE` → Installer
3. **Git** — [télécharger](https://git-scm.com/)

### Raspberry Pi (broker MQTT)

Le Raspberry Pi doit être connecté au **même réseau WiFi** que les ESP32.

```bash
# Installer Mosquitto
sudo apt update && sudo apt install -y mosquitto mosquitto-clients

# Activer le service au démarrage
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

# Vérifier que le service tourne
sudo systemctl status mosquitto
```

Si tu veux autoriser les connexions sans authentification (réseau local privé) :

```bash
sudo nano /etc/mosquitto/mosquitto.conf
```

Ajouter à la fin :

```
listener 1883
allow_anonymous true
```

```bash
sudo systemctl restart mosquitto
```

Relever l'**adresse IP** du Raspberry Pi (nécessaire pour `config.h`) :

```bash
hostname -I
```

### Alternative Docker (Mosquitto + bridge REST)

Le dépôt contient une stack Docker prête à l'emploi :
- `mosquitto` (broker MQTT)
- `mqtt-rest-bridge` (service Node.js qui écoute MQTT et pousse vers un backend REST)

Étapes :

```bash
# Depuis la racine du projet
cd Raspberry

# 1) Copier la config d'environnement
cp .env.example .env

# 2) Renseigner l'URL de ton backend (IP locale ou URL publique) dans .env
# REST_BASE_URL=http://192.168.1.20:3000

# 3) Lancer les conteneurs
docker compose up -d --build
```

Topics écoutés par défaut :
- `iot/sensors/+/telemetry` -> `POST ${REST_BASE_URL}${REST_TELEMETRY_PATH}`
- `iot/sensors/+/info`, `iot/sensors/+/errors`, `iot/actuators/+/status` -> `POST ${REST_BASE_URL}${REST_KPI_PATH}`

Pour suivre les logs :

```bash
docker compose logs -f mqtt-rest-bridge
```

---

## Installation du projet

### 1. Cloner le dépôt

```bash
git clone <url-du-depot>
cd "Temp Sent"
```

### 2. Ouvrir dans VS Code

```bash
code .
```

PlatformIO détecte automatiquement le projet et télécharge les bibliothèques au premier build.

### 3. Configurer le projet

Ouvrir le fichier **`include/config.h`** et renseigner les valeurs suivantes :

```c
// Réseau WiFi (SSID et mot de passe du réseau local)
#define WIFI_SSID   "NomDuReseau"
#define WIFI_PASS   "MotDePasseWifi"

// Adresse IP du Raspberry Pi (broker MQTT)
#define MQTT_HOST   "192.168.1.XXX"
#define MQTT_PORT   1883

// Mot de passe pour les mises à jour OTA (choisir quelque chose de sûr)
#define OTA_PASSWORD  "mon-mot-de-passe-ota"
```

> **Les paramètres suivants n'ont pas besoin d'être modifiés pour un premier démarrage :**
> - `MQTT_USER` / `MQTT_PASS` — laisser vides si Mosquitto est en mode anonyme
> - `PIN_DHT` / `PIN_LED` / `PIN_FAN_PWM` — correspondent au câblage décrit ci-dessus
> - `SENSOR_INTERVAL_MS` — intervalle de lecture du capteur (défaut : 5 secondes)
> - `DEVICE_ID` — **généré automatiquement** depuis l'adresse MAC, aucune configuration nécessaire

---

## Flash des firmwares

> Le **premier flash** doit obligatoirement se faire par câble USB. Les suivants peuvent se faire en OTA.

### Flash de l'émetteur

1. Brancher l'ESP32 **émetteur** en USB
2. Dans VS Code, en bas à gauche : sélectionner l'environnement **`emitter`**
3. Cliquer sur **→ Upload** (ou via le terminal) :

```bash
pio run -e emitter --target upload
```

### Flash du récepteur

1. Brancher l'ESP32 **récepteur** en USB
2. Sélectionner l'environnement **`receiver`**

```bash
pio run -e receiver --target upload
```

---

## Vérification du fonctionnement

### Monitor série (débogage)

```bash
# Émetteur
pio device monitor -e emitter

# Récepteur
pio device monitor -e receiver
```

Au démarrage, les deux ESP32 affichent leur **ID automatique** basé sur leur adresse MAC :

```
[Device] ID : esp32-a1b2c3
[WiFi]  Connecté — IP : 192.168.1.42
[MQTT]  Connecté
[OTA]   Prêt — hostname: esp32-a1b2c3
```

### Vérifier la réception MQTT (depuis le Raspberry Pi)

```bash
# Écouter toutes les mesures de tous les capteurs
mosquitto_sub -h localhost -t "iot/sensors/#" -v

# Exemple de message reçu :
# iot/sensors/esp32-a1b2c3/telemetry {"device_id":"esp32-a1b2c3","temperature":23.4,"humidity":61.2,"timestamp":12345}
```

### Envoyer une commande au récepteur

```bash
# Régler le moteur à 75 %
mosquitto_pub -h localhost -t "iot/actuators/esp32-d4e5f6/command" \
  -m '{"action":"set_motor","value":75}'

# Arrêt d'urgence
mosquitto_pub -h localhost -t "iot/actuators/esp32-d4e5f6/command" \
  -m '{"action":"emergency_stop"}'

# Reprendre le fonctionnement normal
mosquitto_pub -h localhost -t "iot/actuators/esp32-d4e5f6/command" \
  -m '{"action":"reset"}'
```

> Remplacer `esp32-d4e5f6` par l'ID affiché dans le monitor série du récepteur.

---

## Mise à jour OTA (sans câble USB)

Une fois les ESP32 alimentés et connectés au WiFi, le flash peut se faire via le réseau :

```bash
# Émetteur (remplacer l'IP par celle affichée au démarrage)
pio run -e emitter --target upload --upload-port 192.168.1.42

# Récepteur
pio run -e receiver --target upload --upload-port 192.168.1.43
```

Le mot de passe demandé est celui défini dans `OTA_PASSWORD` dans `config.h`.

---

## Codes visuels de la LED de statut

| Signal LED | Signification |
|---|---|
| 1 blink lent (200 ms) | Connexion WiFi en cours |
| 1 blink rapide (80 ms) | Connexion MQTT en cours |
| 1 flash court (50 ms) | Mesure capteur réussie / commande reçue |
| 3 flashs rapides | Erreur de lecture capteur |
| Blinks très rapides | Transfert OTA en cours |

---

## Topics MQTT de référence

| Topic | Sens | Description |
|---|---|---|
| `iot/sensors/<id>/telemetry` | ESP32 → Broker | Température + humidité |
| `iot/sensors/<id>/info` | ESP32 → Broker | Métadonnées (IP, MAC, firmware) |
| `iot/sensors/<id>/errors` | ESP32 → Broker | Erreurs de lecture capteur |
| `iot/actuators/<id>/command` | Broker → ESP32 | Commande ventilateur |
| `iot/actuators/<id>/status` | ESP32 → Broker | Statut ventilateur |

---

## Structure du projet

```
include/
  config.h              ← Fichier de configuration (WiFi, MQTT, pins…)
lib/
  device/               — Identifiant unique basé sur la MAC
  led/                  — LED de statut
  sensor/               — Lecture DHT22
  wifi_manager/         — Connexion WiFi + reconnexion automatique
  mqtt_manager/         — Client MQTT + reconnexion automatique
  ota_manager/          — Mise à jour OTA
  telemetry/            — Sérialisation JSON des messages
  actuator/             — Pilotage PWM du ventilateur
src/
  main_emitter.cpp      — Firmware émetteur
  main_receiver.cpp     — Firmware récepteur
platformio.ini          — Configuration PlatformIO (deux environnements)
```

---

## Dépannage rapide

| Problème | Solution |
|---|---|
| L'ESP32 ne se connecte pas au WiFi | Vérifier `WIFI_SSID` et `WIFI_PASS` dans `config.h` |
| L'ESP32 ne se connecte pas au broker | Vérifier `MQTT_HOST` et que Mosquitto tourne (`systemctl status mosquitto`) |
| Pas de message MQTT reçu | Vérifier que l'ESP32 et le Raspberry Pi sont sur le même réseau |
| OTA refusé | Vérifier que `OTA_PASSWORD` correspond entre `config.h` et la commande upload |
| Ventilateur ne répond pas | Vérifier le câblage transistor/MOSFET + alimentation 12 V séparée |
| `FAILED` à la compilation | S'assurer que PlatformIO a téléchargé les bibliothèques (`pio lib install`) |
