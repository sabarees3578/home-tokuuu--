# ESP32 OTA firmware — how to use

Files:
- `main.c`             — the whole firmware (wifi + mqtt + esp_ota_ops OTA)
- `partitions_ota.csv` — partition table with two OTA slots

## 1. Create your project

```bash
idf.py create-project esp32_ota
cd esp32_ota
cp <this dir>/main.c main/main.c
cp <this dir>/partitions_ota.csv .
```

## 2. Partition table (REQUIRED for OTA)

```bash
idf.py menuconfig
# → Partition Table → Partition Table: "Custom partition table CSV"
# → Partition Table Custom CSV → partitions_ota.csv
```

You need ota_0 and ota_1 slots — no OTA without them.

## 3. Set your values

In `main.c` at the top:

```c
#define DEVICE_ID   "ET-78421C7A4BB8"   // must match the server's device
#define BROKER_URL  "mqtt://16.112.243.96:1883"
#define WIFI_SSID   "..."
#define WIFI_PASS   "..."
```

## 4. Build, flash, run

```bash
idf.py build flash monitor
```

## 5. How the OTA round-trip works with the server

1. Admin uploads firmware in the web app → **OTA Manager → File System → Upload**.
2. Admin clicks **Push** (Auto or Section method) on a device.
3. Server publishes on `enthutech/<DEVICE_ID>/cmd`:
   `OTA AUTO http://16.112.243.96:5000/api/public/ota/download/1 1.2.3`
4. Device downloads the .bin, writes it with `esp_ota_begin/write/end`,
   calls `esp_ota_set_boot_partition()` and reboots.
5. During download the device reports progress on `enthutech/<DEVICE_ID>/ota`
   (downloading/flashing/success/failed) — you see live progress bars in the
   web app's Version Management tab.
6. After reboot the new firmware's heartbeat carries `firmware_version`,
   which the server stores on the device record.

## Notes

- Send the .bin file built by `idf.py build` → file is `build/esp32_ota.bin`
  (rename to something like `hs01_v1_3_0.bin` when uploading).
- The first-ever flash must be a full flash: `idf.py flash` (factory image).
- If Wi-Fi credentials change, put them in menuconfig instead of #defines.