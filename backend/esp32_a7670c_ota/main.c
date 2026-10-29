/**
 * ESP32 WiFi OTA — Simple Version
 * =================================
 * - Connects to WiFi
 * - Connects to MQTT broker
 * - Waits for OTA command from server
 * - Downloads firmware via HTTPS and flashes
 *
 * ⚠️  Change the 4 lines marked CHANGE ME before flashing
 */

#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "esp_https_ota.h"
#include "nvs_flash.h"
#include "mqtt_client.h"

/* ─── CHANGE ME ─────────────────────────────────────── */
#define WIFI_SSID        "YourWiFiName"
#define WIFI_PASS        "YourWiFiPassword"
#define DEVICE_ID        "TA001"
#define FIRMWARE_VERSION "1.0.0"
/* ───────────────────────────────────────────────────── */

#define MQTT_BROKER "mqtt://tasecurities.godem.in:1883"

#define TOPIC_DATA   "enthutech/" DEVICE_ID "/data"
#define TOPIC_STATUS "enthutech/" DEVICE_ID "/status"
#define TOPIC_OTA    "enthutech/" DEVICE_ID "/ota"

static const char *TAG = "HS01";
static esp_mqtt_client_handle_t mqtt_client;

/* ─── WiFi ────────────────────────────────────────────── */
static EventGroupHandle_t wifi_events;
#define WIFI_CONNECTED BIT0

static void wifi_handler(void *arg, esp_event_base_t base,
                         int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        xEventGroupSetBits(wifi_events, WIFI_CONNECTED);
    }
}

static void wifi_connect(void)
{
    wifi_events = xEventGroupCreate();
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);

    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_handler, NULL);
    esp_event_handler_register(IP_EVENT,   IP_EVENT_STA_GOT_IP, wifi_handler, NULL);

    wifi_config_t wifi = {
        .sta = { .ssid = WIFI_SSID, .password = WIFI_PASS }
    };
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi);
    esp_wifi_start();
    esp_wifi_connect();

    xEventGroupWaitBits(wifi_events, WIFI_CONNECTED, false, true, portMAX_DELAY);
    ESP_LOGI(TAG, "WiFi connected");
}

/* ─── MQTT Publish helper ─────────────────────────────── */
static void publish(const char *topic, const char *msg)
{
    esp_mqtt_client_publish(mqtt_client, topic, msg, 0, 1, 0);
}

/* ─── OTA progress report ─────────────────────────────── */
static void ota_report(const char *status, int pct, const char *ver, const char *msg)
{
    char buf[256];
    snprintf(buf, sizeof(buf),
        "{\"Device-ID\":\"%s\",\"ota_status\":\"%s\","
        "\"progress\":%d,\"version\":\"%s\",\"message\":\"%s\"}",
        DEVICE_ID, status, pct, ver ? ver : "", msg ? msg : "");
    publish(TOPIC_OTA, buf);
    ESP_LOGI(TAG, "OTA: %s %d%%", status, pct);
}

/* ─── OTA Download via HTTPS ──────────────────────────── */
static int  g_ota_downloaded = 0;
static int  g_ota_total      = 0;
static char g_ota_ver[32]    = {0};
static esp_ota_handle_t g_ota_handle;
static const esp_partition_t *g_ota_partition;

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch (evt->event_id) {
    case HTTP_EVENT_ON_HEADER:
        if (strcasecmp(evt->header_key, "Content-Length") == 0)
            g_ota_total = atoi(evt->header_value);
        break;
    case HTTP_EVENT_ON_DATA:
        esp_ota_write(g_ota_handle, evt->data, evt->data_len);
        g_ota_downloaded += evt->data_len;
        if (g_ota_total > 0) {
            int pct = (int)(100LL * g_ota_downloaded / g_ota_total);
            ota_report("downloading", pct, g_ota_ver, NULL);
        }
        break;
    default:
        break;
    }
    return ESP_OK;
}

static void do_ota(const char *url, const char *ver)
{
    strncpy(g_ota_ver, ver, sizeof(g_ota_ver)-1);
    g_ota_downloaded = 0;
    g_ota_total      = 0;

    g_ota_partition = esp_ota_get_next_update_partition(NULL);
    if (!g_ota_partition) {
        ota_report("failed", 0, ver, "no OTA partition");
        return;
    }

    if (esp_ota_begin(g_ota_partition, OTA_SIZE_UNKNOWN, &g_ota_handle) != ESP_OK) {
        ota_report("failed", 0, ver, "ota_begin failed");
        return;
    }

    ota_report("downloading", 0, ver, "starting download");

    esp_http_client_config_t http_cfg = {
        .url            = url,
        .event_handler  = http_event_handler,
        .timeout_ms     = 30000,
        .buffer_size    = 1024,
        /* Skip cert verification for simplicity.
           For production: set .cert_pem to your CA cert */
        .skip_cert_common_name_check = true,
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
    esp_err_t err = esp_http_client_perform(client);
    esp_http_client_cleanup(client);

    if (err != ESP_OK) {
        ota_report("failed", 0, ver, "download failed");
        esp_ota_abort(g_ota_handle);
        return;
    }

    ota_report("flashing", 95, ver, "verifying firmware");

    if (esp_ota_end(g_ota_handle) != ESP_OK) {
        ota_report("failed", 0, ver, "image invalid");
        return;
    }

    if (esp_ota_set_boot_partition(g_ota_partition) != ESP_OK) {
        ota_report("failed", 0, ver, "set boot failed");
        return;
    }

    ota_report("success", 100, ver, "rebooting now");
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();
}

/* ─── Simple JSON value extractor ─────────────────────── */
static bool json_get(const char *json, const char *key, char *out, int max)
{
    char pat[64];
    snprintf(pat, sizeof(pat), "\"%s\":\"", key);
    const char *p = strstr(json, pat);
    if (!p) return false;
    p += strlen(pat);
    const char *e = strchr(p, '"');
    if (!e) return false;
    int len = (e - p) < max-1 ? (int)(e - p) : max-1;
    memcpy(out, p, len);
    out[len] = '\0';
    return true;
}

/* ─── MQTT Event Handler ──────────────────────────────── */
static void mqtt_event(void *arg, esp_event_base_t base,
                       int32_t id, void *data)
{
    esp_mqtt_event_handle_t evt = data;

    switch (id) {

    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "MQTT connected");
        /* Subscribe to OTA trigger topic */
        esp_mqtt_client_subscribe(mqtt_client, TOPIC_OTA, 1);

        /* Publish online status with current firmware version */
        char status[128];
        snprintf(status, sizeof(status),
            "{\"Device-ID\":\"%s\",\"status\":\"online\","
            "\"firmware_version\":\"%s\"}", DEVICE_ID, FIRMWARE_VERSION);
        publish(TOPIC_STATUS, status);
        break;

    case MQTT_EVENT_DATA: {
        /* Null-terminate topic and data */
        char topic[128]   = {0};
        char payload[512] = {0};
        int tlen = evt->topic_len   < 127  ? evt->topic_len   : 127;
        int dlen = evt->data_len    < 511  ? evt->data_len    : 511;
        memcpy(topic,   evt->topic, tlen);
        memcpy(payload, evt->data,  dlen);

        ESP_LOGI(TAG, "MQTT IN  topic=%s", topic);
        ESP_LOGI(TAG, "MQTT IN  data=%s",  payload);

        /* ── OTA trigger ── */
        if (strstr(topic, "/ota")) {
            char ver[32]  = {0};
            char url[300] = {0};
            json_get(payload, "version", ver, sizeof(ver));
            json_get(payload, "url",     url, sizeof(url));

            if (!ver[0] || !url[0]) {
                ESP_LOGW(TAG, "OTA: missing version or url");
                break;
            }

            /* Only update if server version is newer */
            if (strcmp(ver, FIRMWARE_VERSION) <= 0) {
                ESP_LOGI(TAG, "Already on %s — skip", FIRMWARE_VERSION);
                break;
            }

            ESP_LOGI(TAG, "OTA start: %s → %s", FIRMWARE_VERSION, ver);
            xTaskCreate((TaskFunction_t)do_ota, "ota",
                        8192, NULL, 5, NULL);
            /* Note: url and ver are on stack — for production copy to heap */
            do_ota(url, ver);
        }
        break;
    }

    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "MQTT disconnected — reconnecting");
        esp_mqtt_client_reconnect(mqtt_client);
        break;

    default:
        break;
    }
}

/* ─── Sensor publish task ─────────────────────────────── */
static void sensor_task(void *arg)
{
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(30000)); /* every 30 s */

        /* Replace with real sensor readings */
        char data[128];
        snprintf(data, sizeof(data),
            "{\"Device-ID\":\"%s\",\"battery\":3.91,\"pir\":0,"
            "\"firmware_version\":\"%s\"}",
            DEVICE_ID, FIRMWARE_VERSION);
        publish(TOPIC_DATA, data);
    }
}

/* ─── Main ────────────────────────────────────────────── */
void app_main(void)
{
    ESP_LOGI(TAG, "Device: %s  FW: %s", DEVICE_ID, FIRMWARE_VERSION);

    nvs_flash_init();
    wifi_connect();

    /* Start MQTT */
    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER,
        .credentials.client_id = DEVICE_ID,
        .session.keepalive = 30,
    };
    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID,
                                    mqtt_event, NULL);
    esp_mqtt_client_start(mqtt_client);

    /* Start sensor publish task */
    xTaskCreate(sensor_task, "sensor", 4096, NULL, 3, NULL);
}
